# markdrop

![demo](docs/demo.gif)

![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-browser-lightgrey.svg)
![Dependencies](https://img.shields.io/badge/dependencies-CDN-blue.svg)

## Overview

`markdrop` is a browser-based document converter. Drop files onto the page and the Markdown appears immediately, ready to copy or save. No installation, no account, no command line required.

Supported formats: PPTX, DOCX, PDF, XLSX, HTML, CSV, JSON, XML, and plain text. All conversion runs locally in the browser using JavaScript libraries loaded from CDN on first visit. Nothing is sent to any server.

## Background

The doctoral programme involves a lot of material in a lot of formats: lecture presentations, research papers, course handouts, exported data, and documents shared across the cohort. Converting all of it to Markdown by hand is not practical, and that is the problem [mdall](https://github.com/amfilipovic/mdall) was built to solve. It handles batch conversion across formats and works well, but it assumes Python is installed and that the person running it is comfortable with a terminal.

That assumption does not hold for everyone. Conversations with fellow students made that clear quickly. The tools drew interest, the workflow made sense to people, but the moment the terminal came up the interest stalled. Not because the tools were complicated, but because setting up a Python environment and running a command is not something everyone has done or wants to learn just to convert a few files.

`markdrop` is the answer to that. No installation, no environment, no command line. Open the page, drop the files, copy the result. The conversion runs entirely in the browser, so there is nothing to set up and nothing to share with a server.

## Demo

The `demo/` directory contains sample input files and their markdrop output.

| Input | Output |
| --- | --- |
| [demo-document.docx](demo/demo-document.docx) | [demo-document.md](demo/demo-document.md) |
| [demo-paper.pdf](demo/demo-paper.pdf) | [demo-paper.md](demo/demo-paper.md) |
| [demo-presentation.pptx](demo/demo-presentation.pptx) | [demo-presentation.md](demo/demo-presentation.md) |
| [demo-spreadsheet.xlsx](demo/demo-spreadsheet.xlsx) | [demo-spreadsheet.md](demo/demo-spreadsheet.md) |
| [demo-text.txt](demo/demo-text.txt) | [demo-text.md](demo/demo-text.md) |

## Usage

Open `index.html` in a browser, or visit the hosted version via GitHub Pages. On first load the page fetches the required JavaScript libraries from CDN (a few seconds). Once the status line reads `Ready`, drag one or more files onto the drop zone, or click to open a file picker. Each file is converted immediately and appears as a result card below.

Multiple files can be dropped at once and are processed in sequence. When two or more results are present, a toolbar appears above them with controls for sorting (by date added or filename), collapsing and expanding cards, filtering by filename or file type, and selecting cards for batch download as a ZIP archive. A summary line shows the total file count, line count, word count, and size across all converted files, plus slide count for PPTX and sheet count for XLSX when present.

## Supported formats

| Format | Extension | Method |
| --- | --- | --- |
| CSV | `.csv` | Native, converted to Markdown table |
| Excel | `.xlsx` | SheetJS, converted to Markdown tables |
| HTML | `.html`, `.htm` | Turndown.js |
| JSON | `.json` | Native, wrapped in fenced code block |
| PDF | `.pdf` | pdf.js text extraction |
| Plain text | `.txt` | Native |
| PowerPoint | `.pptx` | JSZip XML parsing, slide text and speaker notes |
| Word | `.docx` | mammoth.js |
| XML | `.xml` | Native, wrapped in fenced code block |

## Output

Each converted file appears as a result card showing the filename, a stats line with line count, word count, and file size, and a textarea with the Markdown output. Cards can be collapsed to a single summary row. Use `Copy` to copy to clipboard or `Save .md` to download with the original filename and a `.md` extension. Selected cards can be downloaded together as a timestamped ZIP file.

The output format depends on the file type: Word documents and HTML pages become standard Markdown with headings, lists, and inline formatting preserved. Spreadsheets produce Markdown tables, one per sheet. CSV files are treated the same way, with the first row as the header. PowerPoint slides are extracted with slide numbers, titles, body text, and speaker notes. JSON and XML are wrapped in fenced code blocks. Plain text passes through as-is.

## Files

1. `index.html`: The page structure, theme bar, drop zone, and results area.
2. `style.css`: All ten colour themes and layout.
3. `script.js`: File reading, format detection, conversion logic, and UI behaviour.
4. `demo/`: Sample input files and their converted Markdown output.

## Dependencies

| Library | Version | Purpose |
| --- | --- | --- |
| [mammoth.js](https://github.com/mwilliamson/mammoth.js) | 1.6.0 | DOCX to HTML conversion |
| [pdf.js](https://mozilla.github.io/pdf.js/) | 3.11.174 | PDF text extraction |
| [SheetJS](https://sheetjs.com) | 0.18.5 | XLSX parsing |
| [Turndown](https://github.com/mixmark-io/turndown) | 7.1.2 | HTML to Markdown conversion |
| [JSZip](https://stuk.github.io/jszip/) | 3.10.1 | ZIP file creation and PPTX parsing |

All libraries are loaded from CDN on first use. No installation required.

## Privacy

No data is sent to any server. All processing happens in your browser. The only network requests are the initial library fetches from [cdnjs](https://cdnjs.com) on first load.

## Notes

- PDF conversion extracts text layer only. Scanned PDFs without embedded text will produce empty output.
- PowerPoint conversion extracts text from slide shapes. Diagrams, charts, and embedded images are not converted.
- The page remembers your chosen colour theme across visits using `localStorage`.

## Contributions

Contributions are welcome! Feel free to submit issues or pull requests.
