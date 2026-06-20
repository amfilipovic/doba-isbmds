
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

const JSZIP_URL   = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
const PPTXGEN_URL = "https://cdn.jsdelivr.net/npm/pptxgenjs@3.11.0/dist/pptxgen.min.js";
let jszipLoaded   = false;
let pptxgenLoaded = false;

function updateFavicon(theme) {
    const { background, accent } = THEME_COLORS[theme] || THEME_COLORS.paper;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="${background}"/><rect x="4" y="8" width="24" height="16" rx="2" fill="none" stroke="${accent}" stroke-width="1.8"/><path d="M10 14h12M10 18h8" stroke="${accent}" stroke-width="1.5" stroke-linecap="round"/></svg>`;
    document.querySelectorAll("link[rel='icon']").forEach(l => l.remove());
    const link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    link.href = "data:image/svg+xml," + encodeURIComponent(svg);
    document.head.appendChild(link);
}

function loadScript(url) {
    return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = url;
        s.onload  = resolve;
        s.onerror = () => reject(new Error("Failed to load: " + url));
        document.head.appendChild(s);
    });
}

async function loadPptxGen() {
    if (pptxgenLoaded) return;
    if (!jszipLoaded) {
        await loadScript(JSZIP_URL);
        jszipLoaded = true;
    }
    await loadScript(PPTXGEN_URL);
    pptxgenLoaded = true;
}

function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.className = cls || "";
}

function slugify(str) {
    return str.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim() || "presentation";
}

const statusEl      = document.getElementById("status");
const editorEl      = document.getElementById("editor");
const fileInput     = document.getElementById("file-input");
const loadBtn       = document.getElementById("load-btn");
const clearBtn      = document.getElementById("clear-btn");
const convertBtn    = document.getElementById("convert-btn");
const filenameEl    = document.getElementById("filename-input");
const editorStatsEl = document.getElementById("editor-stats");
const h1CountEl     = document.getElementById("h1-count");
const previewEl     = document.getElementById("preview");
const pptxThemeBtns = [...document.querySelectorAll(".pptx-theme-btn")];
const helpBtn       = document.getElementById("help-btn");
const helpPopover   = document.getElementById("help-popover");

const VALID_EDITOR_THEMES = new Set(["paper","cipher","ember","frost","void","dusk","sand","rose","ocean","mist"]);
const VALID_PPTX_THEMES   = new Set(["theme","light","dark","minimal"]);

let _lsEditorTheme = "paper";
let _lsPptxTheme   = "theme";
let _lsContent     = null;
try {
    _lsEditorTheme = localStorage.getItem("md2pptx-theme")      || "paper";
    _lsPptxTheme   = localStorage.getItem("md2pptx-pptx-theme") || "theme";
    _lsContent     = localStorage.getItem("md2pptx-content");
} catch (_) {}

let slides         = [];
let pptxTheme      = VALID_PPTX_THEMES.has(_lsPptxTheme) ? _lsPptxTheme : "theme";
let debounceTimer  = null;
let filenameEdited = false;

const savedTheme = VALID_EDITOR_THEMES.has(_lsEditorTheme) ? _lsEditorTheme : "paper";
const activeDot  = document.querySelector(`.dot[data-theme="${savedTheme}"]`);
if (activeDot) {
    document.documentElement.setAttribute("data-theme", savedTheme);
    document.getElementById("theme-name").textContent = activeDot.dataset.label;
    document.querySelectorAll(".dot").forEach(d => d.classList.remove("active"));
    activeDot.classList.add("active");
}
updateFavicon(savedTheme);

if (_lsContent) editorEl.value = _lsContent;

const activePptxBtn = document.querySelector(`.pptx-theme-btn[data-pptx-theme="${pptxTheme}"]`);
if (activePptxBtn) {
    pptxThemeBtns.forEach(b => b.classList.remove("active"));
    activePptxBtn.classList.add("active");
}
previewEl.dataset.pptxTheme = pptxTheme;

function parseSlides(md) {
    if (!md.trim()) return [];
    const hasSeparator = /^---$/m.test(md);
    const chunks = hasSeparator
        ? md.split(/^---$/m).map(c => c.trim()).filter(Boolean)
        : md.split(/(?=^#{1,2} )/m).map(c => c.trim()).filter(Boolean);
    return chunks.map(parseSlideChunk).filter(Boolean);
}

function parseSlideChunk(chunk) {
    const lines = chunk.split("\n");
    let title   = "";
    const body  = [];
    const notes = [];
    let inNotes = false;
    let inCode  = false;

    for (const line of lines) {
        const t = line.trim();
        if (t.startsWith("```")) { inCode = !inCode; continue; }
        if (inCode) {
            if (t.startsWith("> ") || /^###\s*notes?:?\s*$/i.test(t)) { inCode = false; }
            else { if (t) body.push("    " + t); continue; }
            // falls through to process the note/notes-header line below
        }
        if (t.startsWith("<!--")) continue;
        if (!t) {
            if (body.length > 0 && body[body.length - 1] !== "") body.push("");
            continue;
        }
        if (!title && /^#{1,3} /.test(t)) {
            title = t.replace(/^#{1,3} /, "").trim();
            inNotes = false;
            continue;
        }
        if (/^###\s*notes?:?\s*$/i.test(t)) { inNotes = true; continue; }
        if (t.startsWith("> "))             { notes.push(t.slice(2).trim()); continue; }
        if (inNotes)                         { notes.push(t); continue; }
        body.push(t);
    }

    while (body.length && body[body.length - 1] === "") body.pop();
    if (!title && !body.length && !notes.length) return null;
    return { title, body, notes };
}

function inlineToHtml(text) {
    return text
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function stripInline(text) {
    return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
}

function inlineToPptxRuns(text) {
    const runs = [];
    const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
    let last = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) runs.push({ text: text.slice(last, m.index), options: {} });
        if (m[0].startsWith("**")) {
            runs.push({ text: m[1], options: { bold: true } });
        } else {
            runs.push({ text: m[2], options: { italic: true } });
        }
        last = m.index + m[0].length;
    }
    if (last < text.length) runs.push({ text: text.slice(last), options: {} });
    return runs.length ? runs : [{ text, options: {} }];
}

function getCurrentSlideIndex() {
    if (!slides.length) return 0;
    const val    = editorEl.value;
    const before = val.slice(0, editorEl.selectionStart);
    if (/^---$/m.test(val)) {
        return Math.min((before.match(/^---$/gm) || []).length, slides.length - 1);
    }
    const headings = before.match(/^#{1,2} /gm) || [];
    return Math.min(Math.max(0, headings.length - 1), slides.length - 1);
}

function renderPreview() {
    previewEl.innerHTML = "";
    if (!slides.length) {
        const placeholderSlides = parseSlides(editorEl.placeholder);
        const raw = placeholderSlides[0] || { title: "Slide title", body: ["Body text"], notes: [] };
        const ghost = createSlideCard({ ...raw, notes: [] }, 1);
        ghost.classList.add("slide-card-ghost");
        previewEl.appendChild(ghost);
        return;
    }
    const active = getCurrentSlideIndex();
    slides.forEach((slide, i) => {
        const card = createSlideCard(slide, i + 1);
        if (i === active) card.classList.add("active-slide");
        previewEl.appendChild(card);
    });
    const activeCard = previewEl.children[active];
    if (activeCard) activeCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function createSlideCard(slide, num) {
    const card = document.createElement("div");
    card.className = "slide-card";

    const numEl = document.createElement("span");
    numEl.className = "slide-card-number";
    numEl.textContent = num;
    card.appendChild(numEl);

    if (slide.title) {
        const titleEl = document.createElement("div");
        titleEl.className = "slide-card-title";
        titleEl.innerHTML = inlineToHtml(slide.title);
        card.appendChild(titleEl);
    }

    if (slide.body.length) {
        const bodyEl = document.createElement("div");
        bodyEl.className = "slide-card-body";
        let i = 0;
        while (i < slide.body.length) {
            const l = slide.body[i];
            if (/^[-*] /.test(l)) {
                const ul = document.createElement("ul");
                while (i < slide.body.length && /^[-*] /.test(slide.body[i])) {
                    const li = document.createElement("li");
                    li.innerHTML = inlineToHtml(slide.body[i].slice(2));
                    ul.appendChild(li);
                    i++;
                }
                bodyEl.appendChild(ul);
            } else if (/^\d+\. /.test(l)) {
                const ol = document.createElement("ol");
                while (i < slide.body.length && /^\d+\. /.test(slide.body[i])) {
                    const li = document.createElement("li");
                    li.innerHTML = inlineToHtml(slide.body[i].replace(/^\d+\. /, ""));
                    ol.appendChild(li);
                    i++;
                }
                bodyEl.appendChild(ol);
            } else if (l.startsWith("    ")) {
                const pre = document.createElement("pre");
                pre.className = "slide-card-code";
                while (i < slide.body.length && slide.body[i].startsWith("    ")) {
                    pre.appendChild(document.createTextNode(slide.body[i].slice(4) + "\n"));
                    i++;
                }
                bodyEl.appendChild(pre);
            } else if (l === "") {
                const spacer = document.createElement("div");
                spacer.style.height = "0.3rem";
                bodyEl.appendChild(spacer);
                i++;
            } else {
                const p = document.createElement("p");
                p.innerHTML = inlineToHtml(l);
                bodyEl.appendChild(p);
                i++;
            }
        }
        card.appendChild(bodyEl);
    }

    if (slide.notes.length) {
        const badge = document.createElement("div");
        badge.className = "slide-card-notes-badge";
        badge.textContent = "▸ notes";
        card.appendChild(badge);

        const overlay = document.createElement("div");
        overlay.className = "slide-card-notes-overlay";
        overlay.textContent = slide.notes.join(" ");
        card.appendChild(overlay);
    }

    return card;
}

function getPptxColors() {
    const cs     = getComputedStyle(document.documentElement);
    const toHex  = v => (v.trim().startsWith("#") ? v.trim().slice(1) : v.trim()).padStart(6, "0");
    const accent = toHex(cs.getPropertyValue("--accent"));
    const r = parseInt(accent.slice(0, 2), 16);
    const g = parseInt(accent.slice(2, 4), 16);
    const b = parseInt(accent.slice(4, 6), 16);
    const lum = (r * 299 + g * 587 + b * 114) / 1000;
    switch (pptxTheme) {
        case "theme":   return { bg: toHex(cs.getPropertyValue("--bg")), title: accent, body: toHex(cs.getPropertyValue("--text")) };
        case "dark":    return { bg: "1a1a2e", title: lum > 200 ? "e0e0e0" : accent, body: "cccccc" };
        case "minimal": return { bg: "ffffff", title: "111111", body: "444444" };
        default:        return { bg: "ffffff", title: lum > 200 ? "222222" : accent, body: "333333" };
    }
}

async function generatePptx() {
    if (!slides.length) return;
    setStatus("Generating PPTX...", "working");
    convertBtn.disabled = true;

    try {
        await loadPptxGen();
        const colors   = getPptxColors();
        const filename = (filenameEl.value.trim() || "presentation") + ".pptx";
        const pptx     = new PptxGenJS();
        pptx.layout    = "LAYOUT_16x9";

        for (const slide of slides) {
            const s = pptx.addSlide();
            s.background = { fill: colors.bg };

            if (slide.title) {
                s.addText(stripInline(slide.title), {
                    x: 0.4, y: 0.25, w: 9.2, h: 1.1,
                    fontSize: 32, bold: true, color: colors.title, valign: "middle",
                });
            }

            if (slide.body.length) {
                const items = [];
                let lastWasBullet = false;
                let pendingSpaceBefore = false;
                slide.body.forEach(line => {
                    if (line === "") {
                        if (items.length > 0 && lastWasBullet) {
                            items.push({ text: " ", options: { bullet: true, fontSize: 1, paraSpaceBefore: 14 } });
                        } else if (items.length > 0) {
                            pendingSpaceBefore = true;
                        }
                        return;
                    }
                    const isBullet   = /^[-*] /.test(line);
                    const isNumbered = /^\d+\. /.test(line);
                    const text = isBullet ? line.slice(2) : isNumbered ? line.replace(/^\d+\. /, "") : line;
                    const runs = inlineToPptxRuns(text);
                    if (isBullet || isNumbered) {
                        runs[0] = { text: runs[0].text, options: { ...runs[0].options, bullet: true, ...(pendingSpaceBefore ? { paraSpaceBefore: 14 } : {}) } };
                        lastWasBullet = true;
                    } else {
                        if (items.length > 0) {
                            const prev = items[items.length - 1];
                            prev.options = { ...prev.options, breakLine: true };
                        }
                        if (pendingSpaceBefore) {
                            runs[0] = { text: runs[0].text, options: { ...runs[0].options, paraSpaceBefore: 14 } };
                        }
                        lastWasBullet = false;
                    }
                    pendingSpaceBefore = false;
                    items.push(...runs);
                });
                s.addText(items, {
                    x: 0.4, y: slide.title ? 1.5 : 0.4, w: 9.2, h: slide.title ? 3.8 : 5.0,
                    fontSize: 18, color: colors.body, valign: "top",
                });
            }

            if (slide.notes.length) s.addNotes(slide.notes.join("\n"));
        }

        await pptx.writeFile({ fileName: filename });
        setStatus("Ready.", "ready");
    } catch (e) {
        setStatus("Error: " + (e.message || "PPTX generation failed"), "error");
    } finally {
        convertBtn.disabled = slides.length === 0;
    }
}

function handleToolbarAction(action) {
    const prefixes = { h1: "\n# ", h2: "\n## ", h3: "\n### ", break: "\n\n---\n\n", bullet: "\n- ", numbered: "\n1. ", note: "\n> " };
    if (action in prefixes) { insertAtCursor(prefixes[action]); return; }
    if (action === "bold")   { wrapSelection("**"); return; }
    if (action === "italic") { wrapSelection("*");  return; }
    if (action === "code")   { insertCodeBlock();   return; }
}

function insertCodeBlock() {
    const pos = editorEl.selectionStart;
    const val = editorEl.value;
    const block = "\n```\n\n```";
    editorEl.value = val.slice(0, pos) + block + val.slice(pos);
    editorEl.setSelectionRange(pos + 5, pos + 5);
    editorEl.focus();
    update();
}

function insertAtCursor(text) {
    const pos = editorEl.selectionStart;
    const val = editorEl.value;
    editorEl.value = val.slice(0, pos) + text + val.slice(pos);
    editorEl.setSelectionRange(pos + text.length, pos + text.length);
    editorEl.focus();
    update();
}

function wrapSelection(marker) {
    const start = editorEl.selectionStart;
    const end   = editorEl.selectionEnd;
    const val   = editorEl.value;
    const sel   = val.slice(start, end) || "text";
    editorEl.value = val.slice(0, start) + marker + sel + marker + val.slice(end);
    editorEl.setSelectionRange(start + marker.length, start + marker.length + sel.length);
    editorEl.focus();
    update();
}

function update() {
    slides = parseSlides(editorEl.value);
    renderPreview();

    convertBtn.disabled = slides.length === 0;

    h1CountEl.textContent = slides.length
        ? slides.length + (slides.length === 1 ? " slide" : " slides")
        : "";

    const words = editorEl.value.trim().split(/\s+/).filter(Boolean).length;
    const chars = editorEl.value.length;
    editorStatsEl.textContent = editorEl.value.trim()
        ? words.toLocaleString() + " words · " + chars.toLocaleString() + " chars"
        : "";

    if (!filenameEdited && slides.length && slides[0].title) {
        filenameEl.value = slugify(slides[0].title);
    }
    if (!filenameEdited && !slides.length) {
        filenameEl.value = "";
    }

    try { localStorage.setItem("md2pptx-content", editorEl.value); } catch (_) {}
}

document.querySelectorAll(".dot").forEach(dot => {
    dot.addEventListener("click", () => {
        const theme = dot.dataset.theme;
        document.documentElement.setAttribute("data-theme", theme);
        document.getElementById("theme-name").textContent = dot.dataset.label;
        document.querySelectorAll(".dot").forEach(d => d.classList.remove("active"));
        dot.classList.add("active");
        updateFavicon(theme);
        try { localStorage.setItem("md2pptx-theme", theme); } catch (_) {}
    });
});

document.querySelectorAll(".tool-btn[data-action]").forEach(btn => {
    btn.addEventListener("click", () => handleToolbarAction(btn.dataset.action));
});

pptxThemeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        pptxTheme = btn.dataset.pptxTheme;
        pptxThemeBtns.forEach(b => b.classList.toggle("active", b === btn));
        previewEl.dataset.pptxTheme = pptxTheme;
        try { localStorage.setItem("md2pptx-pptx-theme", pptxTheme); } catch (_) {}
    });
});

editorEl.addEventListener("keydown", e => {
    if (e.key === "Tab") {
        e.preventDefault();
        insertAtCursor("  ");
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        generatePptx();
    }
});

editorEl.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(update, 150);
});

editorEl.addEventListener("click", () => {
    if (slides.length) renderPreview();
});

editorEl.addEventListener("dragover",  e => { e.preventDefault(); editorEl.classList.add("dragover"); });
editorEl.addEventListener("dragleave", () => editorEl.classList.remove("dragover"));
editorEl.addEventListener("drop", e => {
    e.preventDefault();
    editorEl.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload  = ev => { editorEl.value = ev.target.result; filenameEdited = false; update(); };
    reader.onerror = ()  => setStatus("Could not read file.", "error");
    reader.readAsText(file, "utf-8");
});

filenameEl.addEventListener("input", () => { filenameEdited = true; });

loadBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload  = e  => { editorEl.value = e.target.result; filenameEdited = false; fileInput.value = ""; update(); };
    reader.onerror = () => setStatus("Could not read file.", "error");
    reader.readAsText(file, "utf-8");
});

clearBtn.addEventListener("click", () => {
    editorEl.value = "";
    filenameEl.value = "";
    filenameEdited = false;
    try { localStorage.removeItem("md2pptx-content"); } catch (_) {}
    update();
    editorEl.focus();
});

convertBtn.addEventListener("click", generatePptx);

helpBtn.addEventListener("click", e => {
    e.stopPropagation();
    helpPopover.hidden = !helpPopover.hidden;
});
document.addEventListener("click", e => {
    if (!helpPopover.hidden && !helpPopover.contains(e.target)) helpPopover.hidden = true;
});
document.addEventListener("keydown", e => {
    if (e.key === "Escape") helpPopover.hidden = true;
});

async function preload() {
    try {
        await loadPptxGen();
        setStatus("Ready. Write or load a Markdown file.", "ready");
        update();
    } catch (e) {
        setStatus("Failed to load libraries. Check your connection and reload.", "error");
    }
}

preload();
