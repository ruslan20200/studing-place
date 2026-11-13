export function positionSize({capital,riskPct,entry,stop,costs=0,multiplier=1,step=1}) {
 const values=[capital,riskPct,entry,stop,costs,multiplier,step];
 if(values.some(v=>!Number.isFinite(v)) || capital<=0 || riskPct<=0 || riskPct>100 || entry<=0 || stop<=0 || multiplier<=0 || step<=0 || costs<0 || entry===stop) return {valid:false,quantity:0};
 const budget=capital*riskPct/100;
 const perUnit=Math.abs(entry-stop)*multiplier;
 const raw=Math.max(0,(budget-costs)/perUnit);
 const quantity=Number((Math.floor((raw+1e-10)/step)*step).toFixed(8));
 return {valid:true,budget,perUnit,quantity,plannedLoss:quantity?quantity*perUnit+costs:0,notional:quantity*entry*multiplier};
}
export const expectancy=(p,win,loss,cost)=>p*win-(1-p)*loss-cost;
export const recovery=d=>d>=1?Infinity:d/(1-d);
export function fillBuy(qty,asks=[[101,2],[102,3],[103,5],[104,8]]){
 let remaining=Math.max(0,qty),cost=0,fills=[];
 for(const [price,size] of asks){const q=Math.min(remaining,size);if(q){fills.push({price,quantity:q});cost+=q*price;remaining-=q;}}
 const filled=qty-remaining;return {fills,filled,remaining,average:filled?cost/filled:0,cost};
}
export function makeCandles(seed=17,count=90){
 let s=seed,price=100;const random=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
 return Array.from({length:count},(_,i)=>{const o=price;const drift=i<25?.22:i<45?-.06:i<65?-.26:.17;const c=o+(random()-.46)*2.2+drift;price=c;return {o,c,h:Math.max(o,c)+random()*1.5,l:Math.min(o,c)-random()*1.5,v:30+random()*90};});
}
export function tradeResultR(trade, price, cost = .1) {
 const gross = (trade.direction === 'long' ? price - trade.entry : trade.entry - price) / trade.distance;
 return (gross - cost) / (trade.riskIncludesCosts ? 1 + cost : 1);
}
export function settleTrade(trade,candle,cost=.1){
 const long=trade.direction==='long';
 const hitStop=long?candle.l<=trade.stop:candle.h>=trade.stop;
 const hitTarget=long?candle.h>=trade.target:candle.l<=trade.target;
 if(!hitStop&&!hitTarget)return null;
 const price=hitStop?(long?Math.min(candle.o,trade.stop):Math.max(candle.o,trade.stop)):trade.target;
 return {exit:price,reason:hitStop?'Защитный выход':'Цель',ambiguous:hitStop&&hitTarget,r:tradeResultR(trade,price,cost)};
}

// ───────── Учебные механики: генераторы, статистика, повторение ─────────

/** Детерминированный генератор случайных чисел (LCG): одинаковый seed → одинаковые данные. */
export function rng(seed = 1) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export const REGIMES = {
  up: 'Восходящий тренд',
  down: 'Нисходящий тренд',
  range: 'Боковой диапазон',
  breakout: 'Диапазон и пробой вверх',
};

/** Искусственные свечи с заранее известной структурой — для тренировки чтения графика. */
export function makeRegime(kind, seed = 1, count = 56) {
  const random = rng(seed * 7919 + kind.length * 31);
  let price = 100;
  const candles = [];
  for (let i = 0; i < count; i++) {
    const o = price;
    const wave = Math.sin(i / 3.2 + seed) * 0.55; // волны: откаты внутри тренда
    let move;
    if (kind === 'up') move = 0.42 + wave + (random() - 0.5) * 1.1;
    else if (kind === 'down') move = -0.42 + wave + (random() - 0.5) * 1.1;
    else if (kind === 'range') move = (100 - o) * 0.28 + wave * 1.4 + (random() - 0.5) * 1.3;
    else move = i < count * 0.62 ? (100 - o) * 0.3 + wave + (random() - 0.5) * 1.1 : 0.85 + (random() - 0.35) * 1.2;
    const c = o + move;
    price = c;
    candles.push({ o, c, h: Math.max(o, c) + random() * 0.9, l: Math.min(o, c) - random() * 0.9, v: 30 + random() * 90 });
  }
  return candles;
}

/** Статистика серии сделок в единицах R (в хронологическом порядке). */
export function tradeStats(rs) {
  const n = rs.length;
  let equity = 0, peak = 0, maxDD = 0, wins = 0, grossWin = 0, grossLoss = 0;
  const curve = [0];
  for (const r of rs) {
    equity += r;
    if (r > 0) { wins++; grossWin += r; } else grossLoss -= r;
    peak = Math.max(peak, equity);
    maxDD = Math.max(maxDD, peak - equity);
    curve.push(equity);
  }
  return {
    n, wins, losses: n - wins,
    winRate: n ? wins / n : 0,
    total: equity,
    avg: n ? equity / n : 0,
    profitFactor: grossLoss ? grossWin / grossLoss : grossWin ? Infinity : 0,
    maxDD, curve,
  };
}

const quantile = (sorted, q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)))] : 0;

/** Монте-Карло: много вариантов одной и той же серии сделок с фиксированным % риска. */
export function simulateSeries({ winRate, rr, riskPct, trades = 100, paths = 60, seed = 7, start = 10000, cost = 0 }) {
  const random = rng(seed);
  const all = [];
  for (let p = 0; p < paths; p++) {
    let equity = start, peak = start, maxDD = 0, streak = 0, worstStreak = 0;
    const curve = [start];
    for (let t = 0; t < trades; t++) {
      const win = random() < winRate;
      const r = (win ? rr : -1) - cost;
      equity = Math.max(0, equity + equity * riskPct / 100 * r);
      streak = win ? 0 : streak + 1;
      worstStreak = Math.max(worstStreak, streak);
      peak = Math.max(peak, equity);
      maxDD = Math.max(maxDD, peak ? (peak - equity) / peak : 1);
      curve.push(equity);
    }
    all.push({ final: equity, maxDD, worstStreak, curve });
  }
  const finals = all.map(p => p.final).sort((a, b) => a - b);
  const dds = all.map(p => p.maxDD).sort((a, b) => a - b);
  return {
    paths: all,
    median: quantile(finals, 0.5),
    p10: quantile(finals, 0.1),
    p90: quantile(finals, 0.9),
    medianDD: quantile(dds, 0.5),
    worstDD: dds[dds.length - 1] || 0,
    lossShare: all.filter(p => p.final < start).length / (all.length || 1),
    halfShare: all.filter(p => p.maxDD >= 0.5).length / (all.length || 1),
    worstStreak: Math.max(0, ...all.map(p => p.worstStreak)),
    expectancyR: winRate * rr - (1 - winRate) - cost,
  };
}

/** Задача на расчёт размера позиции с «круглыми» числами. */
export function sizingProblem(seed = 1) {
  const random = rng(seed * 104729);
  const pick = list => list[Math.floor(random() * list.length)];
  const capital = pick([1000, 2000, 2500, 5000, 8000, 10000, 20000]);
  const riskPct = pick([0.5, 1, 1, 2]);
  const entry = pick([20, 40, 50, 80, 100, 120, 150, 250]);
  const distance = pick([0.5, 1, 2, 2.5, 4, 5]);
  const long = random() < 0.6;
  const stop = +(long ? entry - distance : entry + distance).toFixed(2);
  const budget = capital * riskPct / 100;
  const answer = Math.floor(budget / distance + 1e-9);
  return { capital, riskPct, entry, stop, long, budget, distance, answer };
}

/** Интервальное повторение (коробки Лейтнера): 1 → 0 дн., 2 → 1, 3 → 3, 4 → 7, 5 → 14. */
const BOX_DAYS = [0, 0, 1, 3, 7, 14];
export function addDays(day, n) {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function reviewCard(card, correct, today) {
  const box = correct ? Math.min(5, (card?.box || 1) + 1) : 1;
  return { box, due: addDays(today, BOX_DAYS[box]) };
}
export const isDue = (card, today) => !card || card.due <= today;

/** Сколько дней подряд (включая сегодня или вчера) были занятия. */
export function streakDays(days, today) {
  const set = new Set(days);
  let cursor = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(cursor)) { n++; cursor = addDays(cursor, -1); }
  return n;
}

export const LEVELS = ['Новичок', 'Ученик', 'Наблюдатель', 'Практик', 'Аналитик', 'Риск-менеджер', 'Системный трейдер', 'Наставник'];
export function levelFor(xp) {
  const step = 400;
  const index = Math.min(LEVELS.length - 1, Math.floor(xp / step));
  return { index, name: LEVELS[index], from: index * step, to: (index + 1) * step, progress: index === LEVELS.length - 1 ? 1 : (xp - index * step) / step };
}
