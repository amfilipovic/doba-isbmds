import sys
import re
import argparse
from collections import Counter
from pathlib import Path

import pandas as pd

from ui import c, print_header, print_rule, print_ok, print_fail, print_arrow, print_table, bar_chart

STOPWORDS = {
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'this', 'that', 'these', 'those',
    'it', 'its', 'we', 'our', 'they', 'their', 'not', 'no', 'so', 'such',
    'also', 'than', 'then', 'when', 'where', 'which', 'who', 'how', 'what',
    'if', 'while', 'however', 'therefore', 'all', 'any', 'both', 'very',
    'just', 'about', 'paper', 'study', 'research', 'results', 'findings',
    'using', 'used', 'use', 'based', 'one', 'two', 'three', 'well', 'new',
    'many', 'most', 'other', 'only', 'first', 'show', 'shows', 'shown',
    'found', 'find', 'provide', 'provides', 'article', 'aim', 'aims',
    'examine', 'investigate', 'explores', 'explore', 'propose', 'suggest',
    'indicate', 'include', 'including', 'related', 'across', 'since',
    'due', 'given', 'high', 'low', 'following', 'particular', 'specific',
    'general', 'current', 'recent', 'various', 'potential', 'level',
    'number', 'type', 'way', 'order', 'need', 'work', 'often', 'make',
    'become', 'can', 'i', 'you', 'he', 'she', 'me', 'him', 'her', 'us',
    'them', 'my', 'your', 'his', 'their', 's', 'been', 'between', 'among',
    'into', 'through', 'further', 'more', 'less', 'each', 'per', 'within',
    'without', 'towards', 'different', 'important', 'significant', 'key',
    'main', 'several', 'present', 'existing', 'large', 'small', 'long',
    'short', 'get', 'take', 'made', 'make', 'two', 'three', 'four', 'five',
    'also', 'however', 'therefore', 'thus', 'hence', 'moreover', 'e', 'g',
    'i', 'e', 'et', 'al', 'data', 'analysis', 'approach', 'model'
}


def parse_authors(author_str):
    if pd.isna(author_str) or str(author_str).strip() == '':
        return []
    parts = re.split(r',\s*', str(author_str))
    authors = []
    for p in parts:
        name = p.replace(' et al.', '').strip()
        if name:
            authors.append(name)
    return authors


def run_stats(args):
    parser = argparse.ArgumentParser(prog='litmus stats', add_help=False)
    parser.add_argument('file', nargs='?', default='')
    parser.add_argument('--top', type=int, default=10)
    opts = parser.parse_args(args)

    if not opts.file:
        print_fail('no input file provided')
        print('  Usage: litmus stats master.csv')
        sys.exit(1)

    p = Path(opts.file)
    if not p.exists():
        print_fail(f'not found: {opts.file}')
        sys.exit(1)

    df = pd.read_csv(p)
    total = len(df)

    print_header('litmus stats', f'{p.name}  ·  {total} records')

    print_rule('overview')
    c.print()
    print_ok(f'{total} total records')

    if 'open_access' in df.columns:
        oa_count = (df['open_access'].str.lower().str.strip() == 'yes').sum()
        oa_pct = round(oa_count / total * 100, 1) if total else 0
        print_ok(f'{oa_count} open access ({oa_pct}%)')

    if 'high_relevance' in df.columns:
        hr = int(df['high_relevance'].sum())
        print_arrow(f'{hr} high relevance (appear in 2+ queries)')

    if 'year' in df.columns:
        years = pd.to_numeric(df['year'], errors='coerce').dropna()
        if len(years):
            print_arrow(f'years: {int(years.min())} to {int(years.max())}')

    c.print()

    if 'year' in df.columns:
        print_rule('publication trend')
        years = pd.to_numeric(df['year'], errors='coerce').dropna().astype(int)
        year_counts = dict(Counter(years.tolist()))
        bar_chart(year_counts, 'Papers per year')

    if 'open_access' in df.columns and 'year' in df.columns:
        print_rule('open access by year')
        c.print()
        oa_df = df.copy()
        oa_df['_year'] = pd.to_numeric(oa_df['year'], errors='coerce')
        oa_df['_oa'] = oa_df['open_access'].str.lower().str.strip() == 'yes'
        oa_by_year = oa_df.groupby('_year').agg(total=('_oa', 'count'), oa=('_oa', 'sum')).reset_index()
        oa_by_year = oa_by_year.sort_values('_year')
        rows = []
        for _, row in oa_by_year.iterrows():
            pct = round(row['oa'] / row['total'] * 100, 1) if row['total'] else 0
            rows.append([str(int(row['_year'])), str(int(row['total'])), str(int(row['oa'])), f'{pct}%'])
        print_table(['Year', 'Total', 'OA', '%'], rows)
        c.print()

    if 'source' in df.columns:
        print_rule('top journals')
        sources = df['source'].dropna()
        source_counts = Counter(sources.tolist())
        top_sources = source_counts.most_common(opts.top)
        total_papers = sum(source_counts.values())
        cumulative = 0
        rows = []
        for journal, count in top_sources:
            cumulative += count
            pct = round(count / total_papers * 100, 1) if total_papers else 0
            cum_pct = round(cumulative / total_papers * 100, 1) if total_papers else 0
            rows.append([journal[:55], str(count), f'{pct}%', f'{cum_pct}%'])
        print_table(['Journal', 'Papers', '%', 'Cumulative'], rows)

        covered_80 = 0
        cum = 0
        for _, count in source_counts.most_common():
            cum += count
            covered_80 += 1
            if cum / total_papers >= 0.80:
                break
        print_arrow(f'{covered_80} journal{"s" if covered_80 != 1 else ""} account for 80% of the corpus')
        c.print()

    if 'authors' in df.columns:
        print_rule('top authors')
        all_authors = []
        for author_str in df['authors'].dropna():
            all_authors.extend(parse_authors(author_str))
        author_counts = Counter(all_authors)
        top_authors = author_counts.most_common(opts.top)
        rows = [[name, str(count)] for name, count in top_authors]
        print_table(['Author', 'Papers'], rows)

        top3_total = sum(n for _, n in author_counts.most_common(3))
        top3_pct = round(top3_total / total * 100, 1) if total else 0
        print_arrow(f'top 3 authors appear in {top3_pct}% of papers')
        c.print()

    if 'authors' in df.columns:
        print_rule('co-authorship concentration')
        solo = 0
        pair = 0
        group = 0
        for author_str in df['authors'].dropna():
            n = len(parse_authors(author_str))
            if n == 1:
                solo += 1
            elif n == 2:
                pair += 1
            else:
                group += 1
        rows = [
            ['Single author', str(solo), f'{round(solo/total*100,1)}%'],
            ['Two authors', str(pair), f'{round(pair/total*100,1)}%'],
            ['Three or more', str(group), f'{round(group/total*100,1)}%'],
        ]
        print_table(['Authorship', 'Papers', '%'], rows)
        c.print()

    if 'abstract' in df.columns:
        print_rule('abstract word frequency')
        combined_text = ' '.join(df['abstract'].dropna().tolist()).lower()
        tokens = re.findall(r'\b[a-z]{3,}\b', combined_text)
        filtered = [t for t in tokens if t not in STOPWORDS]
        word_counts = Counter(filtered)
        top_words = word_counts.most_common(opts.top)
        rows = [[word, str(count)] for word, count in top_words]
        print_table(['Term', 'Count'], rows)
        c.print()
