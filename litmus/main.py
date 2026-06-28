import sys

VERSION = '1.0.0'


def usage():
    print(f'litmus {VERSION}: SLR corpus processor for OpenAlex CSV exports\n')
    print('Usage:')
    print('  litmus merge  [files...]  [--output FILE] [--dois FILE]')
    print('  litmus filter [file]      [--output FILE] [--from-year N] [--to-year N] [--keyword TERM]')
    print('  litmus stats  [file]')
    print('  litmus screen [file]      [--output FILE]')
    print('  litmus dupes  [file]      [--output FILE] [--threshold N]')
    print()
    print('Commands:')
    print('  merge   Merge and deduplicate multiple query CSVs into one master file')
    print('  filter  Filter by year range or abstract keyword')
    print('  stats   Summary statistics and corpus analysis')
    print('  screen  Interactive inclusion/exclusion screening')
    print('  dupes   Fuzzy duplicate detection and resolution')
    print()
    print('Options for merge:')
    print('  --output       Output CSV file (default: master.csv)')
    print('  --dois         Also write a plain DOI list to this file')
    print()
    print('Options for filter:')
    print('  --output       Output CSV file (default: filtered.csv)')
    print('  --from-year    Earliest year to include')
    print('  --to-year      Latest year to include')
    print('  --keyword      Term to match in abstract (repeatable, default AND logic)')
    print('  --or           Use OR logic between keywords')
    print()
    print('Options for screen:')
    print('  --output       Output CSV file (default: writes back to input file)')
    print()
    print('Options for dupes:')
    print('  --output       Output CSV file (default: writes back to input file)')
    print('  --threshold    Similarity threshold 0-100 (default: 85)')
    print()


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ('--help', '-h', 'help'):
        usage()
        sys.exit(0)

    if sys.argv[1] in ('--version', '-V', 'version'):
        print(f'litmus {VERSION}')
        sys.exit(0)

    cmd = sys.argv[1]
    args = sys.argv[2:]

    if cmd == 'merge':
        from merge import run_merge
        run_merge(args)
    elif cmd == 'filter':
        from filter import run_filter
        run_filter(args)
    elif cmd == 'stats':
        from stats import run_stats
        run_stats(args)
    elif cmd == 'screen':
        from screen import run_screen
        run_screen(args)
    elif cmd == 'dupes':
        from dupes import run_dupes
        run_dupes(args)
    else:
        print(f'litmus: unknown command "{cmd}"\n', file=sys.stderr)
        usage()
        sys.exit(1)


if __name__ == '__main__':
    main()
