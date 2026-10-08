"""Read-only verification of the resource proposal against the original Word manual.

Uses Python standard library only. No database, importer or runtime changes.
"""
from pathlib import Path
from collections import Counter
import hashlib
import json
import zipfile
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
directory = root / 'content/se-26w-v1/source'
source = json.loads((directory / 'curriculum-source.json').read_text(encoding='utf-8'))
proposal = json.loads((root / 'docs/resource-metadata-proposal.json').read_text(encoding='utf-8'))
w = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def digest(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def paragraph_text(element):
    return ''.join(
        (node.text or '') if node.tag == w + 't'
        else '\t' if node.tag == w + 'tab'
        else '\n' if node.tag in (w + 'br', w + 'cr')
        else '' for node in element.iter()
    )


with zipfile.ZipFile(directory / source['source']['filename']) as archive:
    document = ET.fromstring(archive.read('word/document.xml'))
    paragraphs = document.find(w + 'body').findall('.//' + w + 'p')
    exact = [paragraph_text(element) for element in paragraphs]
    assert exact == [block['text'] for block in source['source_blocks']]
    tables = document.findall('.//' + w + 'tbl')
    assert len(tables) == 197
    coordinates = {}
    for table_number, table in enumerate(tables, 1):
        for row_number, row in enumerate(table.findall(w + 'tr'), 1):
            for cell_number, cell in enumerate(row.findall(w + 'tc'), 1):
                for element in cell.findall('.//' + w + 'p'):
                    coordinates[id(element)] = (table_number, row_number, cell_number)
    for element, block in zip(paragraphs, source['source_blocks']):
        expected = (block['table'], block['row'], block['cell']) if block['in_table'] else None
        assert coordinates.get(id(element)) == expected
    relationships = {
        row.attrib['Id']: row.attrib['Target']
        for row in ET.fromstring(archive.read('word/_rels/document.xml.rels'))
    }
    relation_id = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'
    links = [(paragraph_text(element), relationships[element.attrib[relation_id]])
             for element in document.findall('.//' + w + 'hyperlink') if relation_id in element.attrib]
    assert links == [(link['label'], link['url']) for block in source['source_blocks'] for link in block['links']]

word_sha = hashlib.sha256((directory / source['source']['filename']).read_bytes()).hexdigest()
assert word_sha == source['source']['sha256'] == proposal['wordSha256']
assert proposal['status'] == 'proposal-only-not-runtime'
assert proposal['releaseId'] == source['release_id']
assert proposal['manifestSha256'] == '064d4412b280d54c7bf2fb229e7ec643eb3dc8ab85f9311bf9f9a5749c5cb265'
blocks = {block['source_id']: block for block in source['source_blocks']}
evidence = {row['sourceId']: row for row in proposal['evidence']}
assert len(evidence) == len(proposal['evidence'])
for ref, row in evidence.items():
    original = blocks[ref]
    assert row['exactText'] == original['text']
    assert row['sha256'] == digest(original['text'])
    for key in ('table', 'row', 'cell'):
        assert row[key] == original.get(key)

prefix = source['release_id'] + ':'
canonical = {prefix + row['id']: row for row in source['resources']}
assert len(proposal['resources']) == 69
assert len({row['resourceId'] for row in proposal['resources']}) == 69
assert len(proposal['uses']) == 290
assert len({row['useId'] for row in proposal['uses']}) == 290
resource_ids = {row['resourceId'] for row in proposal['resources']}
use_ids = {row['useId'] for row in proposal['uses']}
source_mentions = {row['source_id']: row for row in source['resource_mentions']}
for row in proposal['resources']:
    assert row['resourceId'] == row['raw']['id']
    assert row['raw']['type'] == 'reference'
    assert row['raw']['linkStatus'] == 'unchecked'
    assert row['raw']['resolvedUrl'] is None
    original = canonical.get(row['resourceId'])
    if original:
        assert row['raw']['title'] == original['title']
        assert row['raw']['originalUrl'] == original['url']
        assert row['raw']['descriptionMarkdown'] == original['source_role']
    else:
        assert row['raw']['originalUrl'] is None
        assert row['raw']['linkOrigin'] == 'unresolved'
        assert row['raw']['title'] == source_mentions[row['evidenceRefs'][0]]['exact_instruction']

for row in proposal['uses']:
    assert row['useId'] == row['raw']['id']
    assert row['raw']['resourceId'] in resource_ids
    assert row['raw']['requirementMode'] == 'reference'
    assert row['proposed']['requirementMode'] in ('required', 'optional', 'reference', 'conditional')
    assert row['proposed']['rule'] in proposal['rules']
    assert row['raw']['assignedText'] in blocks[row['sourceId']]['text']
    if ':mention:' in row['useId']:
        mention = source_mentions[row['sourceId']]
        assert row['raw']['assignedText'] == mention['exact_instruction']
        assert row['raw']['sectionLocator'] == mention['exact_instruction']
        assert row['raw']['contentItemId'] == prefix + mention['context']
assert {row['sourceId'] for row in proposal['uses'] if ':mention:' in row['useId']} == set(source_mentions)
assert len([row for row in proposal['uses'] if ':hyperlink:' in row['useId']]) == 19
for row in proposal['parentSuggestions']:
    assert row['useId'] in use_ids
    assert prefix + row['proposedParentResourceKey'] in canonical
for row in proposal['additionalMentions']:
    assert row['originalUrl'] is None and row['sourceDirectLinkSupplied'] is False
    assert row['exactInstruction'] == source_mentions[row['sourceId']]['exact_instruction']
    assert row['context'] == source_mentions[row['sourceId']]['context']
    assert row['proposed']['parentResourceKey'] is None or prefix + row['proposed']['parentResourceKey'] in canonical
for row in proposal['resources'] + proposal['uses'] + proposal['parentSuggestions'] + proposal['additionalMentions']:
    assert all(ref in evidence for ref in row['evidenceRefs'])
assert dict(Counter(row['proposed']['type'] for row in proposal['resources'])) == proposal['summary']['proposedTypes']
assert dict(Counter(row['proposed']['requirementMode'] for row in proposal['uses'])) == proposal['summary']['proposedUseModes']

print(json.dumps({
    'status': 'original-word-and-proposal-verified',
    'wordSha256': word_sha,
    'exactBodyParagraphs': len(exact),
    'exactTableCoordinates': len(exact),
    'tables': len(tables),
    'exactResourceMentions': len(source_mentions),
    'existingResources': len(resource_ids),
    'exactExistingUses': len(use_ids),
    'originalHyperlinkUses': len(links),
    'originalUrls': len(set(url for _, url in links)),
    'proposalEvidenceBlocks': len(evidence),
    'runtimeChanges': False,
}, indent=2))
