"""Deterministic vocabulary history, candidate checks and publication validation.
Never replace historical lists with a truncated or latest-page-only snapshot.
"""
import argparse
import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NORM = lambda w: ' '.join(str(w).strip().lower().split())

def pages():
    return sorted(p for p in (ROOT / 'days').glob('20??-??-??*.html')
                  if re.fullmatch(r'\d{4}-\d{2}-\d{2}(?:-[a-z0-9-]+)?', p.stem))

def publication_date(page_id):
    return page_id[:10]

def maps(page):
    text = page.read_text(encoding='utf-8')
    result = {}
    for name in ('NEW', 'REVIEW', 'IPA', 'AUDIO'):
        m = re.search(r'window\.KAOYAN_' + name + r'\s*=\s*', text)
        if m:
            try:
                value, _ = json.JSONDecoder().raw_decode(text[m.end():])
                if isinstance(value, dict):
                    result[name] = value
            except ValueError:
                pass
    return result

def history():
    days = {}
    def add(day, entry):
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', day):
            return
        words = entry.get('new', [])
        days.setdefault(day, set()).update(NORM(w) for w in words if isinstance(w, str))
    for path in sorted((ROOT / 'data').glob('vocab*.json')):
        data = json.loads(path.read_text())
        if not isinstance(data, dict):
            continue
        for day, entry in (data.get('days') or data.get('confirmed_target_days') or {}).items():
            add(day, entry)
        if data.get('date'):
            add(data['date'], data)
    for page in pages():
        add(publication_date(page.stem), {'new': maps(page).get('NEW', {})})
    return days

def origins():
    out = {}
    for day, words in sorted(history().items()):
        for word in sorted(words):
            out.setdefault(word, day)
    return out

def validate(day, mastered=()):
    page = ROOT / 'days' / (day + '.html')
    published = publication_date(day)
    data = maps(page)
    issues = []
    new = [NORM(w) for w in data.get('NEW', {})]
    review = [NORM(w) for w in data.get('REVIEW', {})]
    if len(new) != 50 or len(set(new)) != 50:
        issues.append(f'expected 50 unique new words, found {len(set(new))}')
    first = origins()
    duplicates = [w for w in new if first.get(w, published) < published]
    if duplicates:
        issues.append('historical new words: ' + ', '.join(duplicates))
    same_day = set()
    for other in pages():
        if other != page and publication_date(other.stem) == published:
            same_day.update(set(new) & maps(other).get('NEW', {}).keys())
    if same_day:
        issues.append('same-day new words: ' + ', '.join(sorted(same_day)))
    if set(new) & set(review):
        issues.append('new/review overlap: ' + ', '.join(sorted(set(new) & set(review))))
    for name in ('NEW', 'REVIEW', 'IPA', 'AUDIO'):
        if name not in data:
            issues.append('missing readable KAOYAN_' + name)
    for word in new + review:
        if not data.get('IPA', {}).get(word):
            issues.append('missing IPA: ' + word)
    for word, url in data.get('AUDIO', {}).items():
        if not isinstance(url, str) or not url.startswith('https://'):
            issues.append('invalid audio URL: ' + word)
    for word in review:
        if word not in first:
            issues.append('review has no first-learning date: ' + word)
        elif (date.fromisoformat(published) - date.fromisoformat(first[word])).days not in (1, 2, 4, 7, 15, 30):
            issues.append('review outside scheduled interval: ' + word)
    excluded = set(new + review) & set(map(NORM, mastered))
    if excluded:
        issues.append('mastered words selected: ' + ', '.join(sorted(excluded)))
    text = page.read_text()
    for script in ('app.js', 'sync.js'):
        if len(re.findall(r'<script\b[^>]*src=[\"\x27][^\"\x27]*' + re.escape(script), text)) != 1:
            issues.append('must load exactly once: ' + script)
    if day + '.html' not in (ROOT / 'index.html').read_text():
        issues.append('missing homepage link')
    return issues

def sync():
    path = ROOT / 'data/vocab-log.json'
    log = json.loads(path.read_text())
    days = log.setdefault('days', {})
    first = origins()
    page_maps = {p: maps(p) for p in pages()}
    for day, words in sorted(history().items()):
        entry = days.setdefault(day, {})
        # Preserve every historical target, including inconsistent incremental logs.
        entry['new'] = list(dict.fromkeys(entry.get('new', [])))
        entry['new'].extend(sorted(words - set(entry['new'])))
        reviews = {}
        has_review = False
        for page, data in page_maps.items():
            if publication_date(page.stem) == day and 'REVIEW' in data:
                has_review = True
                reviews.update({NORM(w): (date.fromisoformat(day)-date.fromisoformat(first[NORM(w)])).days if NORM(w) in first else None for w in data['REVIEW']})
        if has_review:
            entry['review'] = reviews
    path.write_text(json.dumps(log, ensure_ascii=False, indent=2) + '\n')
    (ROOT / 'data/word-origins.json').write_text(json.dumps(first, ensure_ascii=False, indent=2) + '\n')
    # A supplementary reading shares a learning date, but has its own source page.
    overrides = {}
    for page, data in page_maps.items():
        day = publication_date(page.stem)
        primary = page_maps.get(ROOT / 'days' / (day + '.html'), {}).get('NEW', {})
        if page.stem != day:
            for word in data.get('NEW', {}):
                if first.get(NORM(word)) == day and word not in primary:
                    overrides.setdefault(NORM(word), page.name)
    (ROOT / 'data/word-source-overrides.json').write_text(json.dumps(overrides, ensure_ascii=False, indent=2) + '\n')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--date')
    parser.add_argument('--sync', action='store_true')
    parser.add_argument('--audit', action='store_true')
    parser.add_argument('--mastered', type=Path, help='Private JSON array or exported {mastered:[...]} snapshot; do not commit')
    args = parser.parse_args()
    if args.sync:
        sync()
    if args.audit:
        for page in pages():
            issues = validate(page.stem)
            if issues:
                print(page.stem + ': ' + '\n  '.join(issues))
    if args.date:
        mastered = json.loads(args.mastered.read_text()) if args.mastered else []
        if isinstance(mastered, dict):
            mastered = mastered.get('mastered', [])
        issues = validate(args.date, mastered)
        print('\n'.join(issues) if issues else 'PASS ' + args.date)
        raise SystemExit(bool(issues))
