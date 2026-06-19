const THEME_COLORS = {
    paper:  { background: "#f6f8fa", accent: "#0969da" },
    cipher: { background: "#161b22", accent: "#3fb950" },
    ember:  { background: "#1f1700", accent: "#ffb000" },
    frost:  { background: "#ffffff", accent: "#0c7a9e" },
    void:   { background: "#0a0a0a", accent: "#ffffff" },
    dusk:   { background: "#2a2640", accent: "#c792ea" },
    sand:   { background: "#ffffff", accent: "#7c5c3a" },
    rose:   { background: "#ffffff", accent: "#c0364a" },
    ocean:  { background: "#0d1b2e", accent: "#22d3ee" },
    mist:   { background: "#ffffff", accent: "#4f46e5" },
};

const LIBS = {
    jszip:    { url: "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",           loaded: false },
    mammoth:  { url: "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js", loaded: false },
    turndown: { url: "https://cdnjs.cloudflare.com/ajax/libs/turndown/7.1.2/turndown.min.js",       loaded: false },
    pdfjs:    { url: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",           loaded: false },
    xlsx:     { url: "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",         loaded: false },
};

const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

function updateFavicon(theme) {
    const { background, accent } = THEME_COLORS[theme] || THEME_COLORS.paper;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="${background}"/><path d="M10 6h8l6 6v14a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" fill="none" stroke="${accent}" stroke-width="1.8"/><path d="M18 6v6h6" fill="none" stroke="${accent}" stroke-width="1.8"/><path d="M16 17v6M13 20l3 3 3-3" fill="none" stroke="${accent}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    document.querySelectorAll("link[rel='icon']").forEach(l => l.remove());
    const link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    link.href = "data:image/svg+xml," + encodeURIComponent(svg);
    document.head.appendChild(link);
}

function loadScript(name) {
    if (LIBS[name].loaded) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = LIBS[name].url;
        s.onload  = () => { LIBS[name].loaded = true; resolve(); };
        s.onerror = () => reject(new Error(`Failed to load ${name}`));
        document.head.appendChild(s);
    });
}

function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.className = cls || "";
}

function triggerDownload(content, filename) {
    const blob   = new Blob([content], { type: "text/plain;charset=utf-8" });
    const anchor = document.createElement("a");
    anchor.href     = URL.createObjectURL(blob);
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(anchor.href);
}

function readText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file, "utf-8");
    });
}

const savedTheme = localStorage.getItem("markdrop-theme") || "paper";
const activeDot  = document.querySelector(`.dot[data-theme="${savedTheme}"]`);
if (activeDot) {
    document.documentElement.setAttribute("data-theme", savedTheme);
    document.getElementById("theme-name").textContent = activeDot.dataset.label;
    document.querySelectorAll(".dot").forEach(d => d.classList.remove("active"));
    activeDot.classList.add("active");
}
updateFavicon(savedTheme);

document.querySelectorAll(".dot").forEach(dot => {
    dot.addEventListener("click", () => {
        const theme = dot.dataset.theme;
        document.documentElement.setAttribute("data-theme", theme);
        document.getElementById("theme-name").textContent = dot.dataset.label;
        document.querySelectorAll(".dot").forEach(d => d.classList.remove("active"));
        dot.classList.add("active");
        updateFavicon(theme);
        localStorage.setItem("markdrop-theme", theme);
    });
});

const statusEl         = document.getElementById("status");
const dropZone         = document.getElementById("drop-zone");
const fileInput        = document.getElementById("file-input");
const resultsEl        = document.getElementById("results");
const summaryEl        = document.getElementById("results-summary");
const resultsActions   = document.getElementById("results-actions");
const downloadSelected = document.getElementById("download-selected");
const selectAllBtn     = document.getElementById("select-all");
const deselectAllBtn   = document.getElementById("deselect-all");
const collapseAllBtn   = document.getElementById("collapse-all");
const expandAllBtn     = document.getElementById("expand-all");
const clearAllBtn      = document.getElementById("remove-all");
const filterInput      = document.getElementById("filter-input");
const typeFiltersEl    = document.getElementById("type-filters");
const sortBtns         = [...document.querySelectorAll(".sort-btn")];

let sortOrder     = "newest";
let cardIndex     = 0;
const activeTypes = new Set();

function syncActions() {
    const cards        = [...resultsEl.children];
    const total        = cards.length;
    const visible      = cards.filter(c => c.style.display !== "none");
    const checked      = resultsEl.querySelectorAll(".result-checkbox:checked").length;
    const anyExpanded  = cards.some(c => !c.classList.contains("collapsed"));
    const anyCollapsed = cards.some(c => c.classList.contains("collapsed"));
    const allChecked   = visible.length > 0 && visible.every(c => c.querySelector(".result-checkbox").checked);

    resultsActions.classList.toggle("visible", total >= 2);
    downloadSelected.classList.toggle("visible", checked > 0);
    downloadSelected.textContent = `Download selected (${checked})`;

    collapseAllBtn.disabled = !anyExpanded;
    expandAllBtn.disabled   = !anyCollapsed;
    selectAllBtn.disabled   = allChecked || visible.length === 0;
    deselectAllBtn.disabled = checked === 0;

    syncTypeFilters();
    syncSummary();
}

function syncSummary() {
    const allCards = [...resultsEl.children];
    const cards    = allCards.filter(c => c.dataset.lines);
    if (allCards.length < 1) { summaryEl.textContent = ""; return; }

    const totals = cards.reduce((acc, c) => ({
        lines:  acc.lines  + (parseInt(c.dataset.lines)  || 0),
        words:  acc.words  + (parseInt(c.dataset.words)  || 0),
        bytes:  acc.bytes  + (parseInt(c.dataset.bytes)  || 0),
        slides: acc.slides + (parseInt(c.dataset.slides) || 0),
        sheets: acc.sheets + (parseInt(c.dataset.sheets) || 0),
    }), { lines: 0, words: 0, bytes: 0, slides: 0, sheets: 0 });

    const kb = totals.bytes >= 1024 * 1024
        ? (totals.bytes / 1024 / 1024).toFixed(1) + " MB"
        : (totals.bytes / 1024).toFixed(1) + " KB";

    const parts = [allCards.length + " files"];
    if (totals.slides > 0) parts.push(totals.slides.toLocaleString() + " slides");
    if (totals.sheets > 0) parts.push(totals.sheets.toLocaleString() + " sheets");
    parts.push(totals.lines.toLocaleString() + " lines");
    parts.push(totals.words.toLocaleString() + " words");
    parts.push(kb + " total");

    summaryEl.textContent = parts.join("  ·  ");
}

function syncTypeFilters() {
    const present = new Set([...resultsEl.children]
        .map(c => c.dataset.filename.split(".").pop().toLowerCase()));

    for (const t of [...activeTypes]) {
        if (!present.has(t)) activeTypes.delete(t);
    }

    typeFiltersEl.innerHTML = "";
    [...present].sort().forEach(ext => {
        const btn = document.createElement("button");
        btn.className = "type-btn" + (activeTypes.has(ext) ? " active" : "");
        btn.textContent = ext;
        btn.addEventListener("click", () => {
            activeTypes.has(ext) ? activeTypes.delete(ext) : activeTypes.add(ext);
            btn.classList.toggle("active");
            applyFilter();
        });
        typeFiltersEl.appendChild(btn);
    });
}

function applyFilter() {
    const q = filterInput.value.toLowerCase().trim();
    [...resultsEl.children].forEach(c => {
        const name = c.dataset.filename.toLowerCase();
        const ext  = name.split(".").pop();
        const matchesText = !q || name.includes(q);
        const matchesType = activeTypes.size === 0 || activeTypes.has(ext);
        c.style.display = matchesText && matchesType ? "" : "none";
    });
    syncActions();
}

function applySort() {
    const cards = [...resultsEl.children];
    if      (sortOrder === "asc")    cards.sort((a, b) => a.dataset.filename.localeCompare(b.dataset.filename));
    else if (sortOrder === "desc")   cards.sort((a, b) => b.dataset.filename.localeCompare(a.dataset.filename));
    else if (sortOrder === "oldest") cards.sort((a, b) => parseInt(a.dataset.index) - parseInt(b.dataset.index));
    else                             cards.sort((a, b) => parseInt(b.dataset.index) - parseInt(a.dataset.index));
    cards.forEach(c => resultsEl.appendChild(c));
}

clearAllBtn.addEventListener("click", () => {
    resultsEl.innerHTML = "";
    filterInput.value = "";
    activeTypes.clear();
    sortOrder = "newest";
    sortBtns.forEach(b => b.classList.toggle("active", b.dataset.sort === "newest"));
    syncActions();
});

deselectAllBtn.addEventListener("click", () => {
    resultsEl.querySelectorAll(".result-checkbox").forEach(b => { b.checked = false; });
    syncActions();
});

selectAllBtn.addEventListener("click", () => {
    [...resultsEl.querySelectorAll(".result-checkbox")]
        .filter(b => b.closest(".result-card").style.display !== "none")
        .forEach(b => { b.checked = true; });
    syncActions();
});

collapseAllBtn.addEventListener("click", () => {
    [...resultsEl.children].forEach(c => {
        c.classList.add("collapsed");
        const t = c.querySelector(".result-toggle");
        if (t) t.textContent = "+";
    });
    syncActions();
});

expandAllBtn.addEventListener("click", () => {
    [...resultsEl.children].forEach(c => {
        c.classList.remove("collapsed");
        const t = c.querySelector(".result-toggle");
        if (t) t.textContent = "−";
    });
    syncActions();
});

filterInput.addEventListener("input", applyFilter);

sortBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        sortOrder = btn.dataset.sort;
        sortBtns.forEach(b => b.classList.toggle("active", b === btn));
        applySort();
    });
});

downloadSelected.addEventListener("click", downloadSelectedAsZip);

async function preload() {
    try {
        await Promise.all([
            loadScript("jszip"),
            loadScript("mammoth"),
            loadScript("turndown"),
            loadScript("pdfjs"),
            loadScript("xlsx"),
        ]);
        dropZone.classList.remove("disabled");
        setStatus("Ready. Drop files to convert.", "ready");
    } catch (e) {
        setStatus("Failed to load libraries. Check your connection and reload.", "error");
    }
}

dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("dragover", e => {
    e.preventDefault();
    dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));

dropZone.addEventListener("drop", e => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    processFiles([...e.dataTransfer.files]);
});

fileInput.addEventListener("change", () => {
    processFiles([...fileInput.files]);
    fileInput.value = "";
});

async function processFiles(files) {
    if (!files.length) return;
    for (const file of files) {
        await processFile(file);
    }
}

async function processFile(file) {
    if (file.size > 50 * 1024 * 1024) {
        setStatus(`${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB, this may take a moment.`, "working");
    } else {
        setStatus(`Converting ${file.name}...`, "working");
    }

    const existing = resultsEl.querySelector(`[data-filename="${CSS.escape(file.name)}"]`);
    if (existing) existing.remove();

    [...resultsEl.children].forEach(c => {
        c.classList.add("collapsed");
        const t = c.querySelector(".result-toggle");
        if (t) t.textContent = "+";
    });

    const card = createCard(file.name);
    resultsEl.prepend(card);
    applySort();
    syncActions();

    try {
        const buf = await file.arrayBuffer();
        const ext = file.name.split(".").pop().toLowerCase();
        const md  = await convert(buf, ext, file);
        card.querySelector(".result-textarea").value = md;
        card.querySelector(".result-textarea").style.minHeight =
            Math.min(600, Math.max(200, md.split("\n").length * 20)) + "px";
        setMeta(card, md, file);
        setStatus("Ready. Drop files to convert.", "ready");
    } catch (e) {
        const ta = card.querySelector(".result-textarea");
        ta.style.display = "none";
        const err = document.createElement("div");
        err.className = "result-error";
        err.textContent = "Error: " + (e.message || "conversion failed");
        ta.parentNode.insertBefore(err, ta);
        setStatus("Ready. Drop files to convert.", "ready");
    }
}

function createCard(filename) {
    const card = document.createElement("div");
    card.className = "result-card";
    card.dataset.filename = filename;
    card.dataset.index    = cardIndex++;

    const name = document.createElement("div");
    name.className = "result-filename";

    const checkbox = document.createElement("input");
    checkbox.type      = "checkbox";
    checkbox.className = "result-checkbox";
    checkbox.title     = "Select for download";
    checkbox.addEventListener("click", e => { e.stopPropagation(); syncActions(); });

    const toggle = document.createElement("span");
    toggle.className = "result-toggle";
    toggle.textContent = "−";

    const label = document.createElement("span");
    label.className = "result-name";
    label.textContent = filename;
    label.title = filename;

    const meta = document.createElement("span");
    meta.className = "result-meta";

    const statsInline = document.createElement("span");
    statsInline.className = "result-stats-inline";

    const closeBtn = document.createElement("button");
    closeBtn.className = "btn-close";
    closeBtn.textContent = "×";
    closeBtn.title = "Dismiss";
    closeBtn.addEventListener("click", e => {
        e.stopPropagation();
        card.remove();
        syncActions();
    });

    name.appendChild(checkbox);
    name.appendChild(toggle);
    name.appendChild(label);
    name.appendChild(meta);
    name.appendChild(statsInline);
    name.appendChild(closeBtn);

    name.addEventListener("click", () => {
        card.classList.toggle("collapsed");
        toggle.textContent = card.classList.contains("collapsed") ? "+" : "−";
    });

    card.appendChild(name);

    const stats = document.createElement("div");
    stats.className = "result-stats";
    card.appendChild(stats);

    const ta = document.createElement("textarea");
    ta.className    = "result-textarea";
    ta.name         = "result";
    ta.readOnly     = true;
    ta.autocomplete = "off";
    ta.value        = "";
    card.appendChild(ta);

    const actions = document.createElement("div");
    actions.className = "result-actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "btn-accent";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(ta.value);
            copyBtn.textContent = "Copied";
            copyBtn.classList.add("copied");
            setTimeout(() => { copyBtn.textContent = "Copy"; copyBtn.classList.remove("copied"); }, 1500);
        } catch {
            copyBtn.textContent = "Error";
            setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
        }
    });

    const dlBtn = document.createElement("button");
    dlBtn.className = "btn-accent";
    dlBtn.textContent = "Save .md";
    dlBtn.addEventListener("click", () => {
        const base = filename.replace(/\.[^.]+$/, "");
        triggerDownload(ta.value, base + ".md");
    });

    actions.appendChild(copyBtn);
    actions.appendChild(dlBtn);
    card.appendChild(actions);
    return card;
}

function firstPreview(lines) {
    const heading = lines.find(l => /^#{1,3} /.test(l));
    if (heading) return heading.replace(/^#{1,3} /, "").trim();
    const line = lines.find(l => l.trim() && !l.startsWith("<!--") && !l.startsWith("```"));
    return line ? line.trim() : "";
}

function setMeta(card, md, file) {
    const lines     = md.split("\n");
    const nonEmpty  = lines.filter(l => l.trim());
    const lineCount = nonEmpty.length;
    const wordCount = nonEmpty.join(" ").split(/\s+/).filter(Boolean).length;
    const kb        = file.size >= 1024 * 1024
        ? (file.size / 1024 / 1024).toFixed(1) + " MB"
        : (file.size / 1024).toFixed(1) + " KB";

    const preview    = firstPreview(lines);
    const slideCount = (md.match(/<!-- Slide number:/g) || []).length;
    const ext        = file.name.split(".").pop().toLowerCase();
    const sheetCount = ext === "xlsx" ? (md.match(/^## /gm) || []).length : 0;

    const formatPart = ext === "pptx" && slideCount > 0
        ? slideCount + " slides"
        : ext === "xlsx" && sheetCount > 0
        ? sheetCount + " sheets"
        : "";

    const parts = [formatPart, lineCount.toLocaleString() + " lines", wordCount.toLocaleString() + " words", kb]
        .filter(Boolean);

    card.dataset.lines  = lineCount;
    card.dataset.words  = wordCount;
    card.dataset.bytes  = file.size;
    card.dataset.slides = slideCount;
    card.dataset.sheets = sheetCount;

    card.querySelector(".result-meta").textContent         = preview;
    card.querySelector(".result-stats").textContent        = parts.join("  ·  ");
    card.querySelector(".result-stats-inline").textContent = parts.join("  ·  ");
}

async function convert(buf, ext, file) {
    switch (ext) {
        case "pptx": return convertPptx(buf);
        case "docx": return convertDocx(buf);
        case "pdf":  return convertPdf(buf);
        case "xlsx": return convertXlsx(buf);
        case "html":
        case "htm":  return convertHtml(await readText(file));
        case "csv":  return convertCsv(await readText(file));
        case "json": return "```json\n" + (await readText(file)) + "\n```";
        case "xml":  return "```xml\n"  + (await readText(file)) + "\n```";
        case "txt":  return await readText(file);
        default:     throw new Error(`Unsupported file type: .${ext}`);
    }
}

async function convertPptx(buf) {
    await loadScript("jszip");
    const zip = await JSZip.loadAsync(buf);

    const slideEntries = [];
    for (const path of Object.keys(zip.files)) {
        const m = path.match(/^ppt\/slides\/slide(\d+)\.xml$/);
        if (m) slideEntries.push({ num: parseInt(m[1], 10), path });
    }
    slideEntries.sort((a, b) => a.num - b.num);

    if (!slideEntries.length) throw new Error("No slides found in file.");

    const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
    const parts = [];

    for (const { num, path } of slideEntries) {
        const xml  = await zip.file(path).async("string");
        const doc  = new DOMParser().parseFromString(xml, "text/xml");

        const allT  = [...doc.getElementsByTagNameNS(NS_A, "t")];
        const texts = allT.map(t => t.textContent.trim()).filter(Boolean);

        const notesPath = path.replace("slides/slide", "notesSlides/notesSlide");
        const notesFile = zip.file(notesPath);
        let notesTexts  = [];
        if (notesFile) {
            const notesXml = await notesFile.async("string");
            const notesDoc = new DOMParser().parseFromString(notesXml, "text/xml");
            notesTexts = [...notesDoc.getElementsByTagNameNS(NS_A, "t")]
                .map(t => t.textContent.trim())
                .filter(Boolean);
        }

        let part = `<!-- Slide number: ${num} -->\n`;
        if (texts.length > 0) {
            part += `## ${texts[0]}\n\n`;
            if (texts.length > 1) part += texts.slice(1).join("\n") + "\n";
        }
        if (notesTexts.length > 0) {
            part += `\n### Notes:\n${notesTexts.join(" ")}\n`;
        }
        parts.push(part.trimEnd());
    }

    return parts.join("\n\n");
}

async function convertDocx(buf) {
    await loadScript("mammoth");
    const result = await mammoth.convertToMarkdown({ arrayBuffer: buf });
    return result.value.trim();
}

async function convertPdf(buf) {
    await loadScript("pdfjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    const pdf   = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
        const page    = await pdf.getPage(i);
        const content = await page.getTextContent();
        const text    = content.items.map(item => item.str).join(" ").trim();
        if (text) pages.push(text);
    }
    return pages.join("\n\n");
}

async function convertXlsx(buf) {
    await loadScript("xlsx");
    const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
    const parts = [];
    for (const name of wb.SheetNames) {
        const ws   = wb.Sheets[name];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (!rows.length) continue;
        const cell    = c => String(c).trim().replace(/\|/g, "\\|");
        const toRow   = r => "| " + r.map(cell).join(" | ") + " |";
        const header  = toRow(rows[0]);
        const divider = "| " + rows[0].map(() => "---").join(" | ") + " |";
        const body    = rows.slice(1).map(toRow);
        parts.push(`## ${name}\n\n${[header, divider, ...body].join("\n")}`);
    }
    return parts.join("\n\n");
}

async function convertHtml(text) {
    await loadScript("turndown");
    const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });
    return td.turndown(text).trim();
}

function parseCsvRow(row) {
    const fields = [];
    let cur = "", inQ = false;
    for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '"') {
            if (inQ && row[i + 1] === '"') { cur += '"'; i++; }
            else inQ = !inQ;
        } else if (ch === ',' && !inQ) {
            fields.push(cur.trim().replace(/\|/g, "\\|"));
            cur = "";
        } else {
            cur += ch;
        }
    }
    fields.push(cur.trim().replace(/\|/g, "\\|"));
    return fields;
}

function convertCsv(text) {
    const rows = text.split("\n").filter(r => r.trim());
    if (!rows.length) return "";
    const toRow   = r => "| " + parseCsvRow(r).join(" | ") + " |";
    const header  = toRow(rows[0]);
    const divider = "| " + parseCsvRow(rows[0]).map(() => "---").join(" | ") + " |";
    const body    = rows.slice(1).map(toRow);
    return [header, divider, ...body].join("\n");
}

async function downloadSelectedAsZip() {
    const cards = [...resultsEl.querySelectorAll(".result-card")]
        .filter(c => c.style.display !== "none" && c.querySelector(".result-checkbox").checked);
    if (!cards.length) return;

    const zip = new JSZip();
    for (const card of cards) {
        const content = card.querySelector(".result-textarea").value;
        if (!content.trim()) continue;
        const base = card.dataset.filename.replace(/\.[^.]+$/, "");
        zip.file(base + ".md", content);
    }

    setStatus("Preparing ZIP...", "working");
    const blob = await zip.generateAsync({ type: "blob" });
    setStatus("Ready. Drop files to convert.", "ready");
    const now   = new Date();
    const pad   = n => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const anchor = document.createElement("a");
    anchor.href     = URL.createObjectURL(blob);
    anchor.download = `markdrop_${stamp}.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(anchor.href);
}

preload();
