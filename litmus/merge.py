import sys
import argparse
from pathlib import Path

import pandas as pd

from ui import c, print_header, print_rule, print_ok, print_fail, print_arrow


def normalize_doi(doi):
    if pd.isna(doi) or str(doi).strip() == '':
        return ''
    d = str(doi).strip().lower()
    for prefix in ['https://doi.org/', 'http://doi.org/', 'https://dx.doi.org/', 'http://dx.doi.org/', 'doi:']:
        if d.startswith(prefix):
            d = d[len(prefix):]
            break
    return d.strip()


def run_merge(args):
    parser = argparse.ArgumentParser(prog='litmus merge', add_help=False)
    parser.add_argument('files', nargs='*')
    parser.add_argument('--output', default='master.csv')
    parser.add_argument('--dois', default='')
    opts = parser.parse_args(args)

    files = opts.files
    if not files:
        print_fail('no input files provided')
        print('  Usage: litmus merge file1.csv file2.csv ... [--output master.csv]')
        sys.exit(1)

    print_header('litmus merge', f'{len(files)} file{"s" if len(files) != 1 else ""}  →  {opts.output}')

    frames = []
    total_missing_doi = 0

    for f in files:
        p = Path(f)
        if not p.exists():
            print_fail(f'not found: {f}')
            sys.exit(1)
        df = pd.read_csv(p)
        df['_query'] = p.stem
        missing = df['doi'].isna().sum() + (df['doi'] == '').sum() if 'doi' in df.columns else len(df)
        total_missing_doi += missing
        frames.append(df)
        print_ok(f'{p.name:<50}  {len(df)} records')

    print_rule()

    combined = pd.concat(frames, ignore_index=True)
    total_raw = len(combined)

    combined['_doi_norm'] = combined['doi'].apply(normalize_doi) if 'doi' in combined.columns else ''
    combined['_oa_id'] = combined['openalex_id'].fillna('').str.strip() if 'openalex_id' in combined.columns else ''

    combined['_key'] = combined.apply(
        lambda r: 'doi:' + r['_doi_norm'] if r['_doi_norm']
        else 'oa:' + r['_oa_id'] if r['_oa_id']
        else f'row:{r.name}',
        axis=1
    )

    query_map = (
        combined.groupby('_key')['_query']
        .apply(lambda x: sorted(x.unique().tolist()))
        .to_dict()
    )

    deduped = combined.drop_duplicates(subset=['_key'], keep='first').copy()
    deduped['queries'] = deduped['_key'].map(lambda k: ', '.join(query_map[k]))
    deduped['query_count'] = deduped['_key'].map(lambda k: len(query_map[k]))
    deduped['high_relevance'] = deduped['query_count'] >= 2

    deduped = deduped.drop(columns=['_query', '_doi_norm', '_oa_id', '_key'])
    deduped = deduped.sort_values(['query_count', 'year'], ascending=[False, False]).reset_index(drop=True)

    total_unique = len(deduped)
    duplicates_removed = total_raw - total_unique
    high_rel = int(deduped['high_relevance'].sum())
    missing_doi_count = (deduped['doi'].isna() | (deduped['doi'] == '')).sum() if 'doi' in deduped.columns else 0

    deduped.to_csv(opts.output, index=False)

    c.print()
    print_ok(f'{total_raw} records in')
    print_ok(f'{duplicates_removed} duplicate{"s" if duplicates_removed != 1 else ""} removed')
    print_ok(f'{total_unique} unique papers written to {opts.output}')
    print_arrow(f'{high_rel} appear in 2+ queries (high relevance)')
    if missing_doi_count:
        print_arrow(f'{missing_doi_count} records with missing DOI')
    c.print()

    if opts.dois:
        dois = deduped['doi'].dropna().tolist() if 'doi' in deduped.columns else []
        dois = [str(d).strip() for d in dois if str(d).strip()]
        Path(opts.dois).write_text('\n'.join(dois) + '\n')
        print_ok(f'{len(dois)} DOIs written to {opts.dois}')
        c.print()
