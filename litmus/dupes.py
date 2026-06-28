import sys
import argparse
from pathlib import Path

import pandas as pd
from rapidfuzz import fuzz

from ui import c, print_header, print_rule, print_ok, print_fail, print_arrow


def title_similarity(a, b):
    return fuzz.token_sort_ratio(str(a).lower(), str(b).lower())


def run_dupes(args):
    parser = argparse.ArgumentParser(prog='litmus dupes', add_help=False)
    parser.add_argument('file', nargs='?', default='')
    parser.add_argument('--output', default='')
    parser.add_argument('--threshold', type=int, default=85)
    opts = parser.parse_args(args)

    if not opts.file:
        print_fail('no input file provided')
        print('  Usage: litmus dupes master.csv [--threshold 85] [--output deduped.csv]')
        sys.exit(1)

    p = Path(opts.file)
    if not p.exists():
        print_fail(f'not found: {opts.file}')
        sys.exit(1)

    out_path = opts.output if opts.output else opts.file
    df = pd.read_csv(p)
    total = len(df)

    print_header('litmus dupes', f'{p.name}  ·  {total} records  ·  threshold: {opts.threshold}')

    if 'title' not in df.columns:
        print_fail('no title column found')
        sys.exit(1)

    titles = df['title'].fillna('').tolist()

    c.print()
    with c.status('[cyan]scanning for near-duplicates...[/cyan]'):
        pairs = []
        for i in range(len(titles)):
            for j in range(i + 1, len(titles)):
                score = title_similarity(titles[i], titles[j])
                if score >= opts.threshold:
                    pairs.append((i, j, score))

    pairs.sort(key=lambda x: x[2], reverse=True)

    if not pairs:
        print_ok(f'no near-duplicates found above {opts.threshold}% similarity')
        c.print()
        sys.exit(0)

    print_arrow(f'{len(pairs)} near-duplicate pair{"s" if len(pairs) != 1 else ""} found')
    c.print()

    to_remove = set()

    for idx_a, idx_b, score in pairs:
        if idx_a in to_remove or idx_b in to_remove:
            continue

        row_a = df.iloc[idx_a]
        row_b = df.iloc[idx_b]

        print_rule(f'{score}% similarity')
        c.print()

        title_a = str(row_a.get('title', '')).strip()[:80]
        title_b = str(row_b.get('title', '')).strip()[:80]
        year_a = str(row_a.get('year', '')).strip()
        year_b = str(row_b.get('year', '')).strip()
        source_a = str(row_a.get('source', '')).strip()[:50]
        source_b = str(row_b.get('source', '')).strip()[:50]
        doi_a = str(row_a.get('doi', '')).strip()
        doi_b = str(row_b.get('doi', '')).strip()

        c.print(f'  [bold cyan]A[/bold cyan]  {title_a}')
        c.print(f'     [dim]{source_a}  {year_a}  {doi_a[:50]}[/dim]')
        c.print()
        c.print(f'  [bold yellow]B[/bold yellow]  {title_b}')
        c.print(f'     [dim]{source_b}  {year_b}  {doi_b[:50]}[/dim]')
        c.print()
        c.print('  [bold red]a[/bold red] remove A  '
                '[bold red]b[/bold red] remove B  '
                '[dim]k[/dim] keep both  '
                '[dim]q[/dim] quit')
        c.print()

        while True:
            try:
                key = input('  > ').strip().lower()
            except (EOFError, KeyboardInterrupt):
                c.print()
                print_arrow('interrupted')
                break

            if key == 'a':
                to_remove.add(idx_a)
                print_fail('A removed')
                break
            elif key == 'b':
                to_remove.add(idx_b)
                print_fail('B removed')
                break
            elif key == 'k':
                print_ok('both kept')
                break
            elif key == 'q':
                c.print()
                print_arrow('quit')
                break
            else:
                c.print('  [dim]press a, b, k, or q[/dim]')

        if key == 'q':
            break

        c.print()

    if to_remove:
        df = df.drop(index=list(to_remove)).reset_index(drop=True)
        df.to_csv(out_path, index=False)
        c.print()
        print_rule('summary')
        c.print()
        print_ok(f'{len(df)} records remaining')
        print_fail(f'{len(to_remove)} removed')
        print_ok(f'saved to {out_path}')
    else:
        df.to_csv(out_path, index=False)
        print_ok('no records removed')
        print_ok(f'saved to {out_path}')

    c.print()
