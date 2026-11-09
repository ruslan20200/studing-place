import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const json=filename=>JSON.parse(fs.readFileSync(filename,'utf8'));
const catalog=json(path.join(root,'data/catalog.json'));
const reading=json(path.join(root,'reading/index.json'));
let pages=0,images=0,renders=0;
const checked=new Set();
function requireFile(filename) {
 if(checked.has(filename))return;
 if(!fs.lstatSync(filename).isFile())throw Error('Expected a portable file: '+filename);
 checked.add(filename);
}
for(const book of catalog){
 const directory=path.join(root,'library',book.id);
 const metadata=json(path.join(directory,'metadata.json'));
 const textPages=json(path.join(directory,'pages.json'));
 if(textPages.length!==book.pages)throw Error('Missing pages: '+book.id);
 const entries=json(path.join(directory,'images.json'));
 for(const filename of ['tables.json','toc.json'])json(path.join(directory,filename));
 for(const page of textPages){
  for(const filename of page.images||[])requireFile(path.join(directory,filename));
  if(page.render){requireFile(path.join(directory,page.render));renders++;}
 }
 for(const image of entries)requireFile(path.join(directory,image.file));
 const pdf=path.join(root,'originals',book.filename);
 requireFile(pdf);
 if(crypto.createHash('sha256').update(fs.readFileSync(pdf)).digest('hex')!==metadata.sha256)throw Error('PDF changed: '+book.id);
 requireFile(path.join(root,'reading',book.id+'.md'));
 if(!reading.books.some(entry=>entry.id===book.id))throw Error('Missing Russian index entry: '+book.id);
 pages+=textPages.length;images+=entries.length;
}
console.log(JSON.stringify({books:catalog.length,pages,images,renders,checked_files:checked.size,original_pdfs:'SHA-256 verified'}));
