import {isJournalEntry,isJournalDraft} from './journal.mjs';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = value => Number.isFinite(value) && value >= 0;
const record = (value, check) => object(value) && Object.entries(value).every(([key, item]) => !['__proto__', 'constructor', 'prototype'].includes(key) && check(item));
const strings = value => Array.isArray(value) && value.every(item => typeof item === 'string');
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
const statFields = { chart: ['correct','total','best'], sizing: ['correct','total','best'], exam: ['attempts','best','last'], cards: ['reviewed'], sim: ['trades'], series: ['runs'] };
const validTrade = value => value === null || (object(value) && ['long', 'short'].includes(value.direction) && ['entry', 'stop', 'target', 'distance', 'riskMoney'].every(key => Number.isFinite(value[key]) && value[key] > 0) && (value.riskIncludesCosts === undefined || typeof value.riskIncludesCosts === 'boolean'));
export function validSimulator(value) {
  return object(value) && Number.isInteger(value.seed) && value.seed >= 0 && value.seed <= 0xffffffff
    && Number.isInteger(value.visible) && value.visible >= 26 && value.visible <= 90
    && validTrade(value.trade) && Array.isArray(value.events)
    && value.events.every(event => object(event) && typeof event.id === 'string' && Number.isFinite(event.r) && Number.isFinite(event.pnl) && Number.isFinite(event.entry) && Number.isFinite(event.exit) && ['long', 'short'].includes(event.direction) && typeof event.reason === 'string' && typeof event.reasonText === 'string' && typeof event.saved === 'boolean')
    && finite(value.distance) && value.distance >= .5 && value.distance <= 5
    && finite(value.rr) && value.rr >= 1 && value.rr <= 4
    && finite(value.riskPct) && value.riskPct >= .25 && value.riskPct <= 3
    && [1, 2, 4].includes(value.speed) && typeof value.reason === 'string';
}
function validValue(key, value) {
  switch (key) {
    case 'campus.completed': return strings(value);
    case 'campus.notes': return record(value, item => typeof item === 'string');
    case 'campus.journal':
    case 'campus.journalTrash': return Array.isArray(value) && value.every(isJournalEntry);
    case 'campus.journalDraft': return isJournalDraft(value);
    case 'campus.last': return typeof value === 'string';
    case 'campus.theme': return ['system', 'light', 'dark'].includes(value);
    case 'campus.stats': return object(value) && Object.entries(value).every(([group, fields]) => statFields[group] && object(fields) && statFields[group].every(field => field === 'last' && fields[field] === null || finite(fields[field])));
    case 'campus.activity': return object(value) && Object.entries(value).every(([date, group]) => day(date) && record(group, finite));
    case 'campus.cards': return record(value, card => object(card) && Number.isInteger(card.box) && card.box >= 1 && card.box <= 5 && day(card.due));
    case 'campus.plan': return object(value) && ['market','timeframe','hours','context','entry','stop','target','noTrade'].every(field => typeof value[field] === 'string') && ['risk','dailyLimit','maxTrades'].every(field => finite(value[field]));
    case 'campus.simulator': return validSimulator(value);
    default: return key.startsWith('campus.reader.') && object(value) && Number.isInteger(value.chapter) && value.chapter >= 0 && Array.isArray(value.done) && value.done.every(index => Number.isInteger(index) && index >= 0) && [16, 18, 20].includes(value.size);
  }
}
export function readProgress(storage) {
  const data = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith('campus.')) data[key] = JSON.parse(storage.getItem(key));
  }
  return data;
}
export function createBackup(storage, pending = {}) {
  let saved;
  try { saved = readProgress(storage); }
  catch (error) { if (!Object.keys(pending).length) throw error; saved = {}; }
  return { app: 'trading-campus', version: 2, created: new Date().toISOString(), data: { ...saved, ...pending } };
}
export function parseBackup(text) {
  const backup = JSON.parse(text);
  if (!object(backup)) throw new Error('Выбери файл экспорта этой платформы.');
  let data;
  if (backup.version === 1 && Array.isArray(backup.journal)) {
    data = { 'campus.journal': backup.journal };
    if (backup.completed !== undefined) data['campus.completed'] = backup.completed;
    if (backup.notes !== undefined) data['campus.notes'] = backup.notes;
  } else if (backup.version === 2 && backup.app === 'trading-campus' && object(backup.data)) {
    data = backup.data;
  } else throw new Error('Неизвестный формат. Поддерживаются экспорты версии 1 и 2.');
  if (!Object.entries(data).every(([key, value]) => validValue(key, value))) {
    throw new Error('В файле повреждённые или неподходящие данные. Текущий прогресс не изменён.');
  }
  return { version: backup.version, data };
}
const union = (a, b) => [...new Set([...a, ...b])];
const nonempty = value => typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null;
export function mergeProgress(current, incoming) {
  const result = { ...current };
  for (const [key, value] of Object.entries(incoming)) {
    const old = current[key];
    if (old === undefined) { result[key] = value; continue; }
    if (key === 'campus.completed') result[key] = union(old, value);
    else if (key === 'campus.journal' || key === 'campus.journalTrash') {
      const entries = new Map(value.map(item => [item.id, item]));
      old.forEach(item => entries.set(item.id, item));
      result[key] = [...entries.values()].sort((a, b) => b.date.localeCompare(a.date));
    } else if (key === 'campus.notes' || key === 'campus.plan') {
      const localPlanIsEmpty = key === 'campus.plan' && !['market', 'timeframe', 'hours', 'context', 'entry', 'stop', 'target'].some(field => String(old[field] || '').trim());
      result[key] = localPlanIsEmpty ? { ...old, ...value } : { ...value, ...Object.fromEntries(Object.entries(old).filter(([, item]) => nonempty(item))) };
    } else if (key === 'campus.cards') result[key] = { ...value, ...old };
    else if (key === 'campus.journalDraft') result[key] = old ?? value;
    else if (key === 'campus.stats' || key === 'campus.activity') {
      const groups = { ...value };
      for (const [group, fields] of Object.entries(old)) {
        groups[group] = { ...value[group], ...fields };
        for (const [field, number] of Object.entries(value[group] || {})) {
          if (field !== 'last') groups[group][field] = Math.max(number || 0, fields[field] || 0);
          else if (fields[field] == null) groups[group][field] = number;
        }
      }
      result[key] = groups;
    } else if (key.startsWith('campus.reader.')) {
      const localHasReading = old.chapter > 0 || old.done.length > 0;
      result[key] = { ...(localHasReading ? old : value), done: union(old.done, value.done) };
    } else if (key === 'campus.simulator') {
      const localHasSession = old.events.length || old.trade || old.visible > 26 || old.reason.trim();
      result[key] = localHasSession ? old : value;
    }
  }
  if (result['campus.journalTrash'] && result['campus.journal']) {
    const locallyDeleted = new Set((current['campus.journalTrash']||[]).map(entry=>entry.id));
    result['campus.journal']=result['campus.journal'].filter(entry=>!locallyDeleted.has(entry.id));
    const active = new Set(result['campus.journal'].map(entry=>entry.id));
    result['campus.journalTrash']=result['campus.journalTrash'].filter(entry=>!active.has(entry.id));
  }
  return result;
}
/** Write the whole validated import before notifying React; roll back a failed write. */
export function restoreProgress(storage, incoming, pending = {}) {
  const merged = mergeProgress({ ...readProgress(storage), ...pending }, incoming);
  const before = new Map(Object.keys(merged).map(key => [key, storage.getItem(key)]));
  const written = [];
  try {
    for (const [key, value] of Object.entries(merged)) {
      storage.setItem(key, JSON.stringify(value));
      written.push(key);
    }
  } catch {
    for (const key of written.reverse()) {
      const old = before.get(key);
      if (old === null) storage.removeItem(key); else storage.setItem(key, old);
    }
    throw new Error('Браузер не смог сохранить импорт. Освободи место и повтори.');
  }
  return merged;
}
