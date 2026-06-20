package main

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/fatih/color"
)

var (
	cyanBold = color.New(color.FgCyan, color.Bold)
	boldC    = color.New(color.Bold)
	greenC   = color.New(color.FgGreen, color.Bold)
	redC     = color.New(color.FgRed, color.Bold)
	yellowC  = color.New(color.FgYellow, color.Bold)
	mutedC   = color.New(color.FgHiBlack)
)

const panelWidth = 66

func printHeader(title, subtitle string) {
	line := strings.Repeat("─", panelWidth)
	cyanBold.Printf("╭%s╮\n", line)
	cyanBold.Print("│ ")
	boldC.Printf("%-*s", panelWidth-2, title)
	cyanBold.Println(" │")
	if subtitle != "" {
		cyanBold.Print("│ ")
		mutedC.Printf("%-*s", panelWidth-2, subtitle)
		cyanBold.Println(" │")
	}
	cyanBold.Printf("╰%s╯\n\n", line)
}

func printRule() {
	mutedC.Println(strings.Repeat("─", panelWidth+2))
}

func printOK(msg string) {
	greenC.Print("  ✓  ")
	fmt.Println(msg)
}

func printFail(msg string) {
	redC.Print("  ✗  ")
	fmt.Println(msg)
}

func printArrow(msg string) {
	yellowC.Print("  →  ")
	fmt.Println(msg)
}


type Spinner struct {
	frames  []string
	label   string
	stop    chan struct{}
	stopped chan struct{}
	mu      sync.Mutex
	active  bool
}

func newSpinner(label string) *Spinner {
	return &Spinner{
		frames:  []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"},
		label:   label,
		stop:    make(chan struct{}),
		stopped: make(chan struct{}),
	}
}

func (s *Spinner) Start() {
	s.mu.Lock()
	s.active = true
	s.mu.Unlock()
	go func() {
		defer close(s.stopped)
		for i := 0; ; i++ {
			select {
			case <-s.stop:
				fmt.Print("\r\033[2K")
				return
			default:
				cyanBold.Printf("\r  %s  %s", s.frames[i%len(s.frames)], s.label)
				time.Sleep(80 * time.Millisecond)
			}
		}
	}()
}

func (s *Spinner) Stop() {
	s.mu.Lock()
	if !s.active {
		s.mu.Unlock()
		return
	}
	s.active = false
	s.mu.Unlock()
	s.stop <- struct{}{}
	<-s.stopped
}

type tableRow struct {
	status string
	cols   []string
}

func printTable(headers []string, rows []tableRow) {
	if len(rows) == 0 {
		return
	}

	widths := make([]int, len(headers))
	for i, h := range headers {
		widths[i] = len([]rune(h))
	}
	for _, r := range rows {
		if len(r.status) > widths[0] {
			widths[0] = len([]rune(r.status))
		}
		for i, cell := range r.cols {
			col := i + 1
			if col < len(widths) && len([]rune(cell)) > widths[col] {
				widths[col] = len([]rune(cell))
			}
		}
	}

	sep := func(l, m, r, h string) string {
		parts := make([]string, len(widths))
		for i, w := range widths {
			parts[i] = strings.Repeat(h, w+2)
		}
		return "  " + l + strings.Join(parts, m) + r
	}

	cell := func(s string, w int) string {
		runes := []rune(s)
		if len(runes) > w {
			return string(runes[:w])
		}
		return s + strings.Repeat(" ", w-len(runes))
	}

	fmt.Println()
	mutedC.Println(sep("┌", "┬", "┐", "─"))

	hparts := make([]string, len(headers))
	hparts[0] = cell(headers[0], widths[0])
	for i := 1; i < len(headers); i++ {
		hparts[i] = cell(headers[i], widths[i])
	}
	boldC.Printf("  │ %s │\n", strings.Join(hparts, " │ "))

	mutedC.Println(sep("├", "┼", "┤", "─"))

	for _, row := range rows {
		statusStr := cell(row.status, widths[0])
		cols := make([]string, len(widths)-1)
		for i := range cols {
			if i < len(row.cols) {
				cols[i] = cell(row.cols[i], widths[i+1])
			} else {
				cols[i] = strings.Repeat(" ", widths[i+1])
			}
		}

		fmt.Print("  │ ")
		switch row.status {
		case "✓":
			greenC.Print(statusStr)
		case "✗":
			redC.Print(statusStr)
		case "→":
			yellowC.Print(statusStr)
		default:
			mutedC.Print(statusStr)
		}
		fmt.Printf(" │ %s │\n", strings.Join(cols, " │ "))
	}

	mutedC.Println(sep("└", "┴", "┘", "─"))
}
