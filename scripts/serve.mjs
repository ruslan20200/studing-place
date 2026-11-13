import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const types={'.webmanifest':'application/manifest+json; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.pdf':'application/pdf','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  let file=path.resolve(root,'.'+name);
  if(file!==root.slice(0,-1)&&!file.startsWith(root)){res.writeHead(403);res.end();return;}
  let stat=await fsp.stat(file);
  if(stat.isDirectory()){file=path.join(file,'index.html');stat=await fsp.stat(file);}
  const headers={'Content-Type':types[path.extname(file).toLowerCase()]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'};
  let start=0,end=stat.size-1,status=200;
  if(req.headers.range){
   const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
   if(!range){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});res.end();return;}
   if(!range[1])start=Math.max(0,stat.size-Number(range[2]));
   else {start=Number(range[1]);if(range[2])end=Math.min(end,Number(range[2]));}
   if(start>end||start>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});res.end();return;}
   status=206;headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
  }
  headers['Content-Length']=Math.max(0,end-start+1);res.writeHead(status,headers);
  if(req.method==='HEAD'||stat.size===0)res.end();else fs.createReadStream(file,{start,end}).pipe(res);
 }catch(e){res.writeHead(e.code==='ENOENT'?404:400);res.end('Файл недоступен');}
});
const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT)||5173;
server.listen(port,host,async()=>{
 console.log(`Место обучения: http://127.0.0.1:${port}/`);
 if(host==='0.0.0.0'){const os=await import('node:os');for(const list of Object.values(os.networkInterfaces()))for(const a of list||[])if(a.family==='IPv4'&&!a.internal)console.log(`С телефона (та же Wi‑Fi сеть): http://${a.address}:${port}/`);}
});
