# md2pptx

![demo](docs/demo.gif)

![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-browser-lightgrey.svg)
![Dependencies](https://img.shields.io/badge/dependencies-CDN-blue.svg)

## Overview

`md2pptx` is a browser-based Markdown to PowerPoint converter. Write or load a `.md` file, see a live slide preview, and download a `.pptx` file in one click. No installation, no account, no command line required.

## Background

The doctoral programme generates a steady output of written work: seminar papers, research summaries, project proposals, and presentations. Most of that writing happens in plain text or Markdown, where it is easy to version, search, and reuse. The problem is that the programme, like most academic settings, expects deliverables in PowerPoint format.

The usual path is to write in Markdown and then manually recreate the content in PowerPoint, which is repetitive and error-prone. Tools like [markdrop](../markdrop/) and [SlideNotesTTS](../SlideNotesTTS/) handle the opposite direction: converting existing presentations and documents into Markdown for study and audio. `md2pptx` closes the loop in the authoring direction, making it possible to write a presentation in plain text and export a proper `.pptx` file without ever opening PowerPoint.

The tool runs entirely in the browser so it fits into the same no-install, no-setup pattern as the rest of the toolset. The live preview and cursor-tracking keep the writing and the slide structure in sync as you work.

## Demo

The `demo/` directory contains a sample presentation on effective study techniques, along with the exported PPTX file. It covers the full feature set: headings, bullets, numbered lists, bold and italic text, plain paragraphs, and speaker notes.

## Usage

Open `index.html` in a browser. On first load the page fetches [JSZip](https://stuk.github.io/jszip/) and [PptxGenJS](https://gitbrent.github.io/PptxGenJS/) from CDN (a few seconds). Once the status line reads `Ready`, start writing or load a `.md` file. Click **Convert to PPTX** or press `Cmd/Ctrl+Enter` to download the presentation.

## Slide syntax

| Syntax | Result |
| --- | --- |
| `# Title` or `## Title` | New slide with that title |
| `---` on its own line | Explicit slide break |
| `- item` | Bullet point |
| `1. item` | Numbered list item |
| `**text**` | Bold |
| `*text*` | Italic |
| ` ``` ` ... ` ``` ` | Code block |
| `> text` | Speaker note |
| `### Notes:` followed by lines | Speaker notes section |

If no `---` separators are present, slides split automatically at each `#` or `##` heading. Speaker notes appear in PowerPoint's presenter view but not on the slide itself.

## Editor features

- **Toolbar**: insert headings, bold, italic, slide break, bullet, numbered list, code block, speaker note. The `?` button opens a syntax reference popover.
- **Live preview**: two-column slide grid updates as you type and highlights the slide at your cursor position. Preview colours reflect the selected PPTX scheme.
- **Drag and drop**: drag a `.md` file onto the editor area to load it.
- **Tab key**: inserts two spaces.
- **Keyboard shortcut**: `Cmd/Ctrl+Enter` triggers conversion.
- **Autosave**: content is saved to `localStorage` and restored on next visit.
- **Filename**: auto-filled from the first slide title, editable before converting.
- **Word and character count**: shown in the editor footer.

## PPTX colour schemes

Four schemes are available, each previewed live in the slide panel:

| Scheme | Description |
| --- | --- |
| Theme | Matches the active editor theme (background and accent colour) |
| Light | White background, accent-coloured titles |
| Dark | Dark navy background, light text |
| Minimal | White background, black titles, no accent |

## Editor themes

Ten themes available via the dot picker: Paper, Cipher, Ember, Frost, Void, Dusk, Sand, Rose, Ocean, Mist. The active editor theme and selected PPTX colour scheme are both saved to `localStorage` and restored on next visit.

## Files

1. `index.html`: Page structure, theme bar, toolbar, editor, and preview panel.
2. `style.css`: Ten colour themes, two-panel layout, and slide card styles.
3. `script.js`: Markdown parsing, live preview, PPTX generation, and all UI behaviour.
4. `demo/`: Sample presentation in Markdown and the exported PPTX output.

## Dependencies

| Library | Version | Purpose |
| --- | --- | --- |
| [PptxGenJS](https://gitbrent.github.io/PptxGenJS/) | 3.11.0 | PPTX file generation |
| [JSZip](https://stuk.github.io/jszip/) | 3.10.1 | ZIP packaging, required by PptxGenJS |

Both are loaded from CDN on first use. No installation required.

## Privacy

No data is sent to any server. All processing, including PPTX generation, happens in your browser. The only network requests are the initial library fetches from CDN on first load.

## Notes

- The `Theme` PPTX scheme exports using the exact background and accent hex values of the active editor theme. Very light accents (such as the Void theme's white) fall back to a dark title colour in Light mode to remain legible.
- Bold and italic inline formatting (`**text**`, `*text*`) is supported in slide body text and renders correctly in the exported PPTX. Slide titles are exported as plain text, with inline markers stripped.

## Contributions

Contributions are welcome! Feel free to submit issues or pull requests.
