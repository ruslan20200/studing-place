import fs from 'node:fs';
import path from 'node:path';
import {guides} from '../src/data/book-guides.js';
import {lessons} from '../src/data/curriculum.js';
const root='/Users/rus/Desktop/book-traiding/parsed-data';
const out='/Users/rus/Desktop/trading-campus/public/data';
const catalog=JSON.parse(fs.readFileSync(path.join(root,'catalog.json'),'utf8'));
fs.copyFileSync(path.join(root,'catalog.json'),path.join(out,'catalog.json'));
fs.copyFileSync(path.join(root,'quality-report.json'),path.join(out,'quality-report.json'));
const sourceMap={},missing=[];
const preferred={murphy:{Trend:86,Support:92,Volume:195,'Moving Averages':232,Candlestick:342,Intermarket:460,Gaps:131},elder:{'Triple Screen':248,'Money Management':273,Probabilities:269},probability:{'Trading Plan':70,'Trading the News':33}};
for(const book of catalog){
 const pages=JSON.parse(fs.readFileSync(path.join(root,'books',book.id,'pages.json'),'utf8'));
 const terms=[...new Set([...(guides[book.id]?.topics.map(t=>t[0])||[]),...lessons.flatMap(l=>l.sources.filter(s=>s[0]===book.id).map(s=>s[1]))])];
 sourceMap[book.id]={};
 for(const term of terms){
  const needle=term.toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ');
  const hits=pages.map(p=>{const text=p.text.toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ');const at=text.indexOf(needle);return {...p,at,score:(at>=0?(at<400?5:1):0)+(p.text.length>800?2:0)};}).filter(p=>p.at>=0&&p.page>({murphy:17,bernstein:12,elder:18,forex:18,wizards:6,kahneman:30,poker:24}[book.id]||6)&&p.text.length>250).sort((a,b)=>b.score-a.score||a.page-b.page);
  const selected=preferred[book.id]?.[term];
  if(selected){const p=pages[selected-1];if(!p.text.toLowerCase().replace(/\s+/g,' ').includes(term.toLowerCase()))throw new Error('Reference mismatch: '+book.id+' '+term);sourceMap[book.id][term]={page:selected,query:term};}
  else if(hits.length)sourceMap[book.id][term]={page:hits[0].page,query:term};else missing.push({book:book.id,term});
 }
}
fs.writeFileSync(path.join(out,'source-map.json'),JSON.stringify(sourceMap,null,2));
fs.writeFileSync('/Users/rus/Desktop/trading-campus/qa/source-reference-audit.json',JSON.stringify({references:Object.values(sourceMap).reduce((n,x)=>n+Object.keys(x).length,0),missing},null,2));
console.log(JSON.stringify({catalog:catalog.length,lessons:lessons.length,missing},null,2));
