from pathlib import Path
import csv, json, hashlib, zipfile, xml.etree.ElementTree as ET
from collections import Counter
from html.parser import HTMLParser

root = Path(__file__).resolve().parents[1]
p = root / 'content/se-26w-v1/source'
j = json.loads((p/'curriculum-source.json').read_text(encoding='utf-8'))
ns = {'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
w = '{'+ns['w']+'}'
def para_text(e):
    return ''.join(n.text or '' if n.tag == w+'t' else '\t' if n.tag == w+'tab' else '\n' if n.tag in (w+'br', w+'cr') else '' for n in e.iter())
checks = {}
with zipfile.ZipFile(p/j['source']['filename']) as z:
    doc = ET.fromstring(z.read('word/document.xml'))
    paras = doc.find('w:body',ns).findall('.//w:p',ns)
    checks['docx_sha256'] = hashlib.sha256((p/j['source']['filename']).read_bytes()).hexdigest() == j['source']['sha256']
    checks['all_body_text_exact'] = [para_text(e) for e in paras] == [b['text'] for b in j['source_blocks']]
    checks['table_count'] = len(doc.findall('.//w:tbl',ns)) == 197
    checks['header_footer_text'] = all([para_text(e) for e in ET.fromstring(z.read(part)).findall('.//w:p',ns)] == texts for part,texts in j['other_text_parts'].items())
    rels = {r.attrib['Id']:r.attrib['Target'] for r in ET.fromstring(z.read('word/_rels/document.xml.rels'))}
    rkey = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'
    links = [(para_text(e),rels[e.attrib[rkey]]) for e in doc.findall('.//w:hyperlink',ns) if rkey in e.attrib]
    checks['all_hyperlink_labels_targets_exact'] = links == [(l['label'],l['url']) for b in j['source_blocks'] for l in b['links']]
    coords = {}
    for ti,t in enumerate(doc.findall('.//w:tbl',ns),1):
        for ri,row in enumerate(t.findall('w:tr',ns),1):
            for ci,cell in enumerate(row.findall('w:tc',ns),1):
                for e in cell.findall('.//w:p',ns): coords[id(e)] = (ti,ri,ci)
    checks['table_coordinates_exact'] = all(coords.get(id(e)) == ((b['table'],b['row'],b['cell']) if b['in_table'] else None) for e,b in zip(paras,j['source_blocks']))
blocks = {b['source_id']:b for b in j['source_blocks']}
mapping = list(csv.DictReader((p/'source-to-website.csv').open(encoding='utf-8-sig',newline='')))
days = list(csv.DictReader((p/'curriculum-days.csv').open(encoding='utf-8-sig',newline='')))
checks['all_substantive_blocks_mapped'] = {k for k,v in blocks.items() if v['text'].strip()} == {m['source_id'] for m in mapping if m['source_id'] in blocks}
checks['csv_mapping_exact_body_text'] = all(m['source_text']==blocks[m['source_id']]['text'] for m in mapping if m['source_id'] in blocks)
checks['csv_mapping_destinations_exact'] = len(mapping) == len(j['source_mapping']) and all(
    all(row[key] == ('' if value is None else str(value)) for key,value in source.items() if key != 'links')
    for row,source in zip(mapping,j['source_mapping'])
)
checks['daily_sequence'] = [d['number'] for d in j['days']] == list(range(1,183))
checks['daily_source_fields_exact_with_separate_labels'] = all(d['study_instruction']==blocks[d['study_source_id']]['text'].removeprefix('Uči / pročitaj: ') and d['completion_criterion']==blocks[d['criterion_source_id']]['text'].removeprefix('Gotovo kada: ') and all(t['text']==blocks[t['source_id']]['text'] for t in d['tasks']) for d in j['days'])

checks['daily_ai_policies_preserved'] = all(any(b['text']=='AI pravilo: '+d['ai_policy'] or b['text'].endswith(d['ai_policy']) for b in (blocks[ref] for ref in d['source_blocks'])) for d in j['days'])
checks['daily_csv_fields_exact'] = len(days)==182 and all(all(str(d[k])==row[k] for k in ('id','number','module_id','week_id','title','source_date','estimated_minutes','study_instruction','ai_policy','completion_criterion')) and row['tasks']=='\n'.join(f"{i}. {t['text']}" for i,t in enumerate(d['tasks'],1)) for d,row in zip(j['days'],days))
class Parse(HTMLParser):
    def __init__(self): super().__init__(); self.text=[]; self.ids=[]
    def handle_data(self,data): self.text.append(data)
    def handle_starttag(self,tag,attrs):
        self.ids.extend(v for k,v in attrs if k=='id')
h=Parse(); h.feed((p/'curriculum-audit.html').read_text(encoding='utf-8'))
visible=' '.join(h.text)
checks['audit_contains_all_day_study_text'] = all(d['study_instruction'] in visible for d in j['days'])
report={'checks':checks,'counts':{'modules':len(j['modules']),'weeks':len(j['weeks']),'days':len(j['days']),'tasks':sum(len(d['tasks']) for d in j['days']),'source_blocks':len(blocks),'mapping_rows':len(mapping),'resource_mentions':len(j['resource_mentions']),'hyperlink_occurrences':len(links),'unique_urls':len(set(url for _,url in links))},'task_modes':dict(Counter(t['requirement_mode'] for d in j['days'] for t in d['tasks'])),'assessment_kinds':dict(Counter(d['assessment_kind'] for d in j['days']))}
(root/'docs/m2-source-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
if not all(checks.values()): raise SystemExit('Source audit failed')
