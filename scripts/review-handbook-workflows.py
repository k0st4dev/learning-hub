"""Offline review of original handbook workflows; never opens student storage."""
import csv
import hashlib
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET
import zipfile


def require(condition, message):
    if not condition:
        raise ValueError(message)


require(sys.argv[1:] in (['--write'], ['--check'], ['--check', '--report']),
        'Use --write, --check, or --check --report')
root = Path(__file__).resolve().parents[1]
source_dir = root / 'content/se-26w-v1/source'
manifest_path = source_dir.parent / 'source-manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
require(manifest['releaseId'] == 'se-26w-v1', 'Unexpected release')
for entry in manifest['files']:
    require(Path(entry['name']).name == entry['name'], 'Unexpected archive filename')
    raw = (source_dir / entry['name']).read_bytes()
    require(len(raw) == entry['bytes'] and hashlib.sha256(raw).hexdigest() == entry['sha256'],
            'Archive drift: ' + entry['name'])
source = json.loads((source_dir / 'curriculum-source.json').read_text(encoding='utf-8'))
word = source_dir / source['source']['filename']
require(source['source']['filename'] in {entry['name'] for entry in manifest['files']},
        'Word file is outside the source manifest')
word_hash = hashlib.sha256(word.read_bytes()).hexdigest()
require(word_hash == source['source']['sha256'], 'Word identity mismatch')
w = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
with zipfile.ZipFile(word) as archive:
    paragraphs = ET.fromstring(archive.read('word/document.xml')).find(w + 'body').findall('.//' + w + 'p')
blocks = {row['source_id']: row for row in source['source_blocks']}
require(len(blocks) == len(source['source_blocks']) == len(paragraphs) == 2365,
        'Original paragraph identity/count changed')
with (source_dir / 'source-to-website.csv').open(encoding='utf-8-sig', newline='') as stream:
    mappings = list(csv.DictReader(stream))
require(len(mappings) == 2329, 'Original mapping count changed')


def verified(ref, route):
    block = blocks[ref]
    paragraph = paragraphs[int(ref[1:]) - 1]
    text = ''.join((node.text or '') if node.tag == w + 't'
                   else '\t' if node.tag == w + 'tab'
                   else '\n' if node.tag in (w + 'br', w + 'cr') else ''
                   for node in paragraph.iter())
    style_node = paragraph.find(w + 'pPr/' + w + 'pStyle')
    style = style_node.get(w + 'val') if style_node is not None else 'Normal'
    rows = [row for row in mappings if row['source_id'] == ref]
    require(text == block['text'] and style == block['style'], 'Word text/style mismatch: ' + ref)
    require(len(rows) == 1 and rows[0]['source_text'] == text
            and rows[0]['website_location'] == route, 'Mapping mismatch: ' + ref)
    return {'sourceId': ref, 'style': style, 'text': text,
            'textSha256': hashlib.sha256(text.encode('utf-8')).hexdigest(),
            'websiteLocation': route}


specs = [
    ('b', 6, 'temporary-git-review', ['p2231', 'p2232', 'p2233', 'p2234']),
    ('c', 8, 'temporary-concept-review', [f'p{n:04d}' for n in range(2236, 2243)]),
    ('e', 8, 'temporary-stuck-workflow', [f'p{n:04d}' for n in range(2335, 2342)]),
    ('f', 7, 'read-only-ai-after-mastery', []),
    ('g', 6, 'read-only-postcourse-branches', []),
]
interpretations = {
    'b': {'informationalSourceIds': ['p2230'], 'conditionalLargerProjectSourceId': 'p2233',
          'weeklyGuidanceSourceId': 'p2234', 'compoundPreCommitSourceId': 'p2232'},
    'c': {'scope': 'one-current-concept', 'optionalConceptLabel': True,
          'resetMarksOnConceptChange': True, 'noMasteryClaim': True},
    'e': {'preserveNumberedOrder': True, 'allowAnyStepReview': True,
          'aiStepSourceId': 'p2339', 'rewriteAndTenMinutePauseSourceId': 'p2340',
          'nextDayTransferSourceId': 'p2341', 'noTimerOrNewScheduledTask': True},
    'f': {'masteryConditionSourceId': 'p2343', 'independentTasksMinimum': 2,
          'projectContextsMinimum': 1, 'requiresBehaviorRisksAndTestsReview': True,
          'relatedGuideKeys': ['guide-appendix-c', 'guide-ai-protocol']},
    'g': {'branchSourceIds': [f'p{n:04d}' for n in range(2351, 2355)],
          'commonLoopSourceId': 'p2355', 'noSavedBranchChoice': True,
          'keepExistingCompletedProgressLink': True},
}
guides = []
base = '/course/software-engineer/guide/'
for letter, count, tool, checks in specs:
    route = base + 'appendix-' + letter
    rows = [row for row in mappings if row['website_location'] == route]
    require(len(rows) == count, 'Guide coverage changed: ' + letter)
    original = [verified(row['source_id'], route) for row in rows]
    require(all(ref in {block['sourceId'] for block in original} for ref in checks),
            'Unmapped proposed control')
    require(len(checks) == len(set(checks)), 'Duplicate proposed control')
    guides.append({'key': 'guide-appendix-' + letter, 'route': route,
                   'sourceContent': original,
                   'proposedInterpretation': {'status': 'pending-user-approval',
                                             'tool': tool, 'controlSourceIds': checks,
                                             'storage': 'none', 'courseCredit': False,
                                             'conditions': interpretations[letter]}})
require(blocks['p2344']['text'].strip() == '', 'Unmapped F paragraph is substantive')
support = [verified(ref, base + 'ai-protocol') for ref in
           ['p0054'] + [f'p{n:04d}' for n in range(62, 69)]]
require([blocks[f'p{n:04d}']['text'].split('.', 1)[0] for n in range(2335, 2342)]
        == [str(n) for n in range(1, 8)], 'Stuck workflow order changed')
proposal = {
    'formatVersion': 1, 'releaseId': 'se-26w-v1', 'status': 'proposal-only',
    'sourceManifestSha256': hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
    'sourceManifestHashFormat': 'raw-file-bytes',
    'wordSha256': word_hash, 'sourceGuides': guides, 'supportingSource': support,
    'proposedPolicy': {
        'storage': 'component-memory-only', 'noBrowserStorage': True,
        'noApiOrDatabaseWrites': True, 'resetOnLeaveReloadAccountChange': True,
        'reusePreparationOrExerciseProgress': False, 'reuseNoteBodyAsStructuredState': False,
        'progressDenominator': 364, 'confirmedProgressUnchanged': True,
        'dailyAiRestrictionsTakePriority': True, 'noAutomaticMasteryOrAiUnlock': True,
        'noTimerDateLocksOrAddedTasks': True, 'noExternalAiOrPaidDependencies': True,
        'proposedUiNotice': 'Temporary review. Marks reset when you leave or reload. This does not save course progress.',
        'alternative': 'If durable tool state is requested, agree a separate owned/revisioned SQLite contract and reviewed migration before implementation.',
    },
}
target = root / 'docs/handbook-workflows-proposal.json'
if '--write' in sys.argv:
    target.write_text(json.dumps(proposal, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
else:
    require(json.loads(target.read_text(encoding='utf-8')) == proposal, 'Proposal differs from verified source/policy')
report = {
    'releaseId': proposal['releaseId'], 'sourceManifestSha256': proposal['sourceManifestSha256'],
    'sourceManifestHashFormat': proposal['sourceManifestHashFormat'],
    'wordSha256': word_hash, 'proposalFileSha256': hashlib.sha256(target.read_bytes()).hexdigest(),
    'guides': len(guides), 'exactGuideBlocks': sum(len(g['sourceContent']) for g in guides),
    'exactSupportingBlocks': len(support), 'proposedAdvisoryControls': sum(len(g['proposedInterpretation']['controlSourceIds']) for g in guides),
    'originalBodyParagraphs': 2365, 'originalMappings': 2329,
    'exactWordTextStyleAndCsv': True, 'stuckOrderPreserved': True, 'fBlankParagraphRetainedInArchive': True,
    'sourceFilesVerified': len(manifest['files']), 'databaseAccess': False, 'networkAccess': False,
    'runtimeActivation': False,
}
if '--report' in sys.argv:
    (root / 'docs/m6-step23-source-review.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, indent=2))
