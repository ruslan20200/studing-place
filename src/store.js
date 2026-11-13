import { useCallback, useEffect, useRef, useState } from 'react';

const pendingWrites = new Map();
export const getPendingProgress = () => Object.fromEntries(pendingWrites);
export function retryProgressSaving() {
  for (const [key, value] of pendingWrites) {
    try { localStorage.setItem(key, JSON.stringify(value)); pendingWrites.delete(key); } catch { break; }
  }
  window.dispatchEvent(new CustomEvent('campus:saving-status'));
}
export function progressRestored() {
  pendingWrites.clear();
  window.dispatchEvent(new CustomEvent('campus:progress-restored'));
  window.dispatchEvent(new CustomEvent('campus:saving-status'));
}

/** Состояние, которое сохраняется в localStorage этого браузера. */
export function useStored(key, initial) {
  const read = () => {
    if (pendingWrites.has(key)) return pendingWrites.get(key);
    try { return JSON.parse(localStorage.getItem(key)) ?? initial; } catch { return initial; }
  };
  const [value, setValue] = useState(read);
  const latest = useRef(value);
  latest.current = value;
  const setStored = useCallback(update => {
    const next = typeof update === 'function' ? update(latest.current) : update;
    latest.current = next;
    try { localStorage.setItem(key, JSON.stringify(next)); pendingWrites.delete(key); }
    catch { pendingWrites.set(key, next); }
    setValue(next);
    window.dispatchEvent(new CustomEvent('campus:saving-status'));
  }, [key]);
  useEffect(() => {
    const refresh = event => {
      if (event.type === 'storage' && event.key && event.key !== key) return;
      latest.current = read();
      setValue(latest.current);
    };
    window.addEventListener('storage', refresh);
    window.addEventListener('campus:progress-restored', refresh);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('campus:progress-restored', refresh); };
  }, [key]);
  return [value, setStored];
}

/**
 * crypto.randomUUID есть только в «безопасном контексте» (https или localhost).
 * При открытии с телефона по адресу http://192.168.x.x его нет — нужен запасной вариант.
 */
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

/** Дата в формате YYYY-MM-DD по местному времени. */
export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const shuffle = (list, random = Math.random) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const plural = (n, one, few, many) =>
  n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many;

export const emptyStats = {
  chart: { correct: 0, total: 0, best: 0 },
  sizing: { correct: 0, total: 0, best: 0 },
  exam: { attempts: 0, best: 0, last: null },
  cards: { reviewed: 0 },
  sim: { trades: 0 },
  series: { runs: 0 },
};

/** Опыт (XP) считается из реальных действий, а не начисляется «за вход». */
export function computeXp({ completed = [], journal = [], stats = emptyStats, cards = {} }) {
  const s = { ...emptyStats, ...stats };
  const mastered = Object.values(cards).filter(c => c.box >= 4).length;
  return completed.length * 60
    + journal.length * 15
    + s.chart.correct * 8
    + s.sizing.correct * 10
    + s.exam.best * 12
    + s.cards.reviewed * 2
    + mastered * 10
    + s.sim.trades * 6
    + s.series.runs * 5;
}
