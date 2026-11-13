import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

export async function buildPwa(directory, base='/') {
 const assets=(await fs.readdir(path.join(directory,'assets'))).filter(name=>/\.(js|css|woff2)$/.test(name)).map(name=>'assets/'+name);
 const reading=(await fs.readdir(path.join(directory,'reading'))).filter(name=>name.endsWith('.md')).map(name=>'reading/'+name);
 const files=['index.html','manifest.webmanifest','icons/app-192.png','icons/app-512.png','icons/app-maskable-512.png','icons/apple-touch-icon.png',...assets,...reading,'reading/index.json',...['catalog','knowledge','source-map','quality-report'].map(name=>'data/'+name+'.json')];
 const template=await fs.readFile(fileURLToPath(new URL('./service-worker.js',import.meta.url)),'utf8');
 const hash=crypto.createHash('sha256').update(template).update(base);
 for(const name of files)hash.update(name).update(await fs.readFile(path.join(directory,name)));
 const version=hash.digest('hex').slice(0,16);
 const code=template.replace('__BUILD_VERSION__',JSON.stringify(version)).replace('__PRECACHE_FILES__',JSON.stringify(files));
 await fs.writeFile(path.join(directory,'sw.js'),code);
 return {version,files};
}

export function pwaPlugin() {
 let config;
 return {name:'campus-phone-app',apply:'build',configResolved(value){config=value;},async closeBundle(){await buildPwa(path.resolve(config.root,config.build.outDir),config.base);}};
}
