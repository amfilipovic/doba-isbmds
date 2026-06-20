# OpenAlexSLR

![demo](docs/demo.gif)

![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-browser-lightgrey.svg)
![API](https://img.shields.io/badge/API-OpenAlex-orange.svg)

## Overview

OpenAlexSLR is a browser-based query builder for systematic literature reviews, drawing on the [OpenAlex](https://openalex.org) open catalogue of over 317 million academic works. Compose a Boolean search from multiple concept groups, refine by year and publication type, and export any selection to CSV or RIS for your reference manager. Queries can be saved and reloaded as JSON files for reproducible searches across sessions. Nothing to install, no account or API key required.

## Background

Systematic literature reviews require structured, reproducible search strategies across multiple concept groups with Boolean connectors. Most free-to-use academic databases either lack a query builder, require registration, or restrict export volume. OpenAlex provides unrestricted programmatic access to a comprehensive catalogue of scholarly works, making it well-suited for SLR workflows.

The tool was built during the first year of a doctoral programme in innovation and sustainable business management. The immediate trigger was the Technological, Social and Economic Sustainable Challenges course, where completing a structured SLR on an assigned topic made the absence of a clean, portable query builder apparent.

Once built, it proved useful beyond that first assignment. It was used again for the Fundamental Aspects of Research Work and Research Proposal Preparation Seminar and for Individual Work 1: Research Topic and Research Proposal Draft, where a repeatable and exportable search process was essential for developing the research proposal.

## Demo

Demo recording coming soon.

## Usage

Open `index.html` in any modern browser. No server or build step is needed.

### Building a query

Each concept group is a row in the query panel. Enter one or more terms separated by commas: commas within a row mean OR between those terms. Add further rows with **+ Add concept** and connect them with AND, OR, or NOT using the connector select on each row.

The five examples below are drawn from a cross-sector study of digital competences and sustainable work outcomes in Croatia. Each is saved as a loadable JSON file in the `demo/` folder.

**1. Digital competences and work outcomes**
Links digital skill sets to sustainable work performance across professional contexts.

| Connector | Terms |
| --- | --- |
| *(first)* | digital competence, digital skills, digital literacy |
| AND | sustainable work outcomes, work performance, employee wellbeing, work engagement |

Filters: year from 2018 to 2025, type: journal article. File: [`demo/01-digital-competences-work-outcomes.json`](demo/01-digital-competences-work-outcomes.json).

**2. Digital transformation and workforce sustainability**
Examines how organisational digital transformation affects workforce sustainability and employment quality.

| Connector | Terms |
| --- | --- |
| *(first)* | digital transformation, digitalisation, digitalization |
| AND | workforce, employees, human resources |
| AND | sustainability, sustainable development, quality of work life |

Filters: year from 2019 to 2025, type: journal article, per page: 50. File: [`demo/02-digital-transformation-workforce.json`](demo/02-digital-transformation-workforce.json).

**3. Digital competence frameworks**
Surveys frameworks and instruments used to define and assess digital competences in professional contexts, excluding computer science education literature.

| Connector | Terms |
| --- | --- |
| *(first)* | DigComp, RISE framework, digital competence framework, digital skills framework |
| AND | assessment, measurement, validation |
| NOT | computational thinking |

Filters: year from 2013 to 2025, all types, per page: 25. File: [`demo/03-competence-frameworks.json`](demo/03-competence-frameworks.json).

**4. Croatia and the digital economy**
Targets literature on digital transformation and the digital economy in the Croatian context.

| Connector | Terms |
| --- | --- |
| *(first)* | Croatia, Croatian |
| AND | digital transformation, digital economy, digitalization |

Filters: year from 2015 to 2025, type: journal article, per page: 50. File: [`demo/04-croatia-digital-economy.json`](demo/04-croatia-digital-economy.json).

**5. Sustainable work in the digital workplace**
Explores the intersection of work sustainability and digital or remote work arrangements in the post-pandemic period.

| Connector | Terms |
| --- | --- |
| *(first)* | sustainable work, work sustainability, sustainable employment, sustainable career |
| AND | digital workplace, remote work, hybrid work, telework, digital work |

Filters: year from 2020 to 2025, type: journal article, per page: 100. File: [`demo/05-sustainable-digital-workplace.json`](demo/05-sustainable-digital-workplace.json).

The query preview below the Search button shows the constructed Boolean string and any active filters before the search is run. Load any of the demo files using the **Load query** button in the query panel.

### Filters

| Filter | Description |
| --- | --- |
| Year from / to | Restrict results to a publication date range. Either bound is optional. |
| Type | Narrow to a specific publication type: journal article, book chapter, preprint, dissertation, or book. |
| Per page | Number of results to fetch per request: 10, 25, 50, 100, or 200. |

### Searching

Click **Search** or press Cmd/Ctrl+Enter. Running a new search clears previous results. Click **Load next N** at the bottom of the results to fetch the next page, or **Load all** to fetch all remaining pages in sequence. Load all shows a confirmation prompt with the estimated number of requests before proceeding.

### Results

Each result card shows the title (linked to the DOI or OpenAlex record), year, authors, source, a truncated abstract with a Show more option, and publication type and Open Access badges. Click a card or its checkbox to select it. Use **Select all** in the toolbar to select all visible results at once.

Use the **filter input** at the left of the toolbar to search across loaded results by title, authors, source, and abstract. The count updates to show how many records match. Filtering does not affect what is loaded from the API, only what is displayed and selectable.

### Exporting results

**CSV (all)** and **RIS (all)** export all loaded results. When items are checked the buttons show the count, e.g. **CSV (3)**, and export only the selected subset. To export a filtered subset, type in the filter input to narrow visible results, then use **Select all** to select only the matching records before exporting. CSV includes title, authors, year, DOI, type, source, abstract, OpenAlex ID, and open access status. RIS uses publication-type-specific record tags (JOUR, CHAP, UNPB, THES, BOOK, DATA) for correct import into reference managers such as Zotero, Mendeley, and EndNote.

### Saving and loading queries

**Save query** in the query panel exports the current concept rows, connectors, and filter settings as a `.json` file. **Load query** reads that file back and restores the full query state, ready to run or modify. This makes search strategies portable and reproducible across sessions.

### Reset

**Reset** in the results toolbar clears all results and returns the query panel to its initial state.

## Files

1. `index.html`: Application markup and structure.
2. `style.css`: All theming and layout, including ten switchable colour themes.
3. `script.js`: Query construction, API communication, result rendering, and export logic.
4. `demo/`: Sample queries as loadable JSON files.
5. `docs/`: Demo recording.

## Dependencies

None. OpenAlexSLR is self-contained HTML, CSS, and JavaScript with no external libraries or CDN dependencies. The only network calls are to the [OpenAlex REST API](https://api.openalex.org).

## Privacy

OpenAlexSLR runs entirely in the browser. No data is stored, logged, or transmitted beyond what is described here. Search queries and filters are sent to the OpenAlex API over HTTPS. Each request includes a `mailto` parameter with the author's email address, which opts the tool into the OpenAlex polite pool for improved rate limits and response times. No cookies are set and no analytics are collected.

## Notes

- Results are fetched in pages. Use **Load next N** to fetch subsequent pages. The total result count from OpenAlex may be large for broad queries, so use filters and specific concept terms to narrow the scope before exporting.
- The `search` parameter used by OpenAlexSLR covers title, abstract, and full text and supports full Boolean operators with uppercase AND, OR, NOT syntax. Field-specific search (title only or abstract only) is not supported, as the corresponding OpenAlex filter parameters are deprecated.
- Paper titles in the OpenAlex catalogue sometimes contain HTML markup from publisher metadata. The tool strips disallowed tags and preserves safe inline formatting (`<i>`, `<em>`, `<b>`, `<strong>`, `<tt>`, `<code>`, `<sub>`, `<sup>`) in the result display. Exports receive plain text.
- The theme preference is saved to `localStorage` and restored on next open.

## Contributions

Contributions are welcome. Feel free to submit issues or pull requests to improve the tool.
