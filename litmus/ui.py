from rich.console import Console
from rich.panel import Panel
from rich.rule import Rule
from rich.table import Table
from rich import box

c = Console()

PANEL_WIDTH = 70


def print_header(title, subtitle=''):
    body = f'[bold]{title}[/bold]'
    if subtitle:
        body += f'\n[dim]{subtitle}[/dim]'
    c.print(Panel(body, border_style='cyan', width=PANEL_WIDTH, padding=(0, 1)))
    c.print()


def print_rule(label=''):
    if label:
        c.print(Rule(label, style='dim'))
    else:
        c.print(Rule(style='dim'))


def print_ok(msg):
    c.print(f'  [bold green]✓[/bold green]  {msg}')


def print_fail(msg):
    c.print(f'  [bold red]✗[/bold red]  {msg}')


def print_arrow(msg):
    c.print(f'  [bold yellow]→[/bold yellow]  {msg}')


def print_table(headers, rows, row_styles=None):
    t = Table(box=box.SIMPLE_HEAD, show_edge=False, header_style='bold')
    for h in headers:
        t.add_column(h)
    for i, row in enumerate(rows):
        style = row_styles[i] if row_styles and i < len(row_styles) else ''
        t.add_row(*[str(v) for v in row], style=style)
    c.print(t)


def bar_chart(data, title, max_width=36):
    if not data:
        return
    max_val = max(data.values()) if data else 1
    c.print(f'\n  [bold]{title}[/bold]\n')
    for label, val in sorted(data.items()):
        filled = int((val / max_val) * max_width) if max_val > 0 else 0
        bar = '█' * filled
        c.print(f'  [cyan]{str(label):>6}[/cyan]  [green]{bar:<{max_width}}[/green]  {val}')
    c.print()
