# doikit

![demo](docs/demo.gif)

![License](https://img.shields.io/badge/license-MIT-green.svg)
![Language](https://img.shields.io/badge/language-Go-00ADD8.svg)
![API](https://img.shields.io/badge/API-CrossRef-orange.svg)

## Overview

doikit is a command-line tool for working with DOIs. The `cite` subcommand fetches metadata from the CrossRef API and formats a ready-to-use citation in APA 7, Chicago 17, or Harvard style. The `check` subcommand verifies that DOIs resolve, reporting the HTTP status, response time, and final URL after redirects.

## Background

A doctoral programme accumulates references quickly. Every seminar, every assignment, and every submitted draft brings a new round of citations that need to be formatted consistently, checked for accuracy, and verified as still accessible. Across the first year of the Innovation and Sustainable Business Management in Digital Society programme at DOBA University of Applied Sciences, this pressure became a recurring practical problem.

The Technological, Social and Economic Sustainable Challenges course was the first point where a structured literature engagement was required at scale, and building a consistent, exportable reference list exposed how much manual work reformatting between styles actually takes. Fundamental Aspects of Research Work raised the stakes further by shifting the focus toward evaluating sources, and by the Research Proposal Preparation Seminar and Individual Work 1: Research Topic and Research Proposal Draft, the reference list had to hold up to full academic scrutiny, which also meant confirming that every DOI still resolved and pointed to the right destination.

Doing this by hand across dozens of references, in multiple citation styles depending on the submission context, was the kind of task that was easy to get wrong and tedious to get right. doikit was built to remove it. The `cite` subcommand fetches authoritative metadata directly from CrossRef and produces a formatted citation without any manual transcription. The `check` subcommand runs a quick resolution pass over a list of DOIs and flags anything that does not return a clean response, catching dead links before a submission does.

## Demo

The recording above shows `cite` formatting a single DOI in Chicago 17 style, followed by `check` verifying a list of 19 DOIs from a file.

## Usage

Build the binary:

```sh
go build -o doikit .
```

### cite

Fetch metadata from CrossRef and format a citation. Supported formats: `apa` (default), `chicago`, `harvard`.

| Flag | Default | Description |
| --- | --- | --- |
| `--format` | apa | Citation style: `apa`, `chicago`, `harvard`. |
| `--file` | - | Read DOIs from a file, one per line. |
| `--timeout` | 20 | Request timeout in seconds. |
| `--export` | - | Write formatted citations to a plain text file, one per line. |

**APA 7**: up to 20 authors listed. For 21 or more, the first 19 are listed followed by an ellipsis and the last author.

**Chicago 17** (author-date): up to 3 authors listed. Four or more uses the first author followed by *et al.*

**Harvard**: up to 3 authors listed. Four or more uses the first author followed by *et al.*

### check

Verify that DOIs resolve and report HTTP status, response time, and final URL after redirects. Results print live as each DOI resolves. A summary table is shown at the end only when there are failures or redirects.

| Flag | Default | Description |
| --- | --- | --- |
| `--file` | - | Read DOIs from a file, one per line. |
| `--concurrency` | 1 | Number of parallel checks. Results print as they arrive. |
| `--timeout` | 20 | Per-request timeout in seconds. |
| `--retry` | off | Re-check any failed or errored DOIs once after the first pass. |
| `--export` | - | Write results to a CSV file with columns: doi, status, time_ms, final_url, error. |

### DOI input formats

All of the following are accepted and normalised automatically:

```text
10.1007/978-3-032-02801-3_5
https://doi.org/10.1007/978-3-032-02801-3_5
doi:10.1007/978-3-032-02801-3_5
```

Lines beginning with `#` are ignored when reading from files or stdin. If no DOIs are passed as arguments and no `--file` is given, doikit reads from stdin.

## Examples

### General

Format a single DOI in APA 7:

```sh
doikit cite 10.1007/978-3-032-02801-3_5
```

Format the same DOI in Chicago 17 and Harvard:

```sh
doikit cite --format chicago 10.1007/978-3-032-02801-3_5
doikit cite --format harvard 10.1007/978-3-032-02801-3_5
```

Pipe a DOI from stdin:

```sh
echo "10.1007/978-3-032-02801-3_5" | doikit cite
```

Check a single DOI:

```sh
doikit check 10.1007/978-3-032-02801-3_5
```

Check a list of DOIs from a file:

```sh
doikit check --file dois.txt
```

Check with faster parallel requests:

```sh
doikit check --concurrency 5 --file dois.txt
```

Check and retry any failures:

```sh
doikit check --retry --file dois.txt
```

### Demo files

**1. APA 7 citations**
Formats all DOIs in APA 7 style and writes one citation per line to a text file.

```sh
doikit cite --file demo/dois.txt --export demo/citations-apa.txt
```

File: [`demo/citations-apa.txt`](demo/citations-apa.txt).

**2. Chicago 17 citations**
Formats all DOIs using Chicago author-date style (et al. for four or more authors) and exports to text.

```sh
doikit cite --format chicago --file demo/dois.txt --export demo/citations-chicago.txt
```

File: [`demo/citations-chicago.txt`](demo/citations-chicago.txt).

**3. Harvard citations**
Formats all DOIs in Harvard style and exports to text.

```sh
doikit cite --format harvard --file demo/dois.txt --export demo/citations-harvard.txt
```

File: [`demo/citations-harvard.txt`](demo/citations-harvard.txt).

**4. DOI link check**
Resolves all DOIs and records the HTTP status, response time, and final URL for each in CSV.

```sh
doikit check --file demo/dois.txt --export demo/results.csv
```

File: [`demo/results.csv`](demo/results.csv).

## Files

1. `main.go`: Entry point, subcommand routing, shared helpers.
2. `crossref.go`: CrossRef API client and response parsing.
3. `format.go`: Citation formatters for APA 7, Chicago 17, and Harvard.
4. `cite.go`: `cite` subcommand logic.
5. `check.go`: `check` subcommand logic and concurrent HTTP resolution.
6. `ui.go`: Terminal output helpers, spinner, and table renderer.
7. `demo/`: Sample DOI list and pre-generated output files for all three citation styles and check results.
8. `docs/`: Demo recording and VHS tape (`demo.tape`).

## Dependencies

- [`github.com/fatih/color`](https://github.com/fatih/color) for ANSI terminal colours.
- [CrossRef REST API](https://api.crossref.org) for DOI metadata. No API key required.

## Privacy

doikit sends HTTP requests to the CrossRef API at `api.crossref.org` and to `doi.org` for link checks. No other data is collected or transmitted. The `User-Agent` header sent with CrossRef requests includes the repository URL, which opts the tool into CrossRef's polite pool for better rate limits.

## Notes

- CrossRef covers most peer-reviewed journal literature but not all publishers. DOIs not found in CrossRef return a clear error. The DOI itself may still be valid.
- Response times reported by `check` include the full round-trip including any redirect chain to the final publisher URL. Times over a second are normal for some publishers.

## Contributions

Contributions are welcome. Feel free to submit issues or pull requests.

## Licence

[MIT](../LICENSE.md)
