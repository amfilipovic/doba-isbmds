package main

import (
	"flag"
	"fmt"
	"os"
	"strings"
	"time"
)

func runCite(args []string) {
	fs := flag.NewFlagSet("cite", flag.ExitOnError)
	formatFlag  := fs.String("format", "apa", "Citation style: apa, chicago, harvard")
	fileFlag    := fs.String("file", "", "File with DOIs, one per line")
	exportFlag  := fs.String("export", "", "Write citations to a text file")
	timeoutFlag := fs.Int("timeout", 20, "Request timeout in seconds")
	fs.Usage = func() {
		fmt.Fprintln(os.Stderr, "Usage: doikit cite [--format apa|chicago|harvard] [--file FILE] [--timeout N] [--export FILE] [DOI...]")
		fs.PrintDefaults()
	}
	fs.Parse(args)

	style := FormatStyle(strings.ToLower(*formatFlag))
	switch style {
	case FormatAPA, FormatChicago, FormatHarvard:
	default:
		fmt.Fprintf(os.Stderr, "doikit: unknown format %q, using apa\n", style)
		style = FormatAPA
	}

	dois := collectDOIs(fs.Args(), *fileFlag)
	if len(dois) == 0 {
		fmt.Fprintln(os.Stderr, "doikit cite: no DOIs provided")
		os.Exit(1)
	}

	printHeader(
		"doikit cite",
		fmt.Sprintf("format: %s  ·  %d DOI%s", style, len(dois), plural(len(dois))),
	)

	var results []citeResult
	okCount, failCount := 0, 0
	start := time.Now()

	for _, doi := range dois {
		sp := newSpinner("fetching " + doi)
		sp.Start()

		work, err := fetchWork(doi, time.Duration(*timeoutFlag)*time.Second)
		sp.Stop()

		if err != nil {
			printFail(doi + ": " + err.Error())
			results = append(results, citeResult{doi: doi, err: err})
			failCount++
			continue
		}

		citation := FormatCitation(work, style)
		printOK(doi)
		fmt.Printf("     %s\n\n", citation)
		results = append(results, citeResult{doi: doi, citation: citation})
		okCount++
	}

	elapsed := time.Since(start)
	printRule()
	fmt.Println()

	if failCount > 0 {
		var rows []tableRow
		for _, r := range results {
			if r.err != nil {
				rows = append(rows, tableRow{"✗", []string{r.doi, r.err.Error()}})
			} else {
				rows = append(rows, tableRow{"✓", []string{r.doi, truncate(r.citation, 52)}})
			}
		}
		printTable([]string{"", "DOI", "Result"}, rows)
		fmt.Println()
	}

	if failCount > 0 {
		printFail(fmt.Sprintf("%d failed", failCount))
	}
	printOK(fmt.Sprintf("%d cited  ·  %s", okCount, formatDuration(elapsed)))
	fmt.Println()

	if *exportFlag != "" {
		if err := exportCitations(*exportFlag, results); err != nil {
			printFail("export failed: " + err.Error())
		} else {
			printOK("exported to " + *exportFlag)
		}
		fmt.Println()
	}
}

func exportCitations(path string, results []citeResult) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	for _, r := range results {
		if r.err != nil {
			continue
		}
		if _, err := fmt.Fprintln(f, r.citation); err != nil {
			return err
		}
	}
	return nil
}
