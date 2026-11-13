import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {buildPwa} from '../scripts/pwa.mjs';

async function workerHarness({offline=false,quotaFull=false}={}) {
 const origin='https://example.test',scope=origin+'/studing-place/';
 const handlers={},stores=new Map(),network=[];
 const key=request=>typeof request==='string'?request:request.url;
 const caches={
  async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);},
  async open(name){if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);return {
   async addAll(urls){for(const url of urls)store.set(url,new Response('saved:'+url));},
   async match(request,options){const saved=store.get(key(request));if(saved?.headers.get('Vary')==='Origin'&&!options?.ignoreVary)return undefined;return saved?.clone();},
   async put(request,response){if(quotaFull)throw Error('Quota full');store.set(key(request),response.clone());},
   async keys(){return [...store.keys()].map(url=>new Request(url));},async delete(request){return store.delete(key(request));}
  };}
 };
 let claimed=false,skipped=false;
 const self={location:new URL(scope+'sw.js'),clients:{async claim(){claimed=true;}},skipWaiting(){skipped=true;},addEventListener(name,fn){handlers[name]=fn;}};
 const fetch=async request=>{network.push(key(request));if(offline)throw Error('Offline');return new Response('online:'+key(request));};
 const source=(await fs.readFile(new URL('../scripts/service-worker.js',import.meta.url),'utf8')).replace('__BUILD_VERSION__','"test"').replace('__PRECACHE_FILES__',JSON.stringify(['index.html','assets/app.js','reading/murphy.md']));
 vm.runInNewContext(source,{self,caches,fetch,URL,Response,Request});
 const event=async(name,value={})=>{let pending;handlers[name]({...value,waitUntil(promise){pending=promise;}});await pending;};
 const request=async(url,options={})=>{let response;const req={url,method:options.method||'GET',mode:options.mode||'cors',headers:new Headers(options.headers)};handlers.fetch({request:req,respondWith(promise){response=promise;}});return response?await response:null;};
 return {scope,caches,stores,event,request,network,setOffline(){offline=true;},get claimed(){return claimed;},get skipped(){return skipped;}};
}

test('offline launch, JavaScript and Russian reading resolve from the same application shell',async()=>{
 const w=await workerHarness({offline:true});await w.event('install');
 for(const [path,options] of [['',{mode:'navigate'}],['assets/app.js',{}],['reading/murphy.md',{}]]){
  const response=await w.request(w.scope+path,options);assert.equal(response.status,200);assert.match(await response.text(),/^saved:/);
 }
 assert.equal(w.network.length,0);
 assert.equal((await w.request(w.scope+'library/new/pages.json')).status,503);
});

test('worker leaves PDFs, partial downloads, external resources and other projects alone',async()=>{
 const w=await workerHarness();
 for(const [url,options] of [[w.scope+'originals/book.pdf',{mode:'navigate'}],[w.scope+'library/page.png',{headers:{range:'bytes=0-99'}}],['https://other.test/studing-place/reading/a.md',{}],['https://example.test/other-project/',{mode:'navigate'}],[w.scope+'reading/a.md',{method:'POST'}]])assert.equal(await w.request(url,options),null);
});

test('module requests still use the cached shell when a static host sends Vary: Origin',async()=>{
 const w=await workerHarness({offline:true});await w.event('install');
 const cache=await w.caches.open('campus:/studing-place/:core:test');await cache.put(w.scope+'assets/app.js',new Response('module code',{headers:{Vary:'Origin'}}));
 assert.equal(await (await w.request(w.scope+'assets/app.js')).text(),'module code');assert.equal(w.network.length,0);
});

test('updates wait for an explicit request, preserve another app cache and keep the previous shell',async()=>{
 const w=await workerHarness();const prefix='campus:/studing-place/:core:';
 for(const name of ['unrelated-app',prefix+'oldest',prefix+'previous',prefix+'test'])await w.caches.open(name);
 await w.event('activate');assert.equal(w.claimed,true);assert.equal(w.skipped,false);
 assert.deepEqual(await w.caches.keys(),['unrelated-app',prefix+'previous',prefix+'test']);
 await w.event('message',{data:{type:'ACTIVATE_UPDATE'}});assert.equal(w.skipped,true);
});

test('runtime reading cache stays bounded and a full cache does not block the online book',async()=>{
 const w=await workerHarness();
 for(let i=0;i<83;i++)assert.equal((await w.request(w.scope+'library/murphy/image-'+i+'.png')).status,200);
 const cached=await w.caches.open('campus:/studing-place/:reading:v1');assert.equal((await cached.keys()).length,80);assert.equal(await cached.match(w.scope+'library/murphy/image-0.png'),undefined);
 w.setOffline();const saved=await w.request(w.scope+'library/murphy/image-82.png');assert.equal(saved.status,200);assert.match(await saved.text(),/^online:/);
 const full=await workerHarness({quotaFull:true});const response=await full.request(full.scope+'library/murphy/pages.json');assert.equal(response.status,200);assert.match(await response.text(),/^online:/);
});

test('manifest stays inside the project and app icons have real matching PNG dimensions',async()=>{
 const manifest=JSON.parse(await fs.readFile(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
 for(const base of ['https://example.test/','https://example.test/studing-place/']){
  const source=new URL('manifest.webmanifest',base);assert.equal(new URL(manifest.start_url,source).href,base);assert.equal(new URL(manifest.scope,source).href,base);
  for(const shortcut of manifest.shortcuts)assert.ok(new URL(shortcut.url,source).href.startsWith(base));
 }
 assert.equal(manifest.display,'standalone');
 for(const icon of manifest.icons){const png=await fs.readFile(new URL('../public/'+icon.src,import.meta.url));assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`,icon.sizes);}
});

test('production cache version changes when learning content or the hosting base changes',async t=>{
 const os=await import('node:os'),path=await import('node:path');const root=await fs.mkdtemp(path.join(os.tmpdir(),'campus-pwa-'));
 assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('campus-pwa-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const fixture=['index.html','manifest.webmanifest','icons/app-192.png','icons/app-512.png','icons/app-maskable-512.png','icons/apple-touch-icon.png','assets/app.js','reading/murphy.md','reading/index.json',...['catalog','knowledge','source-map','quality-report'].map(x=>'data/'+x+'.json')];
 for(const name of fixture){await fs.mkdir(path.dirname(path.join(root,name)),{recursive:true});await fs.writeFile(path.join(root,name),'fixture');}
 const first=await buildPwa(root,'/studing-place/');const same=await buildPwa(root,'/studing-place/');assert.equal(first.version,same.version);
 await fs.writeFile(path.join(root,'reading/murphy.md'),'revised lesson');const next=await buildPwa(root,'/studing-place/');assert.notEqual(first.version,next.version);assert.notEqual(next.version,(await buildPwa(root,'/')).version);
 assert.equal(first.files.some(x=>x.endsWith('.pdf')),false);assert.equal(first.files.includes('assets/app.js'),true);
});
