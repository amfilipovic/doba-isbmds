import re
import sys
import subprocess
import argparse
import importlib.util
import json
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from datetime import datetime

from rich import box
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn
from rich.prompt import Confirm, IntPrompt, Prompt
from rich.rule import Rule
from rich.table import Table

c = Console()
VERSION = "1.0"
CONFIG_FILE = Path.home() / ".slidenotes_tts"

FETCH_TIMEOUT = 30
GENERATE_TIMEOUT = 120
SAMPLE_TIMEOUT = 30

EXIT_SUCCESS = 0
EXIT_FAILED = 1
EXIT_NOTHING = 2


def load_config():
    if CONFIG_FILE.exists():
        try:
            return json.loads(CONFIG_FILE.read_text())
        except Exception:
            return {}
    return {}


def save_config(data):
    existing = load_config()
    existing.update(data)
    try:
        CONFIG_FILE.write_text(json.dumps(existing))
    except Exception as e:
        c.print(f"[yellow]Warning: Could not save config ({CONFIG_FILE}): {e}[/yellow]")


def check_dependencies():
    if importlib.util.find_spec("edge_tts") is None:
        c.print(Panel(
            "[red]edge-tts is not installed.[/red]\nRun: [cyan]pip3 install edge-tts[/cyan]",
            border_style="red", title="[red]Missing dependency[/red]", title_align="left"
        ))
        sys.exit(EXIT_FAILED)


def fetch_available_voices():
    try:
        with c.status("[cyan]Fetching available voices...", spinner="dots"):
            process = subprocess.run(
                [sys.executable, "-m", "edge_tts", "--list-voices"],
                capture_output=True, text=True, check=True, timeout=FETCH_TIMEOUT
            )
    except subprocess.TimeoutExpired:
        c.print("[red]Error: Timed out fetching voices. Check your network connection.[/red]")
        sys.exit(EXIT_FAILED)
    except subprocess.CalledProcessError as e:
        err = e.stderr.strip() if e.stderr else str(e)
        c.print(Panel(
            f"[red]Failed to fetch voices from edge-tts.[/red]\n{err}",
            border_style="red", title="[red]Error[/red]", title_align="left"
        ))
        sys.exit(EXIT_FAILED)

    voices = []
    for line in process.stdout.splitlines():
        parts = line.split()
        if parts and parts[0].count("-") >= 2 and parts[0].replace("-", "").isalnum():
            voices.append(parts[0])
    return voices


def play_audio(path):
    for player in ["afplay", "aplay"]:
        try:
            subprocess.run([player, str(path)], check=True, capture_output=True, timeout=60)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
            continue
    c.print("[yellow]No audio player found (afplay / aplay). Cannot play sample.[/yellow]")
    return False


def test_voice(voice):
    sample = "Hello. This is a test of the selected voice. How does it sound for your study sessions?"
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        with c.status("[cyan]Generating sample...", spinner="dots"):
            subprocess.run([
                sys.executable, "-m", "edge_tts",
                "--voice", voice,
                "--text", sample,
                "--write-media", str(tmp_path)
            ], check=True, capture_output=True, timeout=SAMPLE_TIMEOUT)
        play_audio(tmp_path)
    except subprocess.TimeoutExpired:
        c.print("[yellow]Sample generation timed out.[/yellow]")
    except subprocess.CalledProcessError:
        c.print("[red]Could not generate test sample.[/red]")
    finally:
        tmp_path.unlink(missing_ok=True)


def select_voice(voices, lang=None, region=None):
    while True:
        current_lang = lang
        current_region = region

        if not current_lang:
            languages = sorted({voice.split("-")[0].lower() for voice in voices})
            lang_table = Table(box=box.SIMPLE, show_header=False, padding=(0, 1))
            lang_table.add_column(style="cyan")
            for i in range(0, len(languages), 15):
                lang_table.add_row(", ".join(languages[i:i+15]))
            c.print(lang_table)
            current_lang = Prompt.ask("[bold]Language code[/bold] (e.g. en, hr, de)").strip().lower()

        filtered_voices = [v for v in voices if v.lower().startswith(current_lang + "-")]
        if not filtered_voices:
            c.print(f"[red]No voices found for '{current_lang}'.[/red] Use [cyan]--list-voices[/cyan] to browse available voices.")
            if lang:
                sys.exit(EXIT_FAILED)
            continue

        if not current_region:
            regions = sorted({v.split("-")[1] for v in filtered_voices if len(v.split("-")) >= 2})
            c.print(f"Available regions for [cyan]{current_lang}[/cyan]: {', '.join(regions)}")
            current_region = Prompt.ask(
                "[bold]Region code[/bold] (e.g. US, GB, AU) or Enter for ALL", default=""
            ).strip().upper()

        if current_region:
            region_filtered = [
                v for v in filtered_voices
                if len(v.split("-")) >= 2 and v.split("-")[1].upper() == current_region
            ]
            if region_filtered:
                filtered_voices = region_filtered
            else:
                c.print(f"[yellow]No voices for region '{current_region}'. Using all '{current_lang}' voices.[/yellow]")

        label = f"[cyan]{current_lang}[/cyan]" + (f" [dim]({current_region})[/dim]" if current_region else "")
        voice_table = Table(box=box.SIMPLE, show_header=False, padding=(0, 1))
        voice_table.add_column(style="cyan", width=4)
        voice_table.add_column()
        for idx, voice in enumerate(filtered_voices, 1):
            voice_table.add_row(str(idx), voice)
        c.print(Panel(voice_table, title=f"Voices · {label}", border_style="dim", title_align="left"))

        while True:
            n = IntPrompt.ask("[bold]Select voice number[/bold]")
            if 1 <= n <= len(filtered_voices):
                selected = filtered_voices[n - 1]
                break
            c.print(f"[red]Enter a number between 1 and {len(filtered_voices)}.[/red]")

        if Confirm.ask(f"Test voice [cyan]{selected}[/cyan] before proceeding?", default=False):
            c.print("Playing sample...")
            test_voice(selected)
            if not Confirm.ask("Keep this voice?", default=True):
                continue

        return selected


def select_content_mode():
    mode_table = Table(box=box.SIMPLE, show_header=False, padding=(0, 1))
    mode_table.add_column(style="cyan", width=3)
    mode_table.add_column()
    mode_table.add_row("1", "Slide Text Only")
    mode_table.add_row("2", "Speaker Notes Only")
    mode_table.add_row("3", "Both (separate files per slide)")
    c.print(Panel(mode_table, title="Content mode", border_style="dim", title_align="left"))
    return Prompt.ask("[bold]Choose mode[/bold]", choices=["1", "2", "3"], default="3")


def clean_text(text):
    if not text:
        return ""
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'\b\d+\s*/\s*\d+\b', '', text)
    text = re.sub(r'(\w)-(\w)', r'\1 \2', text)   # compound-word hyphens → space before stripping
    text = re.sub(r'[*_#`~>|]', '', text)
    text = re.sub(r'\s*-+\s*', ' ', text)          # remaining bare hyphens → space
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def parse_markdown(file_path):
    try:
        content = Path(file_path).read_text(encoding="utf-8")
    except OSError as e:
        c.print(Panel(
            f"[red]Could not read file:[/red] {e}",
            border_style="red", title="[red]Error[/red]", title_align="left"
        ))
        return []

    slide_pattern = r'<!--\s*Slide number:\s*(\d+)\s*-->(.*?)(?=<!--\s*Slide number:|\Z)'
    matches = list(re.finditer(slide_pattern, content, re.DOTALL | re.IGNORECASE))
    parsed_slides = []
    for match in matches:
        slide_num = int(match.group(1))
        block = match.group(2).strip()
        if "### Notes:" in block:
            slide_text, notes_text = block.split("### Notes:", 1)
        else:
            slide_text, notes_text = block, ""
        parsed_slides.append({
            "number": slide_num,
            "slide": clean_text(slide_text),
            "notes": clean_text(notes_text)
        })
    parsed_slides.sort(key=lambda x: x["number"])
    return parsed_slides


def generate_audio(text, output_path, voice):
    if not text or not text.strip():
        return False, None
    try:
        subprocess.run([
            sys.executable,
            "-m", "edge_tts",
            "--voice", voice,
            "--text", re.sub(r'\n+', ' ', text).strip(),
            "--write-media", str(output_path)
        ], check=True, capture_output=True, timeout=GENERATE_TIMEOUT)
        return True, None
    except subprocess.TimeoutExpired:
        output_path.unlink(missing_ok=True)
        return False, f"Timed out: {output_path.name}"
    except subprocess.CalledProcessError as e:
        output_path.unlink(missing_ok=True)
        err = e.stderr.decode()[:200] if e.stderr else str(e)
        return False, f"Failed: {err}"


def run_jobs(jobs, voice, label_prefix="", workers=1):
    total = len(jobs)
    if total == 0:
        return []

    effective = min(workers, total)
    if effective < workers:
        c.print(f"  [dim]Using {effective} workers (capped to job count).[/dim]")

    failed = []

    if effective == 1:
        for i, (text, out_path) in enumerate(jobs, 1):
            c.print(f"[blue][[{i}/{total}]][/blue] {label_prefix}Generating: [dim]{out_path.name}[/dim]")
            t_start = time.monotonic()
            with c.status("[cyan]working...", spinner="dots"):
                ok, err = generate_audio(text, out_path, voice)
            elapsed = time.monotonic() - t_start
            if ok:
                c.print(f"  [green]✓[/green] Done [dim]({elapsed:.1f}s)[/dim]")
            else:
                c.print(f"  [red]✗[/red] Failed [dim]({elapsed:.1f}s)[/dim]")
                if err:
                    c.print(f"  [dim]{err}[/dim]")
                failed.append((text, out_path))
    else:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            TimeElapsedColumn(),
            console=c,
        ) as progress:
            future_map = {}
            with ThreadPoolExecutor(max_workers=effective) as executor:
                for text, out_path in jobs:
                    task_id = progress.add_task(f"[dim]{out_path.name}[/dim]", total=None)
                    future = executor.submit(generate_audio, text, out_path, voice)
                    future_map[future] = (task_id, text, out_path)

                for future in as_completed(future_map):
                    task_id, text, out_path = future_map[future]
                    ok, err = future.result()
                    if ok:
                        progress.update(task_id,
                            description=f"[green]✓[/green] [dim]{out_path.name}[/dim]",
                            completed=1, total=1)
                    else:
                        progress.update(task_id,
                            description=f"[red]✗[/red] [dim]{out_path.name}[/dim]",
                            completed=1, total=1)
                        if err:
                            progress.console.print(f"  [dim]{err}[/dim]")
                        failed.append((text, out_path))

    return failed


def process_file(md_file, voice, content_mode, do_retry, workers, output_dir=None, dry_run=False, force=False, use_timestamp=False):
    timestamp = f"_{datetime.now().strftime('%Y%m%d-%H%M%S')}" if use_timestamp else ""

    c.print(Rule(f"[cyan]{md_file.name}[/cyan]", style="cyan"))

    with c.status(f"[cyan]Parsing {md_file.name}...", spinner="dots"):
        slides_data = parse_markdown(md_file)

    if not slides_data:
        c.print(Panel(
            "No valid slide structures found.\nMake sure the file was generated with [cyan]markitdown[/cyan] and contains [cyan]<!-- Slide number: N -->[/cyan] markers.",
            border_style="red", title="[red]Error[/red]", title_align="left"
        ))
        return 0, 0, 1

    c.print(f"Found [cyan]{len(slides_data)}[/cyan] slides: {[s['number'] for s in slides_data]}")

    if output_dir is None:
        output_dir = md_file.parent / f"{md_file.stem}_audio"

    if not dry_run:
        try:
            output_dir.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            c.print(Panel(
                f"[red]Cannot create output directory:[/red] {e}",
                border_style="red", title="[red]Error[/red]", title_align="left"
            ))
            return 0, 0, 1

    c.print(f"Output: [dim]{output_dir}[/dim]\n")

    jobs = []
    skipped = 0
    for slide in slides_data:
        num = f"{slide['number']:02d}"
        for kind in (["slide"] if content_mode == "1" else ["notes"] if content_mode == "2" else ["slide", "notes"]):
            text = slide[kind if kind == "slide" else "notes"]
            label = "content" if kind == "slide" else "notes"
            if not text:
                c.print(f"  [yellow]→[/yellow] Skipped slide {num} {label} [dim](empty)[/dim]")
                skipped += 1
                continue
            out_path = output_dir / f"slide_{num}_{label}_{voice}{timestamp}.mp3"
            if not dry_run and not force and out_path.exists():
                c.print(f"  [yellow]→[/yellow] Skipped slide {num} {label} [dim](exists)[/dim]")
                skipped += 1
                continue
            jobs.append((text, out_path))

    if dry_run:
        if not jobs and skipped == 0:
            c.print("  [dim]Nothing to process.[/dim]")
            return 0, 0, 0

        dry_table = Table(box=box.SIMPLE, show_header=True, padding=(0, 1))
        dry_table.add_column("#", style="cyan", width=4)
        dry_table.add_column("File", style="dim")
        dry_table.add_column("Status")
        would_exist = 0
        for i, (_, out_path) in enumerate(jobs, 1):
            if not force and out_path.exists():
                dry_table.add_row(str(i), out_path.name, "[yellow]exists (use --force to overwrite)[/yellow]")
                would_exist += 1
            else:
                dry_table.add_row(str(i), out_path.name, "[green]would generate[/green]")
        c.print(dry_table)
        would_generate = len(jobs) - would_exist
        c.print(f"  [green]{would_generate}[/green] would generate, [yellow]{would_exist + skipped}[/yellow] would skip\n")
        return 0, len(jobs) + skipped, 0

    file_start = time.monotonic()
    failed = run_jobs(jobs, voice, workers=workers)

    if do_retry and failed:
        c.print(f"\n[yellow]Retrying {len(failed)} failed file(s)...[/yellow]\n")
        failed = run_jobs(failed, voice, label_prefix="[yellow]Retry[/yellow] ", workers=workers)

    elapsed = time.monotonic() - file_start
    generated = len(jobs) - len(failed)

    summary = Table(box=box.SIMPLE, show_header=False, padding=(0, 1))
    summary.add_column(style="dim", width=12)
    summary.add_column()
    summary.add_row("Generated", f"[green]{generated}[/green]")
    summary.add_row("Skipped", f"[yellow]{skipped}[/yellow]")
    summary.add_row("Failed", f"[red]{len(failed)}[/red]")
    summary.add_row("Time", f"[cyan]{elapsed:.1f}s[/cyan]")
    summary.add_row("Output", f"[dim]{output_dir.resolve()}[/dim]")
    c.print(Panel(summary, title=f"[cyan]{md_file.name}[/cyan]", border_style="dim", title_align="left"))

    return generated, skipped, len(failed)


def main():
    parser = argparse.ArgumentParser(
        prog="SlideNotesTTS",
        description="Convert presentation Markdown slides and/or notes to MP3 audio."
    )
    parser.add_argument("files", nargs="*", help="One or more markitdown-generated .md files to process.")
    parser.add_argument("--version", action="version", version=f"%(prog)s {VERSION}")
    parser.add_argument("--voice", help="Use this voice and skip interactive selection. Example: en-US-JennyNeural.")
    parser.add_argument("--lang", help="Pre-filter voices by language code. Example: en, hr, de.")
    parser.add_argument("--region", help="Pre-filter voices by region code. Example: US, GB, AU.")
    parser.add_argument("--mode", choices=["1", "2", "3"],
                        help="Content to convert: 1 = slide text only, 2 = speaker notes only, 3 = both.")
    parser.add_argument("--output", metavar="DIR",
                        help="Write output to this directory. For multiple input files, each gets its own subdirectory inside DIR.")
    parser.add_argument("--jobs", type=int, default=1, metavar="N",
                        help="Number of parallel generation workers. Default: 1.")
    parser.add_argument("--timestamp", action="store_true",
                        help="Append a run timestamp to output filenames. Useful for versioned or archived runs.")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would be generated without creating any audio files.")
    parser.add_argument("--force", action="store_true",
                        help="Overwrite MP3 files that already exist in the output directory.")
    parser.add_argument("--list-voices", action="store_true",
                        help="List available voices and exit. Respects --lang and --region filters.")
    parser.add_argument("--retry", action="store_true",
                        help="Retry each failed file once before exiting.")
    parser.add_argument("--reset", action="store_true",
                        help="Ignore the saved voice preference and select a new one.")
    args = parser.parse_args()

    if args.jobs < 1:
        print("Error: --jobs requires a positive integer.")
        sys.exit(EXIT_FAILED)

    c.print(Panel(
        "[bold cyan]SlideNotesTTS[/bold cyan] [dim]v" + VERSION + "[/dim]",
        border_style="cyan", padding=(0, 2)
    ))

    check_dependencies()

    if args.list_voices:
        c.print(Rule("[cyan]Available voices[/cyan]", style="cyan"))
        voices = fetch_available_voices()
        if args.lang:
            voices = [v for v in voices if v.lower().startswith(args.lang.lower() + "-")]
        if args.region:
            voices = [v for v in voices if len(v.split("-")) >= 2 and v.split("-")[1].upper() == args.region.upper()]
        t = Table(box=box.SIMPLE, show_header=True, padding=(0, 1))
        t.add_column("#", style="cyan", width=5)
        t.add_column("Voice")
        t.add_column("Language", style="dim", width=10)
        t.add_column("Region", style="dim", width=8)
        for i, v in enumerate(voices, 1):
            parts = v.split("-")
            t.add_row(str(i), v, parts[0] if parts else "", parts[1] if len(parts) > 1 else "")
        c.print(t)
        sys.exit(EXIT_SUCCESS)

    if not args.files:
        parser.print_help()
        sys.exit(EXIT_FAILED)

    config = load_config()

    c.print(Rule("[cyan]Voice[/cyan]", style="cyan"))

    if args.voice:
        all_voices = fetch_available_voices()
        if args.voice not in all_voices:
            c.print(f"[red]Error:[/red] Voice '[cyan]{args.voice}[/cyan]' is not available. Use [cyan]--list-voices[/cyan] to browse valid voices.")
            sys.exit(EXIT_FAILED)
        selected_voice = args.voice
        c.print(f"Using voice: [cyan]{selected_voice}[/cyan]")
    elif not args.reset and config.get("last_voice"):
        last = config["last_voice"]
        all_voices = fetch_available_voices()
        if last not in all_voices:
            c.print(f"[yellow]Saved voice '{last}' is no longer available. Selecting a new voice.[/yellow]")
            selected_voice = select_voice(all_voices, lang=args.lang, region=args.region)
        elif Confirm.ask(f"Use last voice [cyan]{last}[/cyan]?", default=True):
            selected_voice = last
        else:
            selected_voice = select_voice(all_voices, lang=args.lang, region=args.region)
    else:
        all_voices = fetch_available_voices()
        if not all_voices:
            c.print("[red]Error: Could not retrieve voices from edge-tts.[/red]")
            sys.exit(EXIT_FAILED)
        selected_voice = select_voice(all_voices, lang=args.lang, region=args.region)

    save_config({"last_voice": selected_voice})

    c.print(Rule("[cyan]Configuration[/cyan]", style="cyan"))
    content_mode = args.mode if args.mode else select_content_mode()

    md_files = []
    for f in args.files:
        p = Path(f)
        if not p.exists():
            c.print(f"[red]Error:[/red] File '{p}' does not exist.")
        else:
            md_files.append(p)

    if not md_files:
        sys.exit(EXIT_FAILED)

    label = "[cyan]Dry run[/cyan]" if args.dry_run else "[cyan]Processing[/cyan]"
    c.print(Rule(label, style="cyan"))

    multi = len(md_files) > 1
    total_generated = total_skipped = total_failed = 0
    file_outputs = []
    start = time.monotonic()

    for md_file in md_files:
        if args.output:
            output_dir = Path(args.output) / md_file.stem if multi else Path(args.output)
        else:
            output_dir = md_file.parent / f"{md_file.stem}_audio"
        file_outputs.append((md_file.name, output_dir))
        g, s, f = process_file(
            md_file, selected_voice, content_mode,
            args.retry, args.jobs, output_dir,
            dry_run=args.dry_run, force=args.force, use_timestamp=args.timestamp
        )
        total_generated += g
        total_skipped += s
        total_failed += f

    if args.dry_run:
        sys.exit(EXIT_SUCCESS)

    if multi:
        elapsed = int(time.monotonic() - start)
        total_summary = Table(box=box.SIMPLE, show_header=False, padding=(0, 1))
        total_summary.add_column(style="dim", width=12)
        total_summary.add_column()
        total_summary.add_row("Generated", f"[green]{total_generated}[/green]")
        total_summary.add_row("Skipped", f"[yellow]{total_skipped}[/yellow]")
        total_summary.add_row("Failed", f"[red]{total_failed}[/red]")
        total_summary.add_row("Time", f"[cyan]{elapsed}s[/cyan]")
        total_summary.add_row("", "")
        for fname, odir in file_outputs:
            total_summary.add_row(f"[dim]{fname}[/dim]", f"[dim]{odir.resolve()}[/dim]")
        c.print(Panel(total_summary, title="[cyan]Total[/cyan]", border_style="cyan", title_align="left"))

    if total_failed:
        sys.exit(EXIT_FAILED)
    if total_generated == 0:
        if args.force or total_skipped == 0:
            c.print("[yellow]Nothing generated.[/yellow] All slides appear to be empty after text cleaning.")
        else:
            c.print("[yellow]Nothing generated.[/yellow] All files were already up to date. Use [cyan]--force[/cyan] to regenerate.")
        sys.exit(EXIT_NOTHING)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        c.print("\n[yellow]Interrupted.[/yellow]")
        sys.exit(130)
