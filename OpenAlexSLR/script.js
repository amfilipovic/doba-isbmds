
const OPENALEX_BASE = "https://api.openalex.org/works";
const MAILTO        = "amfilipovic@gmail.com";
const SELECT_FIELDS = "id,title,authorships,publication_year,primary_location,abstract_inverted_index,type,doi,open_access";

const TYPE_LABELS = {
    "article":      "Article",
    "book-chapter": "Book Chapter",
    "preprint":     "Preprint",
    "dissertation": "Dissertation",
    "book":         "Book",
    "dataset":      "Dataset",
    "review":       "Review",
    "other":        "Other",
};

const VALID_THEMES = new Set(["paper","cipher","ember","frost","void","dusk","sand","rose","ocean","mist"]);

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

function updateFavicon(theme) {
    const { background, accent } = THEME_COLORS[theme] || THEME_COLORS.paper;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="${background}"/><circle cx="16" cy="13" r="6" fill="none" stroke="${accent}" stroke-width="2"/><path d="M20.5 18.5L26 24" stroke="${accent}" stroke-width="2.2" stroke-linecap="round"/></svg>`;
    document.querySelectorAll("link[rel='icon']").forEach(l => l.remove());
    const link = document.createElement("link");
    link.rel   = "icon";
    link.type  = "image/svg+xml";
    link.href  = "data:image/svg+xml," + encodeURIComponent(svg);
    document.head.appendChild(link);
}

let _lsTheme = "paper";
try { _lsTheme = localStorage.getItem("openalexslr-theme") || "paper"; } catch (_) {}
const savedTheme = VALID_THEMES.has(_lsTheme) ? _lsTheme : "paper";
const activeDot  = document.querySelector(`.dot[data-theme="${savedTheme}"]`);
if (activeDot) {
    document.documentElement.setAttribute("data-theme", savedTheme);
    document.getElementById("theme-name").textContent = activeDot.dataset.label;
    document.querySelectorAll(".dot").forEach(d => d.classList.remove("active"));
    activeDot.classList.add("active");
}
updateFavicon(savedTheme);

const statusEl        = document.getElementById("status");
const conceptsEl      = document.getElementById("concepts");
const addConceptBtn   = document.getElementById("add-concept-btn");
const yearFromEl      = document.getElementById("year-from");
const yearToEl        = document.getElementById("year-to");
const pubTypeEl       = document.getElementById("pub-type");
const perPageEl       = document.getElementById("per-page");
const searchBtn       = document.getElementById("search-btn");
const queryPreviewEl  = document.getElementById("query-preview");
const resultsCountEl  = document.getElementById("results-count");
const selectAllBtn    = document.getElementById("select-all-btn");
const exportCsvBtn    = document.getElementById("export-csv-btn");
const exportRisBtn    = document.getElementById("export-ris-btn");
const resetBtn        = document.getElementById("reset-btn");
const saveQueryBtn    = document.getElementById("save-query-btn");
const loadQueryInput  = document.getElementById("load-query-input");
const resultsEl       = document.getElementById("results");
const loadMoreBtn     = document.getElementById("load-more-btn");
const loadAllBtn      = document.getElementById("load-all-btn");
const filterInput     = document.getElementById("filter-input");
const h1CountEl       = document.getElementById("h1-count");

let allResults   = [];
let selectedIds  = new Set();
let totalResults = 0;
let currentPage  = 1;
let isLoading    = false;

function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.className   = cls || "";
}

function addConceptRow(isFirst = false, suppressFocus = false) {
    const row = document.createElement("div");
    row.className = "concept-row";

    if (!isFirst) {
        const connSel = document.createElement("select");
        connSel.className = "connector-sel";
        ["AND", "OR", "NOT"].forEach(v => {
            const opt       = document.createElement("option");
            opt.value       = v;
            opt.textContent = v;
            connSel.appendChild(opt);
        });
        connSel.addEventListener("change", updatePreview);
        row.appendChild(connSel);
    }

    const termsInput        = document.createElement("input");
    termsInput.type         = "text";
    termsInput.className    = "terms-input";
    termsInput.placeholder  = "keywords, synonyms… (comma = OR within group)";
    termsInput.autocomplete = "off";
    termsInput.spellcheck   = false;
    termsInput.addEventListener("input", updatePreview);
    termsInput.addEventListener("keydown", e => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") runSearch();
    });
    row.appendChild(termsInput);

    const removeBtn             = document.createElement("button");
    removeBtn.className         = "remove-row-btn";
    removeBtn.textContent       = "×";
    removeBtn.title             = "Remove concept";
    removeBtn.setAttribute("aria-label", "Remove concept");
    removeBtn.addEventListener("click", () => {
        row.remove();
        updateRowControls();
        updatePreview();
    });
    row.appendChild(removeBtn);

    conceptsEl.appendChild(row);
    updateRowControls();
    updatePreview();
    if (!isFirst && !suppressFocus) termsInput.focus();
}

function updateRowControls() {
    const rows = conceptsEl.querySelectorAll(".concept-row");
    rows.forEach(row => {
        const btn = row.querySelector(".remove-row-btn");
        if (btn) btn.hidden = rows.length === 1;
    });
}

function buildQuery() {
    const rows         = conceptsEl.querySelectorAll(".concept-row");
    const searchParts  = [];
    const filterParts  = [];
    const previewLines = [];

    rows.forEach((row, i) => {
        const terms = row.querySelector(".terms-input").value.trim();
        const conn  = row.querySelector(".connector-sel")?.value || "AND";
        if (!terms) return;

        const termList = terms.split(",").map(t => t.trim()).filter(Boolean);
        const orGroup  = termList.length > 1
            ? `(${termList.map(t => t.includes(" ") ? `"${t}"` : t).join(" OR ")})`
            : (termList[0].includes(" ") ? `"${termList[0]}"` : termList[0]);

        searchParts.push(searchParts.length === 0 ? orGroup : `${conn} ${orGroup}`);
        previewLines.push({ conn: searchParts.length === 1 ? "SEARCH" : conn, text: termList.join(" OR ") });
    });

    const yearFrom = yearFromEl.value.trim();
    const yearTo   = yearToEl.value.trim();
    if (yearFrom) {
        filterParts.push(`from_publication_date:${yearFrom}-01-01`);
        previewLines.push({ conn: "FILTER", text: `year from ${yearFrom}` });
    }
    if (yearTo) {
        filterParts.push(`to_publication_date:${yearTo}-12-31`);
        previewLines.push({ conn: "FILTER", text: `year to ${yearTo}` });
    }

    const pubType = pubTypeEl.value;
    if (pubType !== "all") {
        filterParts.push(`type:${pubType}`);
        previewLines.push({ conn: "FILTER", text: `type: ${TYPE_LABELS[pubType] || pubType}` });
    }

    return {
        searchStr:    searchParts.join(" "),
        filterStr:    filterParts.join(","),
        previewLines,
    };
}

function updatePreview() {
    const { searchStr, previewLines } = buildQuery();
    queryPreviewEl.innerHTML = "";
    previewLines.forEach(({ conn, text }) => {
        const line     = document.createElement("div");
        line.className = "preview-line";
        const connSpan       = document.createElement("span");
        connSpan.className   = "preview-connector";
        connSpan.textContent = conn;
        const textSpan       = document.createElement("span");
        textSpan.className   = "preview-clause";
        textSpan.textContent = text;
        line.appendChild(connSpan);
        line.appendChild(textSpan);
        queryPreviewEl.appendChild(line);
    });
    saveQueryBtn.disabled = !searchStr;
}

function applyFilter() {
    const q = filterInput.value.trim().toLowerCase();
    resultsEl.querySelectorAll(".result-card").forEach(card => {
        const match = !q || (card.dataset.search || "").includes(q);
        card.style.display = match ? "" : "none";
    });
    updateToolbar();
}

const TITLE_TAGS = new Set(["b", "i", "em", "strong", "tt", "code", "sub", "sup"]);

function sanitizeTitle(html) {
    const normalized = html.replace(/ : /g, ": ");
    const doc = new DOMParser().parseFromString(normalized, "text/html");
    doc.body.querySelectorAll("*").forEach(el => {
        if (!TITLE_TAGS.has(el.tagName.toLowerCase())) {
            el.replaceWith(...Array.from(el.childNodes));
        }
    });
    const frag = document.createDocumentFragment();
    frag.append(...Array.from(doc.body.childNodes));
    return frag;
}

function titlePlain(work) {
    if (!work.title) return "";
    const doc = new DOMParser().parseFromString(work.title, "text/html");
    return (doc.body.textContent || "").replace(/ : /g, ": ").trim();
}

function reconstructAbstract(inv) {
    if (!inv) return "";
    const arr = [];
    for (const [word, positions] of Object.entries(inv)) {
        for (const pos of positions) arr[pos] = word;
    }
    return arr.join(" ");
}

function formatAuthors(authorships) {
    if (!authorships?.length) return "";
    const names = authorships.map(a => a.author?.display_name).filter(Boolean);
    if (!names.length) return "";
    if (names.length <= 3) return names.join(", ");
    return names.slice(0, 3).join(", ") + " et al.";
}

function getSource(work) {
    return work.primary_location?.source?.display_name || "";
}

function renderResult(work) {
    const card      = document.createElement("div");
    card.className  = "result-card";
    card.dataset.id = work.id;
    card.dataset.search = [
        titlePlain(work),
        formatAuthors(work.authorships),
        getSource(work),
        reconstructAbstract(work.abstract_inverted_index) || "",
    ].join(" ").toLowerCase();

    const checkbox    = document.createElement("input");
    checkbox.type     = "checkbox";
    checkbox.className = "result-checkbox";
    checkbox.checked  = selectedIds.has(work.id);
    checkbox.setAttribute("aria-label", "Select result");
    checkbox.addEventListener("change", () => toggleSelection(work.id, card, checkbox));
    card.appendChild(checkbox);

    const body      = document.createElement("div");
    body.className  = "result-body";

    const titleEl   = document.createElement("div");
    titleEl.className = "result-title";
    const titleLink   = document.createElement("a");
    titleLink.append(sanitizeTitle(work.title || "(no title)"));
    titleLink.href        = work.doi || work.id || "#";
    titleLink.target      = "_blank";
    titleLink.rel         = "noopener";
    titleEl.appendChild(titleLink);
    body.appendChild(titleEl);

    const metaParts = [];
    if (work.publication_year) metaParts.push(work.publication_year);
    const authors   = formatAuthors(work.authorships);
    if (authors)               metaParts.push(authors);
    const source = getSource(work);
    if (source) metaParts.push(source);
    const metaEl      = document.createElement("div");
    metaEl.className  = "result-meta";
    metaEl.textContent = metaParts.join(" · ");
    body.appendChild(metaEl);

    const abstract = reconstructAbstract(work.abstract_inverted_index);
    if (abstract) {
        const absEl     = document.createElement("div");
        absEl.className = "result-abstract";
        const SHORT     = 240;
        if (abstract.length <= SHORT) {
            absEl.textContent = abstract;
        } else {
            let expanded      = false;
            const short       = abstract.slice(0, SHORT).replace(/\S+$/, "").trimEnd();
            const textNode    = document.createTextNode(short + "… ");
            absEl.appendChild(textNode);
            const moreBtn         = document.createElement("button");
            moreBtn.className     = "abstract-more";
            moreBtn.textContent   = "Show more";
            moreBtn.addEventListener("click", () => {
                expanded           = !expanded;
                textNode.textContent = expanded ? abstract + " " : short + "… ";
                moreBtn.textContent  = expanded ? "Show less" : "Show more";
            });
            absEl.appendChild(moreBtn);
        }
        body.appendChild(absEl);
    }

    const badges      = document.createElement("div");
    badges.className  = "result-badges";
    if (work.type) {
        const b       = document.createElement("span");
        b.className   = `badge badge-type-${work.type}`;
        b.textContent = TYPE_LABELS[work.type] || work.type;
        badges.appendChild(b);
    }
    if (work.open_access?.is_oa) {
        const b       = document.createElement("span");
        b.className   = "badge badge-oa";
        b.textContent = "Open Access";
        badges.appendChild(b);
    }
    body.appendChild(badges);
    card.appendChild(body);
    return card;
}

function toggleSelection(id, card, checkbox) {
    if (selectedIds.has(id)) {
        selectedIds.delete(id);
        card.classList.remove("selected");
        checkbox.checked = false;
    } else {
        selectedIds.add(id);
        card.classList.add("selected");
        checkbox.checked = true;
    }
    updateToolbar();
}

function updateToolbar() {
    const loaded  = allResults.length;
    const sel     = selectedIds.size;
    if (!loaded) {
        resultsCountEl.textContent = "";
        h1CountEl.textContent      = "";
        selectAllBtn.disabled      = true;
        exportCsvBtn.disabled      = true;
        exportRisBtn.disabled      = true;
        selectAllBtn.textContent   = "Select all";
        exportCsvBtn.textContent   = "CSV (all)";
        exportRisBtn.textContent   = "RIS (all)";
        loadMoreBtn.hidden         = true;
        loadAllBtn.hidden          = true;
        filterInput.disabled       = true;
        filterInput.value          = "";
        return;
    }
    filterInput.disabled  = false;
    selectAllBtn.disabled = false;
    exportCsvBtn.disabled = false;
    exportRisBtn.disabled = false;
    const visibleCards  = [...resultsEl.querySelectorAll(".result-card")].filter(c => c.style.display !== "none");
    const visible       = visibleCards.length;
    const allVisibleSel = visible > 0 && visibleCards.every(c => selectedIds.has(c.dataset.id));
    const base      = loaded < totalResults ? `${loaded.toLocaleString()} / ${totalResults.toLocaleString()}` : `${totalResults.toLocaleString()}`;
    const matchNote = visible < loaded ? ` (${visible.toLocaleString()} match)` : "";
    resultsCountEl.textContent = base + matchNote;
    h1CountEl.textContent      = " · " + totalResults.toLocaleString();
    selectAllBtn.textContent   = allVisibleSel ? "Deselect all" : "Select all";
    exportCsvBtn.textContent   = sel > 0 ? `CSV (${sel})` : "CSV (all)";
    exportRisBtn.textContent   = sel > 0 ? `RIS (${sel})` : "RIS (all)";
}

async function runSearch(page = 1) {
    if (isLoading) return;
    const { searchStr, filterStr } = buildQuery();
    if (!searchStr) { setStatus("Add at least one search term.", "error"); return; }

    const yf = parseInt(yearFromEl.value);
    const yt = parseInt(yearToEl.value);
    if (yearFromEl.value && yearToEl.value && yf > yt) {
        setStatus("Year from must not be after year to.", "error");
        return;
    }

    isLoading          = true;
    searchBtn.disabled = true;
    loadMoreBtn.hidden = true;
    setStatus("Searching...", "working");

    if (page === 1) {
        allResults              = [];
        selectedIds             = new Set();
        totalResults            = 0;
        currentPage             = 1;
        resultsEl.innerHTML     = "";
        resultsCountEl.textContent = "";
        selectAllBtn.disabled   = true;
        exportCsvBtn.disabled   = true;
        exportRisBtn.disabled   = true;
        h1CountEl.textContent   = "";
        filterInput.disabled    = true;
        filterInput.value       = "";
        loadAllBtn.hidden       = true;
    }

    try {
        const params = new URLSearchParams({
            per_page: perPageEl.value,
            page,
            select:   SELECT_FIELDS,
            mailto:   MAILTO,
        });
        if (searchStr) params.set("search", searchStr);
        if (filterStr) params.set("filter", filterStr);

        const res  = await fetch(`${OPENALEX_BASE}?${params}`);
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        const data = await res.json();

        totalResults = data.meta?.count ?? 0;
        currentPage  = page;

        const works = data.results || [];
        allResults.push(...works);
        works.forEach(w => resultsEl.appendChild(renderResult(w)));

        applyFilter();
        const remaining         = totalResults - allResults.length;
        loadMoreBtn.hidden      = remaining <= 0;
        loadAllBtn.hidden       = remaining <= 0;
        const nextBatch         = Math.min(remaining, parseInt(perPageEl.value, 10));
        loadMoreBtn.textContent = `Load next ${nextBatch.toLocaleString()} (${remaining.toLocaleString()} remaining)`;
        loadAllBtn.textContent  = `Load all (${remaining.toLocaleString()} remaining)`;

        if (totalResults === 0 && page === 1) {
            const empty       = document.createElement("p");
            empty.className   = "results-empty";
            empty.textContent = "No results found for this query.";
            resultsEl.appendChild(empty);
        }
        setStatus("");
    } catch (e) {
        setStatus("Search failed: " + (e.message || "unknown error"), "error");
    } finally {
        isLoading          = false;
        searchBtn.disabled = false;
    }
}

function selectAllOrNone() {
    const visibleCards  = [...resultsEl.querySelectorAll(".result-card")].filter(c => c.style.display !== "none");
    const allVisibleSel = visibleCards.length > 0 && visibleCards.every(c => selectedIds.has(c.dataset.id));
    if (allVisibleSel) {
        visibleCards.forEach(card => {
            selectedIds.delete(card.dataset.id);
            card.classList.remove("selected");
            card.querySelector(".result-checkbox").checked = false;
        });
    } else {
        visibleCards.forEach(card => {
            selectedIds.add(card.dataset.id);
            card.classList.add("selected");
            card.querySelector(".result-checkbox").checked = true;
        });
    }
    updateToolbar();
}

function csvEscape(str) {
    return `"${String(str ?? "").replace(/"/g, '""')}"`;
}

function toCsv(works) {
    const headers = ["title", "authors", "year", "doi", "type", "source", "abstract", "openalex_id", "open_access"];
    const rows    = works.map(w => [
        csvEscape(titlePlain(w)),
        csvEscape(formatAuthors(w.authorships)),
        csvEscape(w.publication_year ?? ""),
        csvEscape(w.doi || ""),
        csvEscape(w.type || ""),
        csvEscape(getSource(w)),
        csvEscape(reconstructAbstract(w.abstract_inverted_index)),
        csvEscape(w.id || ""),
        csvEscape(w.open_access?.is_oa ? "yes" : "no"),
    ]);
    return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
}

const RIS_TYPES = {
    "article":      "JOUR",
    "book-chapter": "CHAP",
    "preprint":     "UNPB",
    "dissertation": "THES",
    "book":         "BOOK",
    "dataset":      "DATA",
    "review":       "JOUR",
    "other":        "GEN",
};

function toRis(works) {
    return works.map(w => {
        const ty    = RIS_TYPES[w.type] || "GEN";
        const lines = [`TY  - ${ty}`];
        const pt = titlePlain(w);
        if (pt)                  lines.push(`TI  - ${pt}`);
        (w.authorships || []).forEach(a => {
            if (a.author?.display_name) lines.push(`AU  - ${a.author.display_name}`);
        });
        if (w.publication_year)  lines.push(`PY  - ${w.publication_year}`);
        if (w.doi)               lines.push(`DO  - ${w.doi.replace("https://doi.org/", "")}`);
        const ab = reconstructAbstract(w.abstract_inverted_index);
        if (ab)                  lines.push(`AB  - ${ab}`);
        const src = getSource(w);
        if (src)                 lines.push(`JO  - ${src}`);
        if (w.id)                lines.push(`UR  - ${w.id}`);
        lines.push("ER  - ");
        return lines.join("\r\n");
    }).join("\r\n\r\n");
}

function nowStamp() {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}-${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}${String(d.getSeconds()).padStart(2,"0")}`;
}

function downloadFile(content, filename, type) {
    const blob  = new Blob([content], { type });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement("a");
    a.href      = url;
    a.download  = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function exportAs(format) {
    const works = selectedIds.size > 0
        ? allResults.filter(w => selectedIds.has(w.id))
        : allResults;
    if (!works.length) return;
    const stamp = nowStamp();
    if (format === "csv") {
        downloadFile(toCsv(works), `openalex-export-${stamp}.csv`, "text/csv");
    } else {
        downloadFile(toRis(works), `openalex-export-${stamp}.ris`, "application/x-research-info-systems");
    }
}

function resetAll() {
    conceptsEl.innerHTML = "";
    addConceptRow(true);
    yearFromEl.value = "";
    yearToEl.value   = "";
    pubTypeEl.value  = "all";
    allResults            = [];
    selectedIds           = new Set();
    totalResults          = 0;
    currentPage           = 1;
    resultsEl.innerHTML   = "";
    loadMoreBtn.hidden    = true;
    loadAllBtn.hidden     = true;
    h1CountEl.textContent = "";
    setStatus("");
    updateToolbar();
    updatePreview();
}

async function loadAll() {
    const remaining = totalResults - allResults.length;
    const perPage   = parseInt(perPageEl.value, 10);
    const pages     = Math.ceil(remaining / perPage);
    const ok = confirm(`Load all ${remaining.toLocaleString()} remaining results? This will make approximately ${pages} additional request${pages !== 1 ? "s" : ""} and may take a while for large result sets.`);
    if (!ok) return;
    loadAllBtn.disabled  = true;
    searchBtn.disabled   = true;
    let prev = allResults.length;
    while (allResults.length < totalResults) {
        await runSearch(currentPage + 1);
        if (allResults.length === prev) break;
        prev = allResults.length;
        if (allResults.length < totalResults) {
            searchBtn.disabled = true;
            loadMoreBtn.hidden = true;
        }
    }
    loadAllBtn.disabled = false;
}

function exportQuery() {
    const rows    = conceptsEl.querySelectorAll(".concept-row");
    const concepts = Array.from(rows).map(row => ({
        terms:     row.querySelector(".terms-input").value,
        connector: row.querySelector(".connector-sel")?.value || null,
    }));
    if (!concepts.some(c => c.terms.trim())) return;
    const payload = {
        version:  1,
        concepts,
        filters: {
            yearFrom: yearFromEl.value,
            yearTo:   yearToEl.value,
            type:     pubTypeEl.value,
            perPage:  perPageEl.value,
        },
    };
    const stamp = nowStamp();
    downloadFile(JSON.stringify(payload, null, 2), `openalex-query-${stamp}.json`, "application/json");
}

function importQuery(file) {
    const reader    = new FileReader();
    reader.onload   = e => {
        try {
            const payload = JSON.parse(e.target.result);
            if (!payload.concepts?.length) throw new Error("No concepts found in file.");

            conceptsEl.innerHTML = "";
            payload.concepts.forEach((c, i) => {
                addConceptRow(i === 0, true);
                const row       = conceptsEl.lastElementChild;
                const input     = row.querySelector(".terms-input");
                const connSel   = row.querySelector(".connector-sel");
                input.value     = c.terms || "";
                if (connSel && c.connector) connSel.value = c.connector;
            });

            if (payload.filters) {
                yearFromEl.value = payload.filters.yearFrom || "";
                yearToEl.value   = payload.filters.yearTo   || "";
                pubTypeEl.value  = payload.filters.type     || "all";
                perPageEl.value  = payload.filters.perPage  || "25";
            }

            updatePreview();
            setStatus("Query loaded.", "ready");
        } catch (err) {
            setStatus("Could not load query: " + err.message, "error");
        }
    };
    reader.readAsText(file);
}

document.querySelectorAll(".dot").forEach(dot => {
    dot.addEventListener("click", () => {
        const theme = dot.dataset.theme;
        document.documentElement.setAttribute("data-theme", theme);
        document.getElementById("theme-name").textContent = dot.dataset.label;
        document.querySelectorAll(".dot").forEach(d => d.classList.remove("active"));
        dot.classList.add("active");
        updateFavicon(theme);
        try { localStorage.setItem("openalexslr-theme", theme); } catch (_) {}
    });
});

addConceptBtn.addEventListener("click",   () => addConceptRow(false));
searchBtn.addEventListener("click",       () => runSearch(1));
loadMoreBtn.addEventListener("click",     () => runSearch(currentPage + 1));
loadAllBtn.addEventListener("click",      loadAll);
filterInput.addEventListener("input",     applyFilter);
selectAllBtn.addEventListener("click",    selectAllOrNone);
exportCsvBtn.addEventListener("click",    () => exportAs("csv"));
exportRisBtn.addEventListener("click",    () => exportAs("ris"));
resetBtn.addEventListener("click",        resetAll);
saveQueryBtn.addEventListener("click",    exportQuery);
loadQueryInput.addEventListener("change", e => {
    if (e.target.files[0]) { importQuery(e.target.files[0]); e.target.value = ""; }
});
yearFromEl.addEventListener("input",      updatePreview);
yearToEl.addEventListener("input",        updatePreview);
pubTypeEl.addEventListener("change",      updatePreview);

document.addEventListener("keydown", e => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") runSearch(1);
});

addConceptRow(true);
