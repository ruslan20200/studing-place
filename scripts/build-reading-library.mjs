import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const project='/Users/rus/Desktop/trading-campus';
const corpus='/Users/rus/Desktop/book-traiding/parsed-data';
const catalog=JSON.parse(fs.readFileSync(path.join(corpus,'catalog.json'),'utf8'));
const normalize=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const wordCount=s=>(s.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)||[]).length;
const manual={
 bernstein:[24,29,34,41,54,67,84,98,105,111,117,122,132,141,152,159,176,183,188,199,204,210,220,224,233],
 murphy:[38,60,72,86,136,166,194,218,232,266,306,342,366,390,424,440,460,484,506,516,528,546,558,564],
 elder:[10,20,52,80,126,178,205,222,233,248,257,269,280],
 forex:[19,35,49,65,89,107,131,147,169,179,193,205,219],
 wizards:[8,13,34,35,45,57,61,71,75,84,91,98,108,113,120,122,138,147,155,173,182],
 poker:[15,25,28,35,43,50,59,66,70,132,152,169,189]
};
const summaryGroups={
 zone:[[1],[2],[3],[4],[5],[6],[7],[8],[9],[10],[11],[11]],
 disciplined:Array.from({length:17},(_,i)=>[i+1]),
 goodtrade:Array.from({length:13},(_,i)=>[i+1]),
 poker2:Array.from({length:13},(_,i)=>[i+1]),
 learning:Array.from({length:20},(_,i)=>[i+1]),
 probability:[[1,2],[3,4],[5,6],[7,8],[9,10],[11,12],[13],[14,15],[16,17],[18,19],[20,21],[22]]
};
const kahnemanTitles=['The Characters of the Story','Attention and Effort','The Lazy Controller','The Associative Machine','Cognitive Ease','Norms, Surprises, and Causes','A Machine for Jumping to Conclusions','How Judgments Happen','Answering an Easier Question','The Law of Small Numbers','Anchors','The Science of Availability','Availability, Emotion, and Risk','Tom W’s Specialty','Linda: Less is More','Causes Trump Statistics','Regression to the Mean','Taming Intuitive Predictions','The Illusion of Understanding','The Illusion of Validity','Intuitions Vs. Formulas','Expert Intuition: When Can We Trust It?','The Outside View','The Engine of Capitalism','Bernoulli’s Errors','Prospect Theory','The Endowment Effect','Bad Events','The Fourfold Pattern','Rare Events','Risk Policies','Keeping Score','Reversals','Frames and Reality','Two Selves','Life as a Story','Experienced Well-Being','Thinking About Life'];
const kahnemanGroups=[[1,2,3],[4,5,6,7],[8,9],[10],[11],[12,13],[14,15,16],[17,18],[19,20],[21,22],[23,24],[25,26],[27,28],[29,30],[31,32],[33,34],[35,36],[37,38]];
const minimum={bernstein:2800,murphy:2300,elder:1500,forex:1400,wizards:2000,poker:1400,kahneman:2100};
const manifest={version:2,date:'2026-11-09',type:'explanatory-russian-companions',books:[]};
const evidence=[];
const destination=path.join(corpus,'russian-guides');fs.mkdirSync(destination,{recursive:true});
for(const book of catalog){
 const file=path.join(project,'public/reading',book.id+'.md');
 if(!fs.existsSync(file))throw Error('Missing Russian book: '+book.id);
 const text=fs.readFileSync(file,'utf8');
 const chapters=[...text.matchAll(/^## (.+)$/gm)].map(m=>m[1]);
 const words=wordCount(text);
 if(words<(minimum[book.id]||1250))throw Error('Insufficient detail: '+book.id+' '+words);
 const pages=JSON.parse(fs.readFileSync(path.join(corpus,'books',book.id,'pages.json'),'utf8'));
 let sources=[];
 if(manual[book.id]){
  const starts=manual[book.id];
  sources=starts.map((page,i)=>({page,endPage:starts[i+1]>page?starts[i+1]-1:book.pages,kind:'adaptation',label:'Разделы и темы исходной книги'}));
  if(book.id==='poker')sources[7].endPage=131;
 }else if(summaryGroups[book.id]){
  const starts={};
  for(const p of pages){const m=/^Chapter\s+(\d+)\s+Summary\s*:/i.exec(p.text.trim());if(m&&!starts[m[1]])starts[m[1]]=p.page;}
  sources=summaryGroups[book.id].map(group=>{const start=starts[group[0]],last=group.at(-1);if(!start)throw Error('Missing chapter opening: '+book.id+' '+group[0]);return {page:start,endPage:starts[last+1]?starts[last+1]-1:Math.min(start+6,book.pages),kind:'secondary-adaptation',label:'Пересказ Bookey: '+(group.length>1?'главы '+group.join('–'):'глава '+group[0])};});
  if(book.id==='zone')sources.at(-1).kind='editorial';
 }else if(book.id==='kahneman'){
  const starts=kahnemanTitles.map(title=>{const candidates=pages.filter(p=>p.page>20&&normalize(p.text.trim().slice(0,180)).includes(normalize(title))&&p.text.length>200);if(!candidates.length)throw Error('Missing chapter: '+title);return candidates[0].page;});
  sources=kahnemanGroups.map(group=>({page:starts[group[0]-1],endPage:starts[group.at(-1)]?starts[group.at(-1)]-1:starts[group.at(-1)-1]+8,kind:'adaptation',label:'Главы '+group.join(', ')}));
  const appendix=pages.find(p=>p.page>400&&normalize(p.text.trim().slice(0,220)).includes('judgmentunderuncertainty'));
  sources.push({page:appendix?.page||1,endPage:book.pages,kind:'adaptation',label:'Приложения и учебное применение'});
  sources.push({page:1,endPage:book.pages,kind:'editorial',label:'Учебный словарь по темам книги'});
 }
 if(sources.length!==chapters.length)throw Error('Source/section count mismatch: '+book.id);
 sources.forEach((s,i)=>{
  if(s.page<1||s.page>book.pages||s.endPage<s.page||s.endPage>book.pages)throw Error('Invalid source pages '+book.id+' '+i);
  evidence.push({book:book.id,section:i+1,title:chapters[i],...s,sourceExcerpt:pages[s.page-1].text.trim().slice(0,240)});
 });
 const paragraphs=text.split(/\n\s*\n/).filter(p=>p.length>150);
 if(new Set(paragraphs).size!==paragraphs.length)throw Error('Repeated paragraph in '+book.id);
 const entry={id:book.id,title:book.title,author:book.author,sourceKind:book.kind,sourceSha256:book.sha256,words,sections:chapters.length,chapterTitles:chapters,sha256:hash(text),sources};
 manifest.books.push(entry);fs.copyFileSync(file,path.join(destination,book.id+'.md'));
}
manifest.totalWords=manifest.books.reduce((n,b)=>n+b.words,0);
manifest.totalSections=manifest.books.reduce((n,b)=>n+b.sections,0);
fs.writeFileSync(path.join(project,'public/reading/index.json'),JSON.stringify(manifest,null,2));
fs.writeFileSync(path.join(destination,'index.json'),JSON.stringify(manifest,null,2));
fs.writeFileSync(path.join(project,'qa/russian-reading-provenance.json'),JSON.stringify(evidence,null,2));
fs.writeFileSync(path.join(project,'qa/russian-reading-audit.json'),JSON.stringify({books:manifest.books.length,sections:manifest.totalSections,words:manifest.totalWords,minimumLengthPassed:true,sourceRangesValid:true,unresolved:[],booksDetail:manifest.books.map(({id,words,sections,sourceKind})=>({id,words,sections,sourceKind}))},null,2));
console.log(JSON.stringify({books:manifest.books.length,sections:manifest.totalSections,words:manifest.totalWords},null,2));
