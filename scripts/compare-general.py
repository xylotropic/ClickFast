#!/usr/bin/env python3
"""Compare completed physical workflow records; preserve all failed attempts."""
import argparse
import html
import json
from pathlib import Path
from statistics import median

p = argparse.ArgumentParser()
p.add_argument('native')
p.add_argument('--mirroring', default='2026-11-12-mirroring-twenty')
p.add_argument('--output', required=True)
p.add_argument('--native-playback')
p.add_argument('--mirroring-playback')
a = p.parse_args()
root = Path(__file__).resolve().parents[1]

def read(session):
    report = json.loads((root / 'benchmarks/runs' / session / 'results.json').read_text())
    if report.get('fatal_error') or not report.get('runs'):
        raise ValueError('A completed session without a fatal error is required')
    rows = report['runs']
    if any(not isinstance(r.get('ok'), bool) for r in rows) or not (
            report.get('finished_at') or all(r.get('finished_at') for r in rows)):
        raise ValueError('A running or incomplete session cannot be compared')
    if len(rows) != len({r['task'] for r in rows}):
        raise ValueError('Repeated attempts must be compared separately')
    return {r['task']: r for r in rows}

native, mirroring = read(a.native), read(a.mirroring)
if native.keys() != mirroring.keys():
    raise ValueError('The sessions must contain the same distinct task intents')

def passed(r):
    return bool(r.get('ok') and r.get('verified') and r.get('elapsed_ms', 0) > 0)

rows = []
for task, n in native.items():
    m = mirroring[task]
    both = passed(n) and passed(m)
    rows.append(dict(task=task, native_ok=passed(n), mirroring_ok=passed(m),
                     native_ms=n.get('elapsed_ms'), mirroring_ms=m.get('elapsed_ms'),
                     both_verified=both, ratio=m['elapsed_ms']/n['elapsed_ms'] if both else None,
                     native_error=n.get('error'), mirroring_error=m.get('error')))
pairs = [r for r in rows if r['both_verified']]
report = dict(schema=1, native_session=a.native, mirroring_session=a.mirroring,
              method='One attempt per distinct intent on one iPhone. Home-to-result wall time includes input, decisions and verification. ClickFast uses bounded local JEV plus exact caller-provided primitives; Mirroring uses the outer coding agent and authorized Computer Use. App warm state, scroll paths and observation methods differ. This measures these workflows, not driver latency, human speed, all-app reliability or market superiority. Failures remain visible and are excluded from timing ratios.',
              attempts=len(rows), native_verified=sum(r['native_ok'] for r in rows),
              mirroring_verified=sum(r['mirroring_ok'] for r in rows), paired_verified=len(pairs),
              paired_native_median_ms=median(r['native_ms'] for r in pairs) if pairs else None,
              paired_mirroring_median_ms=median(r['mirroring_ms'] for r in pairs) if pairs else None,
              paired_ratio_median=median(r['ratio'] for r in pairs) if pairs else None, runs=rows)
out = Path(a.output).resolve()
out.mkdir(parents=True, exist_ok=True)
(out/'comparison.json').write_text(json.dumps(report, indent=2)+'\n')
summary = f"ClickFast verified {report['native_verified']}/{len(rows)}; Mirroring verified {report['mirroring_verified']}/{len(rows)}."
timing = (f"Across {len(pairs)} pairs verified on both paths, median task time was {report['paired_native_median_ms']/1000:.3f} s for ClickFast and {report['paired_mirroring_median_ms']/1000:.3f} s for Mirroring. The median per-task ratio was {report['paired_ratio_median']:.2f}×." if pairs else 'No pair was verified on both paths; no speed ratio is reported.')
header = '# Recorded general phone tasks\n\n'+summary+' '+timing+'\n\n'+report['method']+'\n\n'
table = '| Task | ClickFast | Mirroring | Ratio, both verified |\n| --- | --- | --- | --- |\n'
cards = []
for r in rows:
    def label(prefix):
        ms = r[prefix+'_ms']
        return ('Verified' if r[prefix+'_ok'] else 'Failed')+(f' · {ms/1000:.3f} s' if ms is not None else ' · incomplete')
    ratio = f"{r['ratio']:.2f}×" if r['ratio'] else '—'
    table += f"| {r['task']} | {label('native')} | {label('mirroring')} | {ratio} |\n"
    videos = []
    for prefix, folder, source in [('native', a.native_playback, native), ('mirroring', a.mirroring_playback, mirroring)]:
        video = ''
        if folder:
            # Playback exports use source run names; verify the actual file exists.
            path = Path(folder).resolve()/'videos'/(source[r['task']]['name']+'.mp4')
            if not path.is_file():
                raise ValueError(f'Missing recording: {path}')
            import os
            video = '<video controls muted playsinline preload="none" src="'+html.escape(os.path.relpath(path, out), quote=True)+'"></video>'
        videos.append('<div><h3>'+('ClickFast' if prefix == 'native' else 'Mirroring')+'</h3><p>'+html.escape(label(prefix))+'</p>'+video+'</div>')
    cards.append('<article><h2>'+html.escape(r['task'])+'</h2><section>'+''.join(videos)+'</section></article>')
(out/'comparison.md').write_text(header+table)
(out/'index.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ClickFast / Mirroring</title><style>body{background:#121212;color:#eee;max-width:1100px;margin:64px auto;padding:0 24px;font:16px system-ui;line-height:1.6}h1{font-size:44px;letter-spacing:-2px}p{color:#aaa}a{color:#eee}article{border-top:1px solid #333;margin-top:48px}section{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:32px}video{width:100%;height:auto;display:block}h3{font-size:16px}@media(max-width:650px){section{grid-template-columns:1fr}}</style><h1>ClickFast / Mirroring</h1><p>'+html.escape(summary+' '+timing)+'</p><p>'+html.escape(report['method'])+'</p><p><a href="comparison.json">Measurements</a></p>'+''.join(cards)+'</html>')
print(json.dumps({k:v for k,v in report.items() if k != 'runs'}))
