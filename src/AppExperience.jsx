import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Smartphone,ArrowDownToLine,ChevronRight,Check,Share2,MoreVertical,WifiOff,RefreshCw,X} from 'lucide-react';
import {publicAsset} from './public-assets.mjs';
import {getPendingProgress} from './store';

const inApp=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const isApple=()=>/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);

export default function AppExperience({open,onClose,onOpen,showCard}) {
 const [installed,setInstalled]=useState(inApp),[installPrompt,setInstallPrompt]=useState(null);
 const [platform,setPlatform]=useState(()=>isApple()?'ios':'android');
 const [online,setOnline]=useState(navigator.onLine),[ready,setReady]=useState(false),[waiting,setWaiting]=useState(null),[error,setError]=useState(''),[installing,setInstalling]=useState(false);
 const dialog=useRef(),updating=useRef(false);
 useEffect(()=>{
  const prompt=event=>{event.preventDefault();setInstallPrompt(event);};
  const installed=()=>{setInstalled(true);setInstallPrompt(null);};
  const connection=()=>setOnline(navigator.onLine);
  const display=window.matchMedia('(display-mode: standalone)');
  const standalone=()=>setInstalled(inApp());
  window.addEventListener('beforeinstallprompt',prompt);window.addEventListener('appinstalled',installed);
  window.addEventListener('online',connection);window.addEventListener('offline',connection);display.addEventListener('change',standalone);
  return()=>{window.removeEventListener('beforeinstallprompt',prompt);window.removeEventListener('appinstalled',installed);window.removeEventListener('online',connection);window.removeEventListener('offline',connection);display.removeEventListener('change',standalone);};
 },[]);
 useEffect(()=>{
  if(!import.meta.env.PROD||!('serviceWorker' in navigator))return;
  let cancelled=false,registration;
  const controlled=()=>{if(updating.current)window.location.reload();};
  const check=()=>{if(document.visibilityState==='visible')registration?.update().catch(()=>{});};
  const detectUpdate=()=>{const worker=registration.installing;if(!worker)return;worker.addEventListener('statechange',()=>{if(cancelled)return;if(worker.state==='installed'&&navigator.serviceWorker.controller)setWaiting(registration.waiting);if(worker.state==='redundant'&&!navigator.serviceWorker.controller)setError('Не удалось сохранить приложение для работы без интернета. Попробуй открыть сайт с устойчивым соединением.');});};
  navigator.serviceWorker.addEventListener('controllerchange',controlled);document.addEventListener('visibilitychange',check);
  navigator.serviceWorker.register(publicAsset('sw.js'),{scope:import.meta.env.BASE_URL,updateViaCache:'none'}).then(value=>{
   registration=value;if(cancelled)return;
   if(value.waiting)setWaiting(value.waiting);value.addEventListener('updatefound',detectUpdate);detectUpdate();
   navigator.serviceWorker.ready.then(()=>{if(!cancelled)setReady(true);});
  }).catch(()=>{if(!cancelled)setError('Работа без интернета пока недоступна. Сам сайт можно использовать как обычно.');});
  return()=>{cancelled=true;navigator.serviceWorker.removeEventListener('controllerchange',controlled);document.removeEventListener('visibilitychange',check);registration?.removeEventListener('updatefound',detectUpdate);};
 },[]);
 useEffect(()=>{if(open&&!dialog.current.open)dialog.current.showModal();else if(!open&&dialog.current.open)dialog.current.close();},[open]);
 async function install(){
  if(!installPrompt||installing)return;setInstalling(true);setError('');
  try{await installPrompt.prompt();const choice=await installPrompt.userChoice;setInstallPrompt(null);if(choice.outcome==='accepted'){setInstalled(true);onClose();}}
  catch{setError('Открой меню браузера и добавь сайт на главный экран по инструкции ниже.');setInstallPrompt(null);}
  finally{setInstalling(false);}
 }
 function update(){
  if(Object.keys(getPendingProgress()).length){setError('Перед обновлением сохрани полную копию записей с помощью предупреждения выше.');return;}
  updating.current=true;waiting?.postMessage({type:'ACTIVATE_UPDATE'});
 }
 return <>
  {!online&&<aside className="app-status" role="status"><WifiOff size={20}/><div><b>Ты без интернета</b><p>Уроки, тренажёр и журнал доступны. Для новых PDF и иллюстраций понадобится соединение.</p></div></aside>}
  {waiting&&<aside className="app-status app-update" role="status"><RefreshCw size={20}/><div><b>Есть новая версия</b><p>Обнови, когда закончишь работу на этой странице. Записи останутся.</p>{error&&<p>{error}</p>}</div><button className="secondary" onClick={update}>Обновить</button></aside>}
  {showCard&&!installed&&<button className="app-install-card" onClick={onOpen}><span className="app-install-icon"><Smartphone size={24}/></span><span><b>Добавить на экран «Домой»</b><small>Добавь значок и открывай как приложение</small></span><ChevronRight size={20}/></button>}
  {createPortal(<dialog ref={dialog} className="install-dialog" aria-labelledby="install-title" onCancel={onClose} onClose={onClose} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
   <header><span className="eyebrow">ВСЕГДА ПОД РУКОЙ</span><button className="icon-button" onClick={onClose} aria-label="Закрыть установку"><X size={22}/></button></header>
   <div className="install-heading"><img src={publicAsset('icons/app-192.png')} width="64" height="64" alt=""/><div><h2 id="install-title">Место обучения<br/>на твоём телефоне</h2><p>Один значок — и ты в своём пространстве.</p></div></div>
   {installed?<p className="install-ready"><Check size={20}/> Приложение уже добавлено. Открывай его с главного экрана.</p>:<>
    <div className="install-platform" role="tablist" aria-label="Твой телефон"><button id="install-android-tab" role="tab" aria-selected={platform==='android'} aria-controls="install-instructions" onClick={()=>setPlatform('android')}>Android</button><button id="install-ios-tab" role="tab" aria-selected={platform==='ios'} aria-controls="install-instructions" onClick={()=>setPlatform('ios')}>iPhone / iPad</button></div>
    <section id="install-instructions" role="tabpanel" aria-labelledby={platform==='ios'?'install-ios-tab':'install-android-tab'}>
     {platform==='ios'?<ol className="install-steps"><li><b>Открой сайт в Safari</b><span>Если ты сейчас в мессенджере, выбери «Открыть в Safari».</span></li><li><b><Share2 size={17}/> Нажми «Поделиться»</b><span>Открой меню страницы и найди значок со стрелкой вверх.</span></li><li><b>Выбери «На экран „Домой“»</b><span>При необходимости прокрути список. Включи «Открывать как веб-приложение», если этот пункт появится, и нажми «Добавить».</span></li></ol>:<>
      {installPrompt&&<button className="primary install-primary" onClick={install} disabled={installing}><ArrowDownToLine size={19}/>{installing?'Открываем установку…':'Установить приложение'}</button>}
      <ol className="install-steps"><li><b>Открой сайт в Chrome</b><span>Используй обычный браузер, а не окно внутри мессенджера.</span></li><li><b><MoreVertical size={17}/> Открой меню браузера</b><span>Нажми три точки рядом с адресом страницы.</span></li><li><b>Выбери «Установить приложение»</b><span>Пункт может называться «Добавить на главный экран». Подтверди добавление.</span></li></ol>
     </>}
    </section>
   </>}
   <div className="install-offline"><Check size={18}/><div><b>{ready?'Уроки готовы к работе без интернета':'Сначала открой сайт с интернетом'}</b><p>Уроки, практика, журнал и русские конспекты доступны без сети после первой загрузки. PDF и новые иллюстрации требуют интернета.</p></div></div>
   <p className="install-data-note">Записи хранятся на этом устройстве. Для переноса между телефоном и компьютером используй полную копию в журнале.</p>
   {error&&!waiting&&<p className="error-note" role="status">{error}</p>}
  </dialog>,document.body)}
 </>;
}
