import sys
import argparse
from pathlib import Path

import pandas as pd

from ui import c, print_header, print_rule, print_ok, print_fail, print_arrow


def run_filter(args):
    parser = argparse.ArgumentParser(prog='litmus filter', add_help=False)
    parser.add_argument('file', nargs='?', default='')
    parser.add_argument('--output', default='filtered.csv')
    parser.add_argument('--from-year', type=int, default=None, dest='from_year')
    parser.add_argument('--to-year', type=int, default=None, dest='to_year')
    parser.add_argument('--keyword', action='append', default=[], dest='keywords')
    parser.add_argument('--or', action='store_true', default=False, dest='use_or')
    opts = parser.parse_args(args)

    if not opts.file:
        print_fail('no input file provided')
        print('  Usage: litmus filter master.csv [--from-year N] [--to-year N] [--keyword TERM]')
        sys.exit(1)

    p = Path(opts.file)
    if not p.exists():
        print_fail(f'not found: {opts.file}')
        sys.exit(1)

    filters_desc = []
    if opts.from_year:
        filters_desc.append(f'from {opts.from_year}')
    if opts.to_year:
        filters_desc.append(f'to {opts.to_year}')
    if opts.keywords:
        logic = 'OR' if opts.use_or else 'AND'
        filters_desc.append(f'keywords ({logic}): {", ".join(opts.keywords)}')

    subtitle = '  '.join(filters_desc) if filters_desc else 'no filters applied'
    print_header('litmus filter', subtitle)

    df = pd.read_csv(p)
    total_before = len(df)
    print_ok(f'{total_before} records loaded from {p.name}')
    print_rule()

    if opts.from_year and 'year' in df.columns:
        before = len(df)
        df = df[pd.to_numeric(df['year'], errors='coerce') >= opts.from_year]
        print_arrow(f'year >= {opts.from_year}: {before - len(df)} removed')

    if opts.to_year and 'year' in df.columns:
        before = len(df)
        df = df[pd.to_numeric(df['year'], errors='coerce') <= opts.to_year]
        print_arrow(f'year <= {opts.to_year}: {before - len(df)} removed')

    if opts.keywords and 'abstract' in df.columns:
        before = len(df)
        abstracts = df['abstract'].fillna('').str.lower()
        if opts.use_or:
            mask = abstracts.apply(lambda a: any(kw.lower() in a for kw in opts.keywords))
        else:
            mask = abstracts.apply(lambda a: all(kw.lower() in a for kw in opts.keywords))
        df = df[mask]
        print_arrow(f'keyword filter: {before - len(df)} removed')

    total_after = len(df)
    removed = total_before - total_after

    c.print()
    print_ok(f'{total_after} records remaining ({removed} removed)')
    df.to_csv(opts.output, index=False)
    print_ok(f'written to {opts.output}')
    c.print()
