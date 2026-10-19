"""Exercise same-day history and source routing without changing repository data."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import vocab


class SupplementaryHistory(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.old_root = vocab.ROOT
        vocab.ROOT = Path(self.temp.name)
        (vocab.ROOT / 'days').mkdir()
        (vocab.ROOT / 'data').mkdir()
        (vocab.ROOT / 'index.html').write_text('2026-10-19.html 2026-10-19-extra.html 2026-10-20.html')
        self.original = {'days': {'2026-10-18': {'new': ['legacy', 'older'], 'note': 'preserve'}}}
        (vocab.ROOT / 'data/vocab-log.json').write_text(json.dumps(self.original))
        self.page('2026-10-19', ['primary'], ['legacy'])
        self.page('2026-10-19-extra', ['supplement'], ['older'])

    def tearDown(self):
        vocab.ROOT = self.old_root
        self.temp.cleanup()

    def page(self, name, new, review):
        text = ''.join('window.KAOYAN_'+key+'='+json.dumps(value)+';' for key, value in
                       [('NEW', dict.fromkeys(new, 'meaning')), ('REVIEW', dict.fromkeys(review, 'meaning')),
                        ('IPA', dict.fromkeys(new+review, '/test/')), ('AUDIO', {})])
        text += '<script src="../app.js"></script><script src="../sync.js"></script>'
        (vocab.ROOT / 'days' / (name+'.html')).write_text(text)

    def test_sync_keeps_primary_history_and_indexes_supplement_source(self):
        vocab.sync()
        log = json.loads((vocab.ROOT / 'data/vocab-log.json').read_text())
        self.assertEqual(log['days']['2026-10-18'], self.original['days']['2026-10-18'])
        self.assertEqual(set(log['days']['2026-10-19']['new']), {'primary', 'supplement'})
        self.assertEqual(log['days']['2026-10-19']['review'], {'older': 1, 'legacy': 1})
        self.assertEqual(vocab.origins()['supplement'], '2026-10-19')
        sources = json.loads((vocab.ROOT / 'data/word-source-overrides.json').read_text())
        self.assertEqual(sources, {'supplement': '2026-10-19-extra.html'})

    def test_same_day_and_future_duplicates_are_rejected(self):
        self.page('2026-10-19-extra', ['primary', 'supplement'], ['older'])
        self.assertIn('same-day new words: primary', vocab.validate('2026-10-19-extra'))
        self.page('2026-10-20', ['supplement'], [])
        self.assertIn('historical new words: supplement', vocab.validate('2026-10-20'))


if __name__ == '__main__':
    unittest.main()
