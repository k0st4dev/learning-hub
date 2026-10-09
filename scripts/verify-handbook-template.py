"""Independent Word/CSV checks of copy sources; no runtime or database."""
from pathlib import Path
import csv
import hashlib
import json
import sys
import zipfile
import xml.etree.ElementTree as ET

assert sys.argv[1:] in ([], ['--report'], ['--prompts'], ['--prompts', '--report'])
prompts = '--prompts' in sys.argv
root = Path(__file__).resolve().parents[1]
directory = root / 'content/se-26w-v1/source'
source = json.loads((directory / 'curriculum-source.json').read_text(encoding='utf-8'))
word = directory / source['source']['filename']
assert hashlib.sha256(word.read_bytes()).hexdigest() == source['source']['sha256']
w = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
with zipfile.ZipFile(word) as archive:
    document = ET.fromstring(archive.read('word/document.xml'))
paragraphs = document.find(w + 'body').findall('.//' + w + 'p')
blocks = {row['source_id']: row for row in source['source_blocks']}
with (directory / 'source-to-website.csv').open(encoding='utf-8-sig', newline='') as stream:
    mappings = list(csv.DictReader(stream))


def verify(ref, route):
    paragraph = paragraphs[int(ref[1:]) - 1]
    text = ''.join((node.text or '') if node.tag == w + 't'
                   else '\t' if node.tag == w + 'tab'
                   else '\n' if node.tag in (w + 'br', w + 'cr') else ''
                   for node in paragraph.iter())
    assert text == blocks[ref]['text']
    mapping = [row for row in mappings if row['source_id'] == ref]
    assert len(mapping) == 1
    assert mapping[0]['source_text'] == text
    assert mapping[0]['website_location'] == route
    return {'sourceId': ref, 'characters': len(text),
            'textSha256': hashlib.sha256(text.encode('utf-8')).hexdigest()}


if prompts:
    route = '/course/software-engineer/guide/ai-protocol'
    protocol = [row for row in mappings if row['website_location'] == route]
    assert len(protocol) == 24
    for row in protocol:
        verify(row['source_id'], route)
    labels = ['Socratic tutor', 'Problem trainer', 'Code reviewer', 'Debugger',
              'Test engineer', 'Transfer trainer', 'Explain-back', 'Interview mode']
    verified = []
    for number, label in enumerate(labels, 70):
        ref = f'p{number:04d}'
        assert blocks[ref]['text'].startswith(label + ': “')
        assert blocks[ref]['text'].endswith('”')
        verified.append(verify(ref, route))
    report = {'prompts': verified, 'completePromptCount': 8, 'exactProtocolBlocks': 24,
              'exactWordAndCsv': True, 'prefixesAndQuotesPreserved': True,
              'databaseAccess': False, 'networkAccess': False}
else:
    report = verify('p2228', '/course/software-engineer/guide/appendix-a')
    assert blocks['p2228']['text'].endswith('\n')
    report.update({'exactWordAndCsv': True, 'trailingNewlinePreserved': True,
                   'databaseAccess': False, 'networkAccess': False})
if '--report' in sys.argv:
    name = 'm6-step21-word-audit.json' if prompts else 'm6-step20-word-audit.json'
    (root / 'docs' / name).write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, indent=2))
