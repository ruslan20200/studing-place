const VERSION=__BUILD_VERSION__;
const FILES=__PRECACHE_FILES__;
const BASE=new URL('./',self.location.href);
const PREFIX='campus:'+BASE.pathname+':';
const CORE=PREFIX+'core:'+VERSION;
const READING=PREFIX+'reading:v1';
const urls=FILES.map(file=>new URL(file,BASE).href);

self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CORE).then(cache=>cache.addAll(urls)));
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  // Keep the previous shell for another still-open tab. Never clear other apps.
  const old=(await caches.keys()).filter(key=>key.startsWith(PREFIX+'core:')&&key!==CORE);
  await Promise.all(old.slice(0,-1).map(key=>caches.delete(key)));
  await self.clients.claim();
 })());
});
self.addEventListener('message',event=>{
 if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();
});

async function cachedCore(request) {
 const cache=await caches.open(CORE);
 // Static application files do not depend on Origin or other Vary headers.
 return await cache.match(request,{ignoreVary:true})||fetch(request);
}
async function readingResource(request) {
 const cache=await caches.open(READING);
 try {
  const response=await fetch(request);
  if(response.ok&&response.status===200&&Number(response.headers.get('content-length')||0)<=5*1024*1024){
   try {
    await cache.put(request,response.clone());
    const keys=await cache.keys();
    await Promise.all(keys.slice(0,Math.max(0,keys.length-80)).map(key=>cache.delete(key)));
   } catch {/* A full cache must not prevent reading the online response. */}
  }
  if(!response.ok){const saved=await cache.match(request);if(saved)return saved;}
  return response;
 } catch {
  return await cache.match(request)||new Response('Этот материал ещё не сохранён. Открой его с интернетом.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
 }
}
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname)||request.headers.has('range')||url.pathname.endsWith('.pdf'))return;
 if(request.mode==='navigate'&&(url.pathname===BASE.pathname||url.pathname===BASE.pathname+'index.html')){
  event.respondWith(cachedCore(new URL('index.html',BASE).href));return;
 }
 if(urls.includes(url.href)){event.respondWith(cachedCore(request));return;}
 if(url.pathname.startsWith(BASE.pathname+'library/')||url.pathname.startsWith(BASE.pathname+'reading/'))event.respondWith(readingResource(request));
});
