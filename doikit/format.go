package main

import (
	"fmt"
	"strings"
)

type FormatStyle string

const (
	FormatAPA     FormatStyle = "apa"
	FormatChicago FormatStyle = "chicago"
	FormatHarvard FormatStyle = "harvard"
)

func FormatCitation(w *Work, style FormatStyle) string {
	switch style {
	case FormatChicago:
		return formatChicago(w)
	case FormatHarvard:
		return formatHarvard(w)
	default:
		return formatAPA7(w)
	}
}

func formatAPA7(w *Work) string {
	var parts []string

	if a := apaAuthors(w.Authors); a != "" {
		parts = append(parts, a)
	}
	if w.Year > 0 {
		parts = append(parts, fmt.Sprintf("(%d).", w.Year))
	}
	if w.Title != "" {
		parts = append(parts, w.Title+".")
	}
	if w.Journal != "" {
		loc := w.Journal
		if w.Volume != "" {
			loc += ", " + w.Volume
			if w.Issue != "" {
				loc += "(" + w.Issue + ")"
			}
			if w.Pages != "" {
				loc += ", " + w.Pages
			}
		}
		loc += "."
		parts = append(parts, loc)
	}
	if w.DOI != "" {
		parts = append(parts, "https://doi.org/"+w.DOI)
	}

	return strings.Join(parts, " ")
}

func formatChicago(w *Work) string {
	var parts []string

	if a := chicagoAuthors(w.Authors); a != "" {
		if !strings.HasSuffix(a, ".") {
			a += "."
		}
		parts = append(parts, a)
	}
	if w.Year > 0 {
		parts = append(parts, fmt.Sprintf("%d.", w.Year))
	}
	if w.Title != "" {
		parts = append(parts, `"`+w.Title+`."`)
	}
	if w.Journal != "" {
		loc := w.Journal
		if w.Volume != "" {
			loc += " " + w.Volume
			if w.Issue != "" {
				loc += " (" + w.Issue + ")"
			}
			if w.Pages != "" {
				loc += ": " + w.Pages
			}
		}
		loc += "."
		parts = append(parts, loc)
	}
	if w.DOI != "" {
		parts = append(parts, "https://doi.org/"+w.DOI)
	}

	return strings.Join(parts, " ")
}

func formatHarvard(w *Work) string {
	var parts []string

	if a := harvardAuthors(w.Authors); a != "" {
		parts = append(parts, a)
	}
	if w.Year > 0 {
		parts = append(parts, fmt.Sprintf("(%d)", w.Year))
	}
	if w.Title != "" {
		parts = append(parts, `'`+w.Title+`',`)
	}
	if w.Journal != "" {
		loc := w.Journal
		if w.Volume != "" {
			loc += ", " + w.Volume
			if w.Issue != "" {
				loc += "(" + w.Issue + ")"
			}
			if w.Pages != "" {
				loc += ", pp. " + w.Pages
			}
		}
		loc += "."
		parts = append(parts, loc)
	}
	if w.DOI != "" {
		parts = append(parts, "doi: "+w.DOI)
	}

	return strings.Join(parts, " ")
}

func apaAuthors(authors []Author) string {
	if len(authors) == 0 {
		return ""
	}

	format := func(a Author) string {
		init := makeInitials(a.Given)
		if a.Family == "" {
			return init
		}
		if init == "" {
			return a.Family
		}
		return a.Family + ", " + init
	}

	if len(authors) > 20 {
		var parts []string
		for _, a := range authors[:19] {
			parts = append(parts, format(a))
		}
		parts = append(parts, ". . .")
		parts = append(parts, format(authors[len(authors)-1]))
		return strings.Join(parts[:len(parts)-1], ", ") + " " + parts[len(parts)-1]
	}

	var f []string
	for _, a := range authors {
		f = append(f, format(a))
	}
	if len(f) == 1 {
		return f[0]
	}
	return strings.Join(f[:len(f)-1], ", ") + ", & " + f[len(f)-1]
}

func chicagoAuthors(authors []Author) string {
	if len(authors) == 0 {
		return ""
	}

	first := authors[0]
	firstName := first.Family
	if first.Given != "" {
		firstName += ", " + first.Given
	}

	if len(authors) == 1 {
		return firstName
	}
	if len(authors) >= 4 {
		return firstName + " et al."
	}

	var rest []string
	for _, a := range authors[1:] {
		name := strings.TrimSpace(a.Given + " " + a.Family)
		rest = append(rest, name)
	}
	if len(rest) == 1 {
		return firstName + ", and " + rest[0]
	}
	return firstName + ", " + strings.Join(rest[:len(rest)-1], ", ") + ", and " + rest[len(rest)-1]
}

func harvardAuthors(authors []Author) string {
	if len(authors) == 0 {
		return ""
	}

	format := func(a Author) string {
		init := makeInitials(a.Given)
		if a.Family == "" {
			return init
		}
		if init == "" {
			return a.Family
		}
		return a.Family + ", " + init
	}

	if len(authors) >= 4 {
		return format(authors[0]) + " et al."
	}

	var f []string
	for _, a := range authors {
		f = append(f, format(a))
	}
	if len(f) == 1 {
		return f[0]
	}
	return strings.Join(f[:len(f)-1], ", ") + " and " + f[len(f)-1]
}

func makeInitials(given string) string {
	if given == "" {
		return ""
	}
	var initials []string
	for _, part := range strings.Fields(given) {
		runes := []rune(part)
		if len(runes) > 0 {
			initials = append(initials, string(runes[0])+".")
		}
	}
	return strings.Join(initials, "")
}
