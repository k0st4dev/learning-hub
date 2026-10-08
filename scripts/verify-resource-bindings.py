"""Independent Word/proposal/binding audit. Standard library; no database writes."""
from pathlib import Path
from collections import Counter
import hashlib
import json
import runpy

root = Path(__file__).resolve().parents[1]
review = runpy.run_path(str(root / 'scripts/verify-resource-review.py'))
source = review['source']
proposal = review['proposal']
blocks = review['blocks']
prefix = proposal['releaseId'] + ':'
artifact_path = root / 'content/interpretations/se-26w-v1-resource-bindings-v1.json'
artifact = json.loads(artifact_path.read_text(encoding='utf-8'))
labels = json.loads((root / 'content/interpretations/se-26w-v1-resource-labels-v1.json').read_text(encoding='utf-8'))


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode('utf-8')).hexdigest()


assert digest(artifact) == 'fefefb7f2926d28487fb472aa12b16a051592be0aeea34c48ec7914713eb1069'
assert artifact['proposalSha256'] == digest(proposal)
assert artifact['labelSha256'] == digest(labels) == 'c326c2b849fc4e41eaae4d7a27bdba09e0ccad49c31cde73e119af9be754cee3'
assert artifact['manifestSha256'] == proposal['manifestSha256']
assert artifact['wordSha256'] == review['word_sha']
assert artifact['releaseId'] == proposal['releaseId']
assert artifact['interpretationId'] == 'se-26w-v1-resource-bindings-v1'
assert artifact['labelInterpretationId'] == labels['interpretationId']
assert len(artifact['corrections']) == 18
suggestions = {row['useId']: row for row in proposal['parentSuggestions']}
uses = {row['useId']: row for row in proposal['uses']}
assert set(suggestions) == {row['useId'] for row in artifact['corrections']}
assert len({row['useId'] for row in artifact['corrections']}) == 18
days = {row['id']: row for row in source['days']}
weeks = {row['id']: row for row in source['weeks']}
evidence_ids = set()
for row in artifact['corrections']:
    suggestion = suggestions[row['useId']]
    reviewed = uses[row['useId']]
    raw = reviewed['raw']
    assert row['effectiveResourceId'] == prefix + suggestion['proposedParentResourceKey']
    assert row['originalResourceId'] == raw['resourceId']
    assert row['identitySha256'] == digest([raw[key] for key in (
        'id', 'releaseId', 'resourceId', 'contentItemId', 'assignedText', 'sectionLocator', 'requirementMode', 'orderIndex')])
    assert row['scope'] == reviewed['scope']
    assert row['reason'] == suggestion['reason']
    assert row['evidenceRefs'] == suggestion['evidenceRefs']
    assert row['sourceId'] == reviewed['sourceId']
    assert raw['assignedText'] in blocks[row['sourceId']]['text']
    context_key = raw['contentItemId'][len(prefix):]
    if row['scope']['day']:
        day = days[row['scope']['day']]
        assert context_key == day['id'] + '-learn'
        assert row['scope']['week'] == day['week_id']
        ancestor_ids = [raw['contentItemId'], prefix + day['id'], prefix + day['week_id'], prefix + weeks[day['week_id']]['module_id']]
    else:
        assert context_key == row['scope']['week']
        ancestor_ids = [raw['contentItemId'], prefix + weeks[context_key]['module_id']]
    assert [item['itemId'] for item in row['ancestors']] == ancestor_ids
    assert row['scope']['module'] == weeks[row['scope']['week']]['module_id']
    for ref in row['evidenceRefs']:
        # The shared independent audit already checks every block against Word XML and coordinates.
        assert ref in review['evidence'] and ref in blocks
        evidence_ids.add(ref)
    if row['kind'] == 'top-foundations-context':
        assert 1 <= int(row['scope']['week'][1:]) <= 6
        assert row['originalResourceId'] == prefix + 'res-02'
        assert row['effectiveResourceId'] == prefix + 'res-01'
        assert 'TOP' in raw['assignedText']
        assert {'p0084', 'p0087'}.issubset(row['evidenceRefs'])
    else:
        assert row['kind'] == 'fso-week-context'
        assert row['sourceId'] in ('p1756', 'p1906', 'p2131')
        assert row['originalResourceId'] == prefix + 'unresolved-' + row['sourceId']
        assert row['effectiveResourceId'] == prefix + 'res-05'
        assert any('FSO' in blocks[ref]['text'] or 'Full Stack Open' in blocks[ref]['text'] for ref in row['evidenceRefs'])

report = {
    'status': 'original-word-and-frozen-bindings-verified',
    'canonicalSha256': digest(artifact),
    'corrections': len(artifact['corrections']),
    'kinds': dict(Counter(row['kind'] for row in artifact['corrections'])),
    'exactEvidenceBlocks': len(evidence_ids),
    'contextAncestorBindings': sum(len(row['ancestors']) for row in artifact['corrections']),
    'existingResourceInventory': len(proposal['resources']),
    'existingUseInventory': len(proposal['uses']),
    'runtimeOrDatabaseWrites': False,
}
print(json.dumps(report, indent=2))
