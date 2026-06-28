# litmus

![demo](docs/demo.gif)

![License](https://img.shields.io/badge/license-MIT-green.svg)
![Language](https://img.shields.io/badge/language-Python-3776AB.svg)

## Overview

litmus is a command-line tool for processing systematic literature review CSV exports from OpenAlex. It merges and deduplicates results across multiple query files, tags papers by which queries they appeared in, and provides filtering, corpus statistics, interactive screening, and fuzzy duplicate detection. The output of each step feeds directly into the next, forming a complete post-search pipeline.

## Background

A systematic literature review does not end with a search. Once the queries return results, the work of building a usable corpus begins: combining outputs from multiple search strings, removing duplicates, understanding what the corpus actually contains, and making inclusion and exclusion decisions on each paper. Done manually across spreadsheets, this is slow and error-prone.

The four queries run through OpenAlexSLR across the doctoral research at DOBA University of Applied Sciences covered JD-R theory and the RISE framework, Croatian cross-sector NIS2 readiness, psychometric validation using PLS-SEM and MGA, and microfoundations of digital transformation. Together they returned 15,121 raw records, with the largest query alone hitting 10,000. After deduplication, the merged corpus contained 14,935 unique papers spanning 2015 to 2026, with 174 appearing in two or more queries and flagged as high relevance. Getting from that volume to a filtered, screened reference list required a repeatable process that a spreadsheet could not provide.

litmus picks up where OpenAlexSLR leaves off. It merges all query exports into a single deduplicated master file, flags papers that appear in multiple queries as high relevance, extracts a plain DOI list for handoff to doikit, and provides the analysis and triage tools needed to move from raw search output to a clean, reviewed reference list.

## Demo

The recording above shows `merge` combining four query CSVs into a single deduplicated master file, followed by `stats` running a full corpus analysis.

## Usage

Install dependencies:

```sh
pip install -r requirements.txt
```

Run litmus:

```sh
./litmus <command> [options]
```

### merge

Merge multiple query CSVs into one deduplicated master file. Each row is tagged with the query files it appeared in. Papers present in two or more queries are flagged as high relevance.

| Flag | Default | Description |
| --- | --- | --- |
| `--output` | master.csv | Output CSV file. |
| `--dois` | - | Also write a plain DOI list to this file for use with doikit. |

The output adds three columns to the original schema: `queries` (comma-separated list of source query stems), `query_count` (number of queries the paper appeared in), and `high_relevance` (true if query_count is 2 or more).

### filter

Filter a CSV by year range and abstract keyword. Filters are applied in sequence and each step reports how many records were removed.

| Flag | Default | Description |
| --- | --- | --- |
| `--output` | filtered.csv | Output CSV file. |
| `--from-year` | - | Earliest year to include. |
| `--to-year` | - | Latest year to include. |
| `--keyword` | - | Term to match in abstract. Repeatable. Default logic is AND. |
| `--or` | off | Use OR logic between keywords instead of AND. |

### stats

Run a full corpus analysis and print results to the terminal. No output file is written.

| Flag | Default | Description |
| --- | --- | --- |
| `--top` | 10 | Number of entries to show in ranked lists. |

Sections produced: overview, publication trend bar chart, open access by year, top journals with cumulative coverage, top authors, co-authorship concentration, abstract word frequency.

### screen

Interactive inclusion and exclusion screening. For each unscreened paper, shows the title, source, year, authors, and abstract. Accepts a single-key decision and writes it back to the CSV immediately so progress is never lost on interruption.

| Flag | Default | Description |
| --- | --- | --- |
| `--output` | writes back to input file | Output CSV file. |

Keys: `i` include, `e` exclude, `m` maybe, `s` skip, `q` quit.

The decision is stored in a `decision` column. Re-running screen on the same file skips already-decided papers.

### dupes

Fuzzy title matching across the corpus using token-sorted similarity. For each pair above the threshold, shows both titles side by side with their source, year, and DOI and asks for a manual call.

| Flag | Default | Description |
| --- | --- | --- |
| `--output` | writes back to input file | Output CSV file. |
| `--threshold` | 85 | Similarity threshold 0 to 100. |

Keys: `a` remove A, `b` remove B, `k` keep both, `q` quit.

## Examples

### General

Merge two query CSVs:

```sh
./litmus merge query1.csv query2.csv --output master.csv
```

Filter by year:

```sh
./litmus filter master.csv --from-year 2020 --to-year 2025
```

Filter by keyword:

```sh
./litmus filter master.csv --keyword "digital transformation" --keyword "workforce"
```

Run corpus stats:

```sh
./litmus stats master.csv
```

Extract DOIs for doikit:

```sh
./litmus merge query1.csv query2.csv --output master.csv --dois dois.txt
./doikit cite --file dois.txt
```

Screen papers interactively:

```sh
./litmus screen master.csv
```

Find fuzzy duplicates:

```sh
./litmus dupes master.csv --threshold 80
```

### Demo files

**1. Merged corpus**
Merges four OpenAlexSLR query exports into a single deduplicated master file, tags each paper with its source queries, and extracts a plain DOI list.

```sh
./litmus merge \
  demo/01-rise-framework-jdr-theory-openalex-export-20260623-021118.csv \
  demo/02-croatia-cross-sector-nis2-openalex-export-20260623-021249.csv \
  demo/03-psychometric-validation-pls-mga-openalex-export-20260623-021804.csv \
  demo/04-microfoundations-digital-transformation-openalex-export-20260623-021348.csv \
  --output demo/master.csv --dois demo/dois.txt
```

15,121 records in, 186 duplicates removed, 14,935 unique papers written. 174 appear in two or more queries. 14,482 DOIs extracted.

File: [`demo/master.csv`](demo/master.csv). DOI list: [`demo/dois.txt`](demo/dois.txt).

**2. Filtered corpus**
Filters the merged corpus to papers from 2020 to 2025, dropping the pre-acceleration older literature and the incomplete 2026 year.

```sh
./litmus filter demo/master.csv --from-year 2020 --to-year 2025 --output demo/filtered.csv
```

12,317 records remaining after 2,618 removed.

File: [`demo/filtered.csv`](demo/filtered.csv).

## Files

1. `main.py`: Entry point and subcommand routing.
2. `ui.py`: Rich terminal helpers, panel, rule, table, and bar chart.
3. `merge.py`: `merge` subcommand logic.
4. `filter.py`: `filter` subcommand logic.
5. `stats.py`: `stats` subcommand logic.
6. `screen.py`: `screen` subcommand logic.
7. `dupes.py`: `dupes` subcommand logic.
8. `demo/`: Pre-generated output files produced from OpenAlexSLR demo exports.
9. `docs/`: Demo recording and VHS tape.

## Dependencies

- [`pandas`](https://pandas.pydata.org) for CSV reading, merging, and filtering.
- [`rich`](https://github.com/Textualize/rich) for terminal output.
- [`rapidfuzz`](https://github.com/maxbachmann/RapidFuzz) for fuzzy title matching in `dupes`.

## Privacy

litmus processes only local CSV files. No network requests are made. The `--dois` flag in `merge` produces a plain text file intended for use with doikit, which makes its own requests separately.

## Notes

- The `doi` column in OpenAlex CSV exports uses the full `https://doi.org/` URL form. litmus normalises these internally for deduplication but preserves the original value in all output files. doikit accepts this format directly.
- `screen` writes back to the input file by default. Pass `--output` to write to a new file and preserve the original.
- `dupes` compares all title pairs, which is O(n²). On corpora above a few thousand records this may take several seconds.

## Contributions

Contributions are welcome. Feel free to submit issues or pull requests.

## Licence

[MIT](../LICENSE.md)
