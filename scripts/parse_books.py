"""Local loss-aware PDF extraction. Original PDFs remain the reference of record."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import pymupdf as fitz
import json, re, hashlib, subprocess, time, statistics

ROOT = Path('/Users/rus/Desktop/book-traiding')
OUT = ROOT / 'parsed-data'
OCR = Path(__file__).with_name('ocr')
BOOKS = [
 ('murphy', 'John_J._Murphy_-_Technical_Analysis_Of_The_Financial_Markets.pdf', 'Технический анализ финансовых рынков', 'Джон Мёрфи', 'Рынок и графики'),
 ('bernstein', 'Jake Bernstein - The Compleat Day Trader Vol I.pdf', 'Полное руководство дневного трейдера', 'Джейк Бернстайн', 'Торговый процесс'),
 ('elder', 'epdf.pub_trading-for-a-living.pdf', 'Трейдинг: психология, тактика, управление капиталом', 'Александр Элдер', 'Риск и система'),
 ('forex', '10_essentials_of_forex_trading.pdf', '10 основ торговли на Forex', 'Джаред Мартинес', 'Рынки'),
 ('wizards', 'The_New_Market_Wizards.pdf', 'Новые маги рынка', 'Джек Швагер', 'Торговый процесс'),
 ('zone', 'Trading In The Zone PDF.pdf', 'Трейдинг в зоне', 'Марк Дуглас', 'Психология'),
 ('disciplined', 'The Disciplined Trader PDF.pdf', 'Дисциплинированный трейдер', 'Марк Дуглас', 'Психология'),
 ('goodtrade', 'One Good Trade PDF.pdf', 'Одна хорошая сделка', 'Майк Беллафиоре', 'Торговый процесс'),
 ('probability', 'High Probability Trading PDF.pdf', 'Торговля с высокой вероятностью', 'Марсель Линк', 'Риск и система'),
 ('kahneman', 'Daniel Kahneman-Thinking, Fast and Slow  .pdf', 'Думай медленно… решай быстро', 'Даниэль Канеман', 'Психология'),
 ('poker', 'The_Mental_Game_of_Poker_ Jared_Tendler.pdf', 'Психология покера', 'Джаред Тендлер и Барри Картер', 'Психология'),
 ('poker2', 'The Mental Game of Poker 2 PDF.pdf', 'Психология покера — 2', 'Джаред Тендлер', 'Психология'),
 ('learning', 'The Art of Learning PDF.pdf', 'Искусство учиться', 'Джош Вайцкин', 'Обучение')
]
def dump(path, obj):
 path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding='utf-8')

def process(spec):
 ident, filename, title, author, category = spec
 src = ROOT / filename
 dest = OUT / 'books' / ident
 (dest/'assets').mkdir(parents=True,exist_ok=True)
 (dest/'renders').mkdir(exist_ok=True)
 doc = fitz.open(src)
 pages, records, images, table_records, errors = [], [], {}, [], []
 first_text = ''.join(p.get_text() for p in list(doc)[:8])
 summary = 'Written by Bookey' in first_text
 scanned = all(not doc[n].get_text().strip() for n in range(min(8,len(doc))))
 dump(dest/'toc.json', doc.get_toc())
 ocr_tasks = []
 rawfile = (dest/'raw-pages.jsonl').open('w',encoding='utf-8')
 for n, page in enumerate(doc):
  txt = page.get_text('text',sort=True)
  image_refs=[]
  for img in page.get_images(full=True):
   xref=img[0]
   if xref not in images:
    try:
     data=doc.extract_image(xref); name=f'xref-{xref}.{data["ext"]}'
     (dest/'assets'/name).write_bytes(data['image'])
     images[xref]={'file':'assets/'+name,'width':data['width'],'height':data['height'],'pages':[]}
    except Exception as e: errors.append({'page':n+1,'image':xref,'error':str(e)})
   if xref in images:
    images[xref]['pages'].append(n+1);image_refs.append(images[xref]['file'])
  drawings=page.get_drawings()
  blocks=page.get_text('dict',flags=fitz.TEXTFLAGS_DICT & ~fitz.TEXT_PRESERVE_IMAGES)
  rawfile.write(json.dumps({'page':n+1,'size':[page.rect.width,page.rect.height],'blocks':blocks['blocks'],'links':page.get_links(),'image_files':image_refs,'vector_paths':len(drawings)},ensure_ascii=False,default=str)+'\n')
  rec={'page':n+1,'text':txt,'method':'text','images':image_refs,'chars':len(txt),'render':None,'confidence':None,'flags':[]}
  if len(re.sub(r'\W','',txt))<70 and image_refs:
   render=f'renders/p{n+1:04d}.jpg'
   page.get_pixmap(dpi=180).save(dest/render)
   rec['render']=render;ocr_tasks.append((n,dest/render))
  elif n in {0,min(15,len(doc)-1),len(doc)//2,len(doc)-1}:
   render=f'renders/p{n+1:04d}.jpg';page.get_pixmap(dpi=110).save(dest/render);rec['render']=render
  if drawings and len(txt)>300:
   try:
    for table in page.find_tables().tables:
     data=table.extract()
     if len(data)>1: table_records.append({'page':n+1,'bbox':list(table.bbox),'rows':data})
   except Exception as e: errors.append({'page':n+1,'table_error':str(e)})
  pages.append(rec)
 rawfile.close()
 def recognize(task):
  n,path=task
  cached=path.with_suffix('.ocr.json')
  try:
   if cached.exists(): lines=json.loads(cached.read_text())
   else:
    p=subprocess.run([str(OCR),str(path)],capture_output=True,text=True,timeout=120,check=True)
    lines=json.loads(p.stdout);dump(cached,lines)
   text='\n'.join(x['text'] for x in lines)
   mean=statistics.mean(x['confidence'] for x in lines) if lines else None
   return n,text,mean,None
  except Exception as e: return n,'',None,str(e)
 with ThreadPoolExecutor(max_workers=3) as pool:
  for n,txt,confidence,error in pool.map(recognize,ocr_tasks):
   rec=pages[n]
   if error:
    errors.append({'page':n+1,'ocr_error':error});rec['flags'].append('ocr_failed')
   else:
    if len(txt)>len(rec['text']): rec.update(text=txt,chars=len(txt),method='ocr',confidence=confidence)
    if confidence is not None and confidence<0.80:rec['flags'].append('low_ocr_confidence')
   if rec['chars']<70:rec['flags'].append('low_text_visual_review')
 (dest/'text.txt').write_text('\n\n'.join(f'--- PDF PAGE {p["page"]} [{p["method"]}] ---\n{p["text"]}' for p in pages),encoding='utf-8')
 (dest/'book.md').write_text(f'# {title}\n\n'+ '\n\n'.join(f'## PDF-страница {p["page"]}\n\n{p["text"]}' for p in pages),encoding='utf-8')
 dump(dest/'pages.json',pages);dump(dest/'images.json',list(images.values()));dump(dest/'tables.json',table_records)
 meta={'id':ident,'filename':filename,'title':title,'author':author,'category':category,'pages':len(doc),'characters':sum(p['chars'] for p in pages),'words':sum(len(p['text'].split()) for p in pages),'kind':'summary' if summary else ('scan' if scanned else 'book'),'sourceLabel':'Пересказ Bookey' if summary else ('Книга · распознанный скан' if scanned else 'Книга · текстовый PDF'),'ocr_pages':sum(p['method']=='ocr' for p in pages),'images':len(images),'tables':len(table_records),'toc_entries':len(doc.get_toc()),'flagged_pages':[p['page'] for p in pages if p['flags']],'empty_pages':[p['page'] for p in pages if p['chars']<30],'errors':errors,'sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'pdf_metadata':doc.metadata,'extraction_complete':len(pages)==len(doc) and not any('ocr_error' in e for e in errors),'limitations':['OCR может искажать формулы, подписи и таблицы; сверять с оригиналом.','Рисунки в векторном формате сохраняются в исходном PDF; извлечённые assets содержат растровые изображения.','Обнаружение таблиц автоматическое; отсутствие таблицы в tables.json не означает её отсутствия в PDF.']}
 dump(dest/'metadata.json',meta)
 print(json.dumps({k:meta[k] for k in ['id','pages','kind','ocr_pages','characters','images','tables','flagged_pages','errors']},ensure_ascii=False),flush=True)
 return meta

if __name__=='__main__':
 OUT.mkdir(exist_ok=True)
 # Sequential PDFs avoid simultaneous MuPDF access; OCR workers handle isolated image files.
 catalog=[]
 for spec in BOOKS: catalog.append(process(spec));dump(OUT/'catalog.partial.json',catalog)
 dump(OUT/'catalog.json',catalog)
 report={'books':len(catalog),'pages':sum(x['pages'] for x in catalog),'characters':sum(x['characters'] for x in catalog),'ocr_pages':sum(x['ocr_pages'] for x in catalog),'summary_files':sum(x['kind']=='summary' for x in catalog),'images':sum(x['images'] for x in catalog),'tables':sum(x['tables'] for x in catalog),'complete':all(x['extraction_complete'] for x in catalog),'errors':[{'book':x['id'],'errors':x['errors']} for x in catalog if x['errors']]}
 dump(OUT/'quality-report.json',report);print(json.dumps(report,ensure_ascii=False),flush=True)
