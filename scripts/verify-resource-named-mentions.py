"""Independent developer-only review verification against original Word and CSV.

No application imports, database access, network or third-party packages.
Optional --report writes only the focused verification report under docs.
"""
from pathlib import Path
from collections import Counter
import csv
import hashlib
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

assert sys.argv[1:] in ([], ['--report'], ['--frozen'], ['--frozen', '--report'])
root = Path(__file__).resolve().parents[1]
directory = root / 'content/se-26w-v1/source'
source = json.loads((directory / 'curriculum-source.json').read_text(encoding='utf-8'))
previous_path = root / 'docs/resource-metadata-proposal.json'
previous = json.loads(previous_path.read_text(encoding='utf-8'))
review = json.loads((root / 'docs/resource-named-mentions-proposal.json').read_text(encoding='utf-8'))
digest = lambda value: hashlib.sha256(value).hexdigest()
prefix = source['release_id'] + ':'
assert review['status'] == previous['status'] == 'proposal-only-not-runtime'
assert review['releaseId'] == source['release_id'] == 'se-26w-v1'
assert review['manifestSha256'] == previous['manifestSha256'] == '064d4412b280d54c7bf2fb229e7ec643eb3dc8ab85f9311bf9f9a5749c5cb265'
assert review['previousProposalSha256'] == digest(previous_path.read_bytes())
word_path = directory / source['source']['filename']
assert review['wordSha256'] == source['source']['sha256'] == digest(word_path.read_bytes())
assert review['boundaries'] == {
    'runtimeApplied': False, 'newExternalUrls': 0, 'newRuntimeDependencies': 0,
    'addedCompletionUnits': 0, 'importedRecordsChanged': False,
    'studentRecordsReadOrWritten': False, 'privateSearchAdded': False,
}
blocks = {row['source_id']: row for row in source['source_blocks']}
with (directory / 'source-to-website.csv').open(encoding='utf-8-sig', newline='') as stream:
    csv_rows = list(csv.DictReader(stream))
assert len(csv_rows) == 2329
mapping = {row['source_id']: row for row in csv_rows}
mentions = {row['source_id']: row for row in source['resource_mentions']}
candidates = {row['candidateId']: row for row in previous['additionalMentions']}
uses = {row['useId']: row for row in previous['uses']}
resources = {row['id']: row for row in source['resources']}
evidence = {row['sourceId']: row for row in review['evidence']}
assert len(evidence) == len(review['evidence']) == 19
w = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def text(element):
    return ''.join((node.text or '') if node.tag == w + 't'
                   else '\t' if node.tag == w + 'tab'
                   else '\n' if node.tag in (w + 'br', w + 'cr') else ''
                   for node in element.iter())


with zipfile.ZipFile(word_path) as archive:
    document = ET.fromstring(archive.read('word/document.xml'))
    relationships = {
        row.attrib['Id']: row.attrib['Target']
        for row in ET.fromstring(archive.read('word/_rels/document.xml.rels'))
    }
    relation_id = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'
    original_links = [(text(link), relationships[link.attrib[relation_id]])
                      for link in document.findall('.//' + w + 'hyperlink')
                      if relation_id in link.attrib]
    assert original_links == [(link['label'], link['url'])
                              for block in source['source_blocks'] for link in block['links']]
    assert len(original_links) == 19 and len({url for _, url in original_links}) == 12
    paragraphs = document.find(w + 'body').findall('.//' + w + 'p')
    assert len(paragraphs) == 2365
    coordinates = {}
    for ti, table in enumerate(document.findall('.//' + w + 'tbl'), 1):
        for ri, row in enumerate(table.findall(w + 'tr'), 1):
            for ci, cell in enumerate(row.findall(w + 'tc'), 1):
                for paragraph in cell.findall('.//' + w + 'p'):
                    coordinates[id(paragraph)] = (ti, ri, ci)
    for ref, proof in evidence.items():
        block = blocks[ref]
        element = paragraphs[int(ref[1:]) - 1]
        assert proof['exactText'] == block['text'] == text(element)
        assert proof['sha256'] == digest(text(element).encode('utf-8'))
        expected = (proof['table'], proof['row'], proof['cell'])
        assert coordinates.get(id(element), (None, None, None)) == expected
        assert expected == tuple(block.get(key) for key in ('table', 'row', 'cell'))
        assert mapping[ref]['source_text'] == proof['exactText']

assert len(review['mentions']) == 15
assert {row['candidateId'] for row in review['mentions']} == set(candidates)
assert len({row['proposedMentionKey'] for row in review['mentions']}) == 15
assert len({row['resourceStableKey'] for row in review['mentions']}) == 14
expected_keys = {
    'Node runtime': 'named-node-runtime', 'nvm': 'named-nvm', 'VS Code': 'named-vs-code',
    'Git': 'named-git', 'Jest Getting Started': 'named-jest-getting-started',
    'ESLint getting started': 'named-eslint-getting-started', 'SQLite docs': 'named-sqlite-docs',
    'pg library docs': 'named-pg-library-docs', 'sqlite library docs': 'named-sqlite-library-docs',
    'React DevTools': 'named-react-devtools', 'Express docs': 'named-express-docs',
    'Node docs': 'res-10', 'CS50 Psets': 'res-04', 'CS50 Practice': 'named-cs50-practice',
}
for row in review['mentions']:
    candidate = candidates[row['candidateId']]
    original = mentions[row['sourceId']]
    context = row['context']
    csv_row = mapping[row['sourceId']]
    assert row['displayName'] == candidate['name']
    assert row['resourceStableKey'] == expected_keys[row['displayName']]
    assert row['resourceId'] == prefix + row['resourceStableKey']
    assert row['proposedDetailHref'] == '/resources/' + row['resourceStableKey']
    assert re.fullmatch('/resources/[a-zA-Z0-9_-]+', row['proposedDetailHref'])
    assert row['proposedMentionKey'] == 'named-' + row['sourceId'] + '-' + row['resourceStableKey'].removeprefix('named-')
    assert row['exactInstruction'] == candidate['exactInstruction'] == original['exact_instruction']
    assert row['exactInstruction'] in evidence[row['sourceId']]['exactText']
    assert row['proposed'] == candidate['proposed']
    assert context['stableKey'] == original['context'] == candidate['context']
    assert context['id'] == prefix + original['context']
    assert context['route'] == csv_row['website_location'].split('#')[0]
    assert context['sourceMappingHref'] == csv_row['website_location']
    assert context['kind'] == ('lesson' if csv_row['day_id'] else 'week')
    assert context['scope'] == {key: csv_row[field] or None for key, field in [('module', 'module_id'), ('week', 'week_id'), ('day', 'day_id')]}
    ancestors = context['ancestors']
    expected_ancestors = ([context['stableKey'], csv_row['day_id']] if csv_row['day_id'] else []) + [csv_row['week_id'], csv_row['module_id']]
    assert [item['stableKey'] for item in ancestors] == expected_ancestors
    assert ancestors[0]['route'] == context['route']
    for i, item in enumerate(ancestors):
        assert item['id'] == prefix + item['stableKey']
        assert item['parentId'] == (ancestors[i + 1]['id'] if i + 1 < len(ancestors) else None)
        assert item['route'].startswith('/course/software-engineer/')
    origins = [use for use in previous['uses'] if use['sourceId'] == row['sourceId']]
    assert row['originalUseIds'] == [use['useId'] for use in origins]
    assert len(row['originalAssignments']) == len(origins)
    for assignment in row['originalAssignments']:
        old = uses[assignment['useId']]
        assert assignment == {'useId': old['useId'], 'resourceId': old['raw']['resourceId'], 'assignedText': old['raw']['assignedText'], 'rawRequirementMode': old['raw']['requirementMode'], 'currentReviewedMode': old['proposed']['requirementMode']}
        assert assignment['assignedText'] == row['exactInstruction']
        assert old['raw']['contentItemId'] == context['id']
    assert row['originalUrl'] is None and row['sourceDirectLinkSupplied'] is False
    parent_key = candidate['proposed']['parentResourceKey']
    nav = row['navigation']
    assert nav['parentResourceKey'] == parent_key and nav['exactSectionUrl'] is None
    assert nav['parentHref'] == ('/resources/' + parent_key if parent_key else None)
    assert nav['parentOriginalUrl'] == (resources[parent_key]['url'] if parent_key else None)
    assert nav['kind'] == ('existing-source-parent-only' if parent_key else 'no-direct-link-supplied')
    expected_refs = {row['sourceId']}
    if context['kind'] == 'lesson': expected_refs.add('p0025')
    if parent_key: expected_refs.update(resources[parent_key]['source_ids'])
    assert set(row['evidenceRefs']) == expected_refs <= set(evidence)
    assert row['resourceAction'] == ('reuse-existing-resource' if row['resourceStableKey'] in resources else 'propose-derived-resource')
    assert row['reviewDecision'] == ('defer-ambiguous-package-mentions' if row['sourceId'] == 'p1679' else 'recommended-for-separate-approval')
    assert isinstance(row['reason'], str) and row['reason']

recommended = [row for row in review['mentions'] if row['reviewDecision'] == 'recommended-for-separate-approval']
assert len(recommended) == 13
assert len({row['resourceId'] for row in recommended if row['resourceAction'] == 'propose-derived-resource'}) == 10
assert len({row['resourceId'] for row in review['mentions'] if row['resourceAction'] == 'propose-derived-resource'}) == 12
assert Counter(row['proposed']['requirementMode'] for row in review['mentions']) == {'required': 5, 'conditional': 3, 'reference': 7}
assert {row['sourceId'] for row in review['mentions'] if row['displayName'] == 'CS50 Practice'} == {'p1173', 'p1250'}
assert len({row['resourceId'] for row in review['mentions'] if row['displayName'] == 'CS50 Practice'}) == 1
assert review['summary'] == {'originalResources': 69, 'originalUses': 290, 'originalSourceMentions': 208, 'originalMappings': 2329, 'candidates': 15, 'distinctCandidateResourceIdentities': 14, 'reusedExistingResources': 2, 'proposedNewDerivedResources': 12, 'recommendedMentions': 13, 'deferredMentions': 2, 'recommendedNewDerivedResources': 10, 'originalRequiredUnits': 364}
report = {'date': '2026-10-09', 'status': 'named-mention-review-word-and-csv-verified', 'reviewSha256': digest((root / 'docs/resource-named-mentions-proposal.json').read_bytes()), 'wordSha256': review['wordSha256'], 'exactWordEvidenceBlocks': len(evidence), 'exactSourceContexts': len({row['sourceId'] for row in review['mentions']}), 'exactOriginUseIds': len({use for row in review['mentions'] for use in row['originalUseIds']}), 'csvMappings': len(csv_rows), 'exactOriginalHyperlinks': len(original_links), 'exactOriginalUrls': len({url for _, url in original_links}), **review['summary'], 'runtimeApplied': False, 'databaseAccess': False, 'networkAccess': False}
if '--frozen' in sys.argv:
    artifact = json.loads((root / 'content/interpretations/se-26w-v1-resource-mentions-v1.json').read_text(encoding='utf-8'))
    canonical_digest = lambda value: digest(json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode('utf-8'))
    pin = '5ec53b8b5b532cf0c7295692a1ebe1d88af157e87eb5fdf8325b71615f98d779'
    assert canonical_digest(artifact) == pin
    assert artifact['proposalSha256'] == report['reviewSha256']
    assert artifact['releaseId'] == review['releaseId']
    assert artifact['manifestSha256'] == review['manifestSha256']
    assert artifact['wordSha256'] == review['wordSha256']
    assert artifact['interpretationId'] == 'se-26w-v1-resource-mentions-v1'
    for version, field, expected_pin in [
        ('se-26w-v1-resource-labels-v1', 'label', 'c326c2b849fc4e41eaae4d7a27bdba09e0ccad49c31cde73e119af9be754cee3'),
        ('se-26w-v1-resource-bindings-v1', 'binding', 'fefefb7f2926d28487fb472aa12b16a051592be0aeea34c48ec7914713eb1069'),
    ]:
        base = json.loads((root / ('content/interpretations/' + version + '.json')).read_text(encoding='utf-8'))
        assert artifact[field + 'InterpretationId'] == version
        assert artifact[field + 'Sha256'] == expected_pin == canonical_digest(base)
    approved = {row['candidateId']: row for row in recommended}
    assert len(artifact['mentions']) == len(approved) == 13
    assert {row['candidateId'] for row in artifact['mentions']} == set(approved)
    assert len({row['key'] for row in artifact['mentions']}) == 13
    frozen_evidence_ids = set()
    for row in artifact['mentions']:
        origin = approved[row['candidateId']]
        assert row['sourceId'] != 'p1679'
        for field, proposal_field in [('key', 'proposedMentionKey'), ('resourceId', 'resourceId'), ('displayName', 'displayName'), ('sourceId', 'sourceId'), ('exactInstruction', 'exactInstruction'), ('reason', 'reason'), ('evidenceRefs', 'evidenceRefs')]:
            assert row[field] == origin[proposal_field]
        assert row['contentItemId'] == origin['context']['id']
        assert row['sourceMappingHref'] == origin['context']['sourceMappingHref']
        assert row['scope'] == origin['context']['scope']
        for field in ('requirementMode', 'choiceGroup'): assert row[field] == origin['proposed'][field]
        assert [item['itemId'] for item in row['ancestors']] == [item['id'] for item in origin['context']['ancestors']]
        assert all(re.fullmatch('[a-f0-9]{64}', item['identitySha256']) for item in row['ancestors'])
        assert [item['useId'] for item in row['origins']] == origin['originalUseIds']
        for item in row['origins']:
            raw = uses[item['useId']]['raw']
            assert item['identitySha256'] == canonical_digest([raw[field] for field in ('id', 'releaseId', 'resourceId', 'contentItemId', 'assignedText', 'sectionLocator', 'requirementMode', 'orderIndex')])
        frozen_evidence_ids.update(row['evidenceRefs'])
    assert len(artifact['resources']) == len({row['id'] for row in artifact['resources']}) == 12
    assert len([row for row in artifact['resources'] if row['action'] == 'derived-resource']) == 10
    raw_resources = {row['resourceId']: row['raw'] for row in previous['resources']}
    def raw_resource_hash(raw):
        return canonical_digest([raw[field] for field in ('id', 'releaseId', 'stableKey', 'title', 'originalUrl', 'sourceName', 'type', 'descriptionMarkdown', 'linkOrigin')])
    for row in artifact['resources']:
        origins = [item for item in recommended if item['resourceId'] == row['id']]
        assert origins
        raw = raw_resources.get(row['id'])
        for origin in origins:
            assert row['stableKey'] == origin['resourceStableKey']
            assert row['title'] == (raw['title'] if raw else origin['displayName'])
            assert row['type'] == origin['proposed']['type'] and row['provider'] == origin['proposed']['provider']
            assert row['action'] == ('reuse-existing-resource' if raw else 'derived-resource')
            assert row['originalIdentitySha256'] == (raw_resource_hash(raw) if raw else None)
            parent_key = origin['navigation']['parentResourceKey']
            assert (row['parent'] is None) == (parent_key is None)
            if parent_key:
                parent = raw_resources[prefix + parent_key]
                assert row['parent'] == {'resourceId': parent['id'], 'identitySha256': raw_resource_hash(parent), 'originalUrl': parent['originalUrl']}
    assert len(artifact['evidence']) == len(frozen_evidence_ids) == 18
    assert {row['sourceId'] for row in artifact['evidence']} == frozen_evidence_ids
    for row in artifact['evidence']:
        assert row == {field: evidence[row['sourceId']][field] for field in ('sourceId', 'sha256', 'table', 'row', 'cell')}
    report.update({'status': 'approved-frozen-mentions-word-and-source-verified', 'interpretationId': artifact['interpretationId'], 'canonicalSha256': pin, 'approvedMentions': 13, 'frozenResources': 12, 'frozenDerivedResources': 10, 'frozenWordEvidenceBlocks': 18, 'sourceContextsInFrozenSubset': len({row['sourceId'] for row in artifact['mentions']})})
output = json.dumps(report, indent=2) + '\n'
if '--report' in sys.argv:
    report_name = 'm6-step18-source-review.json' if '--frozen' in sys.argv else 'm6-step17-source-review.json'
    (root / 'docs' / report_name).write_text(output, encoding='utf-8')
print(output, end='')
