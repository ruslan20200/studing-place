import React, { useEffect, useState } from 'react';
import { createBackup } from './progress.mjs';
import { getPendingProgress, retryProgressSaving } from './store';

export function downloadProgress() {
  let storage;
  try { storage = localStorage; } catch { storage = null; }
  const backup = createBackup(storage, getPendingProgress());
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Место-обучения-полный-прогресс.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function ProgressNotice() {
  const [failed, setFailed] = useState(() => Object.keys(getPendingProgress()).length > 0);
  useEffect(() => {
    const refresh = () => setFailed(Object.keys(getPendingProgress()).length > 0);
    window.addEventListener('campus:saving-status', refresh);
    return () => window.removeEventListener('campus:saving-status', refresh);
  }, []);
  return failed ? <section className="saving-warning" role="alert"><div><b>Не удалось сохранить изменения в браузере.</b><p>Они доступны в этом окне. Скачай полную копию до закрытия сайта или освободи место и повтори сохранение.</p></div><button className="secondary" onClick={downloadProgress}>Скачать копию</button><button className="secondary" onClick={retryProgressSaving}>Повторить сохранение</button></section> : null;
}
