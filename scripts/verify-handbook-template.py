"""Independent Word/CSV check of the Appendix A copy source; no runtime or DB."""
from pathlib import Path
import csv
import hashlib
import json
import sys
import zipfile
import xml.etree.ElementTree as ET

assert sys.argv[1:] in ([], ['--report'])
root = Path(__file__).resolve().parents[1]
directory = root / 'content/se-26w-v1/source'
source = json.loads((directory / 'curriculum-source.json').read_text(encoding='utf-8'))
word = directory / source['source']['filename']
assert hashlib.sha256(word.read_bytes()).hexdigest() == source['source']['sha256']
w = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
with zipfile.ZipFile(word) as archive:
    document = ET.fromstring(archive.read('word/document.xml'))
paragraph = document.find(w + 'body').findall('.//' + w + 'p')[2227]
text = ''.join((node.text or '') if node.tag == w + 't'
               else '\t' if node.tag == w + 'tab'
               else '\n' if node.tag in (w + 'br', w + 'cr') else ''
               for node in paragraph.iter())
block = next(row for row in source['source_blocks'] if row['source_id'] == 'p2228')
assert text == block['text'] and text.endswith('\n')
with (directory / 'source-to-website.csv').open(encoding='utf-8-sig', newline='') as stream:
    mapping = [row for row in csv.DictReader(stream) if row['source_id'] == 'p2228']
assert len(mapping) == 1
assert mapping[0]['source_text'] == text
assert mapping[0]['website_location'] == '/course/software-engineer/guide/appendix-a'
report = {'sourceId': 'p2228', 'characters': len(text),
          'textSha256': hashlib.sha256(text.encode('utf-8')).hexdigest(),
          'exactWordAndCsv': True, 'trailingNewlinePreserved': True,
          'databaseAccess': False, 'networkAccess': False}
if '--report' in sys.argv:
    (root / 'docs/m6-step20-word-audit.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, indent=2))
