package main

import (
	"encoding/csv"
	"flag"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"sync"
	"time"
)

type checkResult struct {
	DOI      string
	Index    int
	Status   int
	FinalURL string
	Duration time.Duration
	Err      error
}

func runCheck(args []string) {
	fs := flag.NewFlagSet("check", flag.ExitOnError)
	fileFlag    := fs.String("file", "", "File with DOIs, one per line")
	concFlag    := fs.Int("concurrency", 1, "Number of parallel checks")
	retryFlag   := fs.Bool("retry", false, "Retry failed DOIs once")
	exportFlag  := fs.String("export", "", "Write results to CSV file")
	timeoutFlag := fs.Int("timeout", 20, "Request timeout in seconds")
	fs.Usage = func() {
		fmt.Fprintln(os.Stderr, "Usage: doikit check [--file FILE] [--concurrency N] [--timeout N] [--retry] [--export FILE] [DOI...]")
		fs.PrintDefaults()
	}
	fs.Parse(args)

	dois := collectDOIs(fs.Args(), *fileFlag)
	if len(dois) == 0 {
		fmt.Fprintln(os.Stderr, "doikit check: no DOIs provided")
		os.Exit(1)
	}

	timeout := time.Duration(*timeoutFlag) * time.Second
	start := time.Now()

	printHeader(
		"doikit check",
		fmt.Sprintf("%d DOI%s  ·  concurrency: %d  ·  timeout: %ds", len(dois), plural(len(dois)), *concFlag, *timeoutFlag),
	)

	results := runBatch(dois, *concFlag, timeout)

	if *retryFlag {
		var failedDOIs []string
		for _, r := range results {
			if isFailed(r) {
				failedDOIs = append(failedDOIs, r.DOI)
			}
		}
		if len(failedDOIs) > 0 {
			fmt.Println()
			printArrow(fmt.Sprintf("retrying %d failed DOI%s...\n", len(failedDOIs), plural(len(failedDOIs))))
			retried := runBatch(failedDOIs, *concFlag, timeout)
			retriedByDOI := make(map[string]checkResult, len(retried))
			for _, r := range retried {
				retriedByDOI[r.DOI] = r
			}
			for i, r := range results {
				if rr, ok := retriedByDOI[r.DOI]; ok {
					results[i] = rr
				}
			}
		}
	}

	printRule()

	okCount, failCount, redirectCount := 0, 0, 0
	var rows []tableRow

	for _, r := range results {
		if r.Err != nil {
			rows = append(rows, tableRow{"✗", []string{r.DOI, "error", "", r.Err.Error()}})
			failCount++
			continue
		}
		ms := fmt.Sprintf("%dms", r.Duration.Milliseconds())
		status := strconv.Itoa(r.Status)
		final := stripQuery(r.FinalURL)
		switch {
		case r.Status >= 200 && r.Status < 300:
			rows = append(rows, tableRow{"✓", []string{r.DOI, status, ms, final}})
			okCount++
		case r.Status >= 300 && r.Status < 400:
			rows = append(rows, tableRow{"→", []string{r.DOI, status, ms, final}})
			redirectCount++
		default:
			rows = append(rows, tableRow{"✗", []string{r.DOI, status, ms, final}})
			failCount++
		}
	}

	if failCount > 0 || redirectCount > 0 {
		printTable([]string{"", "DOI", "Status", "Time", "Final URL"}, rows)
	}
	fmt.Println()
	printOK(fmt.Sprintf("%d resolved  ·  %s", okCount, formatDuration(time.Since(start))))
	if redirectCount > 0 {
		printArrow(fmt.Sprintf("%d redirect", redirectCount))
	}
	if failCount > 0 {
		printFail(fmt.Sprintf("%d failed", failCount))
	}
	fmt.Println()

	if *exportFlag != "" {
		if err := exportCSV(*exportFlag, results); err != nil {
			printFail("export failed: " + err.Error())
		} else {
			printOK("exported to " + *exportFlag)
		}
		fmt.Println()
	}
}

func runBatch(dois []string, concurrency int, timeout time.Duration) []checkResult {
	total := len(dois)

	if concurrency == 1 {
		results := make([]checkResult, total)
		for i, doi := range dois {
			sp := newSpinner(fmt.Sprintf("[%d/%d] %s", i+1, total, doi))
			sp.Start()
			r := checkDOI(doi, timeout)
			r.Index = i
			sp.Stop()
			printCheckLine(r, i+1, total)
			results[i] = r
		}
		return results
	}

	type indexed struct {
		idx int
		r   checkResult
	}
	ch := make(chan indexed, total)
	sem := make(chan struct{}, concurrency)
	var wg sync.WaitGroup

	for i, doi := range dois {
		wg.Add(1)
		go func(idx int, d string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			r := checkDOI(d, timeout)
			r.Index = idx
			ch <- indexed{idx, r}
		}(i, doi)
	}

	go func() {
		wg.Wait()
		close(ch)
	}()

	results := make([]checkResult, total)
	received := 0
	for item := range ch {
		received++
		results[item.idx] = item.r
		printCheckLine(item.r, received, total)
	}
	return results
}

func printCheckLine(r checkResult, n, total int) {
	w := len(strconv.Itoa(total))
	counter := fmt.Sprintf("[%0*d/%d]", w, n, total)
	if r.Err != nil {
		printFail(fmt.Sprintf("%s  %s: %s", counter, r.DOI, r.Err.Error()))
		return
	}
	ms := fmt.Sprintf("%dms", r.Duration.Milliseconds())
	line := fmt.Sprintf("%s  %s  %d  %s", counter, r.DOI, r.Status, ms)
	switch {
	case r.Status >= 200 && r.Status < 300:
		printOK(line)
	case r.Status >= 300 && r.Status < 400:
		printArrow(line)
	default:
		printFail(line)
	}
}

func stripQuery(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	u.RawQuery = ""
	return u.String()
}

func isFailed(r checkResult) bool {
	return r.Err != nil || r.Status >= 400 || (r.Status > 0 && r.Status < 200)
}

func checkDOI(doi string, timeout time.Duration) checkResult {
	doi = normalizeDOI(doi)
	url := "https://doi.org/" + doi

	client := &http.Client{
		Timeout: timeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 15 {
				return fmt.Errorf("too many redirects")
			}
			return nil
		},
	}

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return checkResult{DOI: doi, Err: err}
	}
	req.Header.Set("User-Agent", userAgent)

	start := time.Now()
	resp, err := client.Do(req)
	duration := time.Since(start)

	if err != nil {
		return checkResult{DOI: doi, Err: err, Duration: duration}
	}
	defer resp.Body.Close()

	return checkResult{
		DOI:      doi,
		Status:   resp.StatusCode,
		FinalURL: resp.Request.URL.String(),
		Duration: duration,
	}
}

func exportCSV(path string, results []checkResult) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	w := csv.NewWriter(f)
	defer w.Flush()

	if err := w.Write([]string{"doi", "status", "time_ms", "final_url", "error"}); err != nil {
		return err
	}
	for _, r := range results {
		status, ms, finalURL, errStr := "", "", "", ""
		if r.Status > 0 {
			status = strconv.Itoa(r.Status)
		}
		if r.Duration > 0 {
			ms = strconv.FormatInt(r.Duration.Milliseconds(), 10)
		}
		if r.FinalURL != "" {
			finalURL = r.FinalURL
		}
		if r.Err != nil {
			errStr = r.Err.Error()
		}
		if err := w.Write([]string{r.DOI, status, ms, finalURL, errStr}); err != nil {
			return err
		}
	}
	return w.Error()
}
