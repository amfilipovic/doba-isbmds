package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const (
	crossrefBase = "https://api.crossref.org/works/"
	userAgent    = "doikit/1.0.0 (https://github.com/amfilipovic/doba-isbmds)"
)


type Work struct {
	DOI       string
	Title     string
	Authors   []Author
	Year      int
	Journal   string
	Volume    string
	Issue     string
	Pages     string
	Publisher string
	Type      string
	URL       string
}

type Author struct {
	Given    string
	Family   string
	Sequence string
}

type crResponse struct {
	Status  string    `json:"status"`
	Message crMessage `json:"message"`
}

type crMessage struct {
	DOI    string   `json:"DOI"`
	Title  []string `json:"title"`
	Author []struct {
		Given    string `json:"given"`
		Family   string `json:"family"`
		Sequence string `json:"sequence"`
	} `json:"author"`
	Published struct {
		DateParts [][]int `json:"date-parts"`
	} `json:"published"`
	ContainerTitle []string `json:"container-title"`
	Volume         string   `json:"volume"`
	Issue          string   `json:"issue"`
	Page           string   `json:"page"`
	Publisher      string   `json:"publisher"`
	Type           string   `json:"type"`
	URL            string   `json:"URL"`
}

func fetchWork(doi string, timeout time.Duration) (*Work, error) {
	doi = normalizeDOI(doi)
	if doi == "" {
		return nil, fmt.Errorf("empty DOI")
	}

	req, err := http.NewRequest("GET", crossrefBase+doi, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", userAgent)

	client := &http.Client{Timeout: timeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case 404:
		return nil, fmt.Errorf("not found in CrossRef")
	case 200:
	default:
		return nil, fmt.Errorf("CrossRef returned HTTP %d", resp.StatusCode)
	}

	var cr crResponse
	if err := json.NewDecoder(resp.Body).Decode(&cr); err != nil {
		return nil, fmt.Errorf("parse error: %w", err)
	}
	if cr.Status != "ok" {
		return nil, fmt.Errorf("CrossRef status: %s", cr.Status)
	}

	w := &Work{
		DOI:       strings.ToLower(cr.Message.DOI),
		Volume:    cr.Message.Volume,
		Issue:     cr.Message.Issue,
		Pages:     cr.Message.Page,
		Publisher: cr.Message.Publisher,
		Type:      cr.Message.Type,
		URL:       cr.Message.URL,
	}

	if len(cr.Message.Title) > 0 {
		w.Title = cr.Message.Title[0]
	}
	if len(cr.Message.ContainerTitle) > 0 {
		w.Journal = cr.Message.ContainerTitle[0]
	}
	if len(cr.Message.Published.DateParts) > 0 && len(cr.Message.Published.DateParts[0]) > 0 {
		w.Year = cr.Message.Published.DateParts[0][0]
	}
	for _, a := range cr.Message.Author {
		w.Authors = append(w.Authors, Author{Given: a.Given, Family: a.Family, Sequence: a.Sequence})
	}
	if w.URL == "" {
		w.URL = "https://doi.org/" + w.DOI
	}

	return w, nil
}
