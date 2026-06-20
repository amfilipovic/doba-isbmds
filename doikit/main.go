package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"time"
)

const version = "1.0.0"

type citeResult struct {
	doi      string
	citation string
	err      error
}

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}
	switch os.Args[1] {
	case "cite":
		runCite(os.Args[2:])
	case "check":
		runCheck(os.Args[2:])
	case "version", "--version", "-V":
		fmt.Printf("doikit %s\n", version)
	case "help", "--help", "-h":
		printUsage()
	default:
		fmt.Fprintf(os.Stderr, "doikit: unknown command %q\n\n", os.Args[1])
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Print(`doikit: DOI citation formatter and link checker

Usage:
  doikit cite  [--format apa|chicago|harvard] [--file FILE] [DOI...]
  doikit check [--file FILE] [--concurrency N] [DOI...]

Commands:
  cite    Fetch metadata from CrossRef and format citations
  check   Verify DOIs resolve and report HTTP status

Options for cite:
  --format       Citation style: apa (default), chicago, harvard
  --file         Read DOIs from file, one per line
  --timeout      Request timeout in seconds (default: 20)
  --export       Write citations to a text file

Options for check:
  --file         Read DOIs from file, one per line
  --concurrency  Parallel checks (default: 1)
  --timeout      Request timeout in seconds (default: 20)
  --retry        Retry failed DOIs once after the first pass
  --export       Write results to a CSV file

DOIs are accepted as bare identifiers (10.xxxx/yyyy),
https://doi.org/ URLs, or doi: prefixed strings.
If no DOIs are passed as arguments and no --file is given,
doikit reads from stdin.

`)
}

func collectDOIs(args []string, file string) []string {
	var raw []string

	if file != "" {
		f, err := os.Open(file)
		if err != nil {
			fmt.Fprintf(os.Stderr, "doikit: cannot open %s: %v\n", file, err)
			os.Exit(1)
		}
		defer f.Close()
		sc := bufio.NewScanner(f)
		for sc.Scan() {
			line := strings.TrimSpace(sc.Text())
			if line != "" && !strings.HasPrefix(line, "#") {
				raw = append(raw, line)
			}
		}
	}

	raw = append(raw, args...)

	if len(raw) == 0 {
		stat, _ := os.Stdin.Stat()
		if (stat.Mode() & os.ModeCharDevice) == 0 {
			sc := bufio.NewScanner(os.Stdin)
			for sc.Scan() {
				line := strings.TrimSpace(sc.Text())
				if line != "" && !strings.HasPrefix(line, "#") {
					raw = append(raw, line)
				}
			}
		}
	}

	seen := make(map[string]bool)
	var out []string
	for _, d := range raw {
		norm := normalizeDOI(d)
		if !seen[norm] && norm != "" {
			seen[norm] = true
			out = append(out, norm)
		}
	}
	return out
}

func normalizeDOI(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "https://doi.org/")
	s = strings.TrimPrefix(s, "http://doi.org/")
	s = strings.TrimPrefix(s, "https://dx.doi.org/")
	s = strings.TrimPrefix(s, "http://dx.doi.org/")
	s = strings.TrimPrefix(s, "doi:")
	s = strings.TrimPrefix(s, "DOI:")
	return strings.TrimSpace(s)
}

func formatDuration(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%.1fs", d.Seconds())
	}
	m := int(d.Minutes())
	s := int(d.Seconds()) % 60
	return fmt.Sprintf("%dm %02ds", m, s)
}

func plural(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}

func truncate(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n-1]) + "…"
}
