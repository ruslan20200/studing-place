from pathlib import Path
import json,hashlib,re
from collections import defaultdict
from pypdf import PdfReader

ROOT=Path('/Users/rus/Desktop/book-traiding');DATA=ROOT/'parsed-data'
cat=json.loads((DATA/'catalog.json').read_text());audit=[]
for b in cat:
 folder=DATA/'books'/b['id'];pages=json.loads((folder/'pages.json').read_text());reader=PdfReader(ROOT/b['filename'])
 assert len(reader.pages)==b['pages']==len(pages)
 assert [p['page'] for p in pages]==list(range(1,len(pages)+1))
 assert hashlib.sha256((ROOT/b['filename']).read_bytes()).hexdigest()==b['sha256']
 raw=sum(1 for _ in (folder/'raw-pages.jsonl').open());assert raw==len(pages)
 images=json.loads((folder/'images.json').read_text());assert all((folder/i['file']).exists() for i in images)
 assert all((folder/s).exists() for p in pages for s in p['images'])
 hashes=defaultdict(list)
 for p in pages:
  normalized=re.sub(r'\W','',p['text']).lower()
  if len(normalized)>400:hashes[hashlib.sha256(normalized.encode()).hexdigest()].append(p['page'])
 duplicates=[v for v in hashes.values() if len(v)>1]
 b['empty_pages']=[p['page'] for p in pages if p['chars']<30]
 b['low_text_pages']=[p['page'] for p in pages if p['chars']<70]
 b['ocr_attempted_pages']=len(list((folder/'renders').glob('*.ocr.json')))
 b['duplicate_text_pages']=duplicates
 (folder/'metadata.json').write_text(json.dumps(b,ensure_ascii=False,indent=2))
 audit.append({'book':b['id'],'pages_checked':len(pages),'sha256_verified':True,'image_files_checked':len(images),'low_text_pages':b['low_text_pages'],'duplicates':duplicates,'unresolved_errors':b['errors']})
(DATA/'catalog.json').write_text(json.dumps(cat,ensure_ascii=False,indent=2))
(DATA/'independent-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2));print(json.dumps(audit,ensure_ascii=False,indent=2))
