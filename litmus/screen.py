import sys
import argparse
from pathlib import Path

import pandas as pd

from ui import c, print_header, print_rule, print_ok, print_fail, print_arrow


DECISIONS = {'i': 'include', 'e': 'exclude', 'm': 'maybe', 's': '', 'q': None}


def run_screen(args):
    parser = argparse.ArgumentParser(prog='litmus screen', add_help=False)
    parser.add_argument('file', nargs='?', default='')
    parser.add_argument('--output', default='')
    opts = parser.parse_args(args)

    if not opts.file:
        print_fail('no input file provided')
        print('  Usage: litmus screen master.csv [--output screened.csv]')
        sys.exit(1)

    p = Path(opts.file)
    if not p.exists():
        print_fail(f'not found: {opts.file}')
        sys.exit(1)

    out_path = opts.output if opts.output else opts.file
    df = pd.read_csv(p)

    if 'decision' not in df.columns:
        df['decision'] = ''

    df['decision'] = df['decision'].fillna('')

    pending = df[df['decision'] == ''].index.tolist()
    total = len(df)
    already_done = total - len(pending)

    print_header('litmus screen', f'{p.name}  ·  {len(pending)} pending  ·  {already_done} already screened')

    if not pending:
        print_ok('all papers already screened')
        c.print()
        sys.exit(0)

    included = int((df['decision'] == 'include').sum())
    excluded = int((df['decision'] == 'exclude').sum())
    maybe = int((df['decision'] == 'maybe').sum())

    decided = 0

    for idx in pending:
        row = df.loc[idx]
        c.print()
        print_rule(f'{already_done + decided + 1} / {total}')
        c.print()

        title = str(row.get('title', '')).strip() or '[no title]'
        source = str(row.get('source', '')).strip() or ''
        year = str(row.get('year', '')).strip() or ''
        authors = str(row.get('authors', '')).strip() or ''
        abstract = str(row.get('abstract', '')).strip() or '[no abstract]'
        queries = str(row.get('queries', '')).strip() if 'queries' in df.columns else ''

        c.print(f'  [bold]{title}[/bold]')
        meta_parts = [x for x in [source, year] if x]
        if meta_parts:
            c.print(f'  [dim]{" · ".join(meta_parts)}[/dim]')
        if authors:
            c.print(f'  [dim]{authors[:120]}[/dim]')
        if queries:
            c.print(f'  [cyan]queries: {queries}[/cyan]')
        c.print()
        c.print(f'  {abstract[:600]}')
        if len(abstract) > 600:
            c.print(f'  [dim]... ({len(abstract) - 600} chars truncated)[/dim]')
        c.print()

        c.print('  [bold green]i[/bold green] include  '
                '[bold red]e[/bold red] exclude  '
                '[bold yellow]m[/bold yellow] maybe  '
                '[dim]s[/dim] skip  '
                '[dim]q[/dim] quit')
        c.print()

        while True:
            try:
                key = input('  > ').strip().lower()
            except (EOFError, KeyboardInterrupt):
                c.print()
                print_arrow('interrupted, progress saved')
                df.to_csv(out_path, index=False)
                sys.exit(0)

            if key not in DECISIONS:
                c.print('  [dim]press i, e, m, s, or q[/dim]')
                continue
            break

        if DECISIONS[key] is None:
            print_arrow('quit, progress saved')
            df.to_csv(out_path, index=False)
            c.print()
            break

        decision = DECISIONS[key]
        df.at[idx, 'decision'] = decision
        df.to_csv(out_path, index=False)

        if decision == 'include':
            included += 1
            print_ok('include')
        elif decision == 'exclude':
            excluded += 1
            print_fail('exclude')
        elif decision == 'maybe':
            maybe += 1
            print_arrow('maybe')
        else:
            print_arrow('skipped')

        decided += 1

    c.print()
    print_rule('summary')
    c.print()
    print_ok(f'{included} included')
    print_fail(f'{excluded} excluded')
    print_arrow(f'{maybe} maybe')
    remaining = len(df[df['decision'] == ''])
    if remaining:
        print_arrow(f'{remaining} not yet screened')
    c.print()
    print_ok(f'saved to {out_path}')
    c.print()
