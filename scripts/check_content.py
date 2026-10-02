"""Fail on newly introduced contract errors; retain an explicit legacy baseline."""
import json
from pathlib import Path
from vocab import ROOT, validate
baseline_path = ROOT / 'tests/content-baseline.json'
current = {p.stem: validate(p.stem) for p in sorted((ROOT/'days').glob('20??-??-??.html'))}
baseline = json.loads(baseline_path.read_text())
errors = []
for day, issues in current.items():
    known = baseline.get(day, [])
    errors.extend(f'{day}: {issue}' for issue in issues if issue not in known)
if errors:
    raise SystemExit('\n'.join(errors))
print(f'PASS: {len(current)} daily pages; no new content-contract violations')
