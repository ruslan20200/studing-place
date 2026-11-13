import React, { useEffect, useMemo, useState } from 'react';
import {
  ChartCandlestick, Calculator, Layers, Dices, GraduationCap, ClipboardCheck, ArrowRight, ArrowLeft,
  ArrowUpRight, Check, RefreshCw, Eye, Shuffle, Printer, Download, Trophy, Flame, CircleCheck, CircleX, Lightbulb,
} from 'lucide-react';
import { Chart, money } from './components';
import { lessons, glossary } from './data/curriculum';
import {
  REGIMES, makeRegime, rng, sizingProblem, simulateSeries, reviewCard, isDue,
} from './domain.mjs';
import { shuffle, todayKey, plural } from './store';

const go = path => { window.location.hash = path; };

export const drills = [
  { id: 'chart', icon: ChartCandlestick, title: 'Чтение графика', text: 'Определи структуру: тренд, диапазон или пробой. Мгновенная обратная связь.', color: 'var(--c1)' },
  { id: 'sizing', icon: Calculator, title: 'Расчёт позиции', text: 'Капитал, риск и стоп → количество. Навык, который защищает счёт.', color: 'var(--c2)' },
  { id: 'cards', icon: Layers, title: 'Карточки терминов', text: 'Интервальное повторение 48 терминов: забытые возвращаются чаще.', color: 'var(--c3)' },
  { id: 'series', icon: Dices, title: 'Серия сделок', text: 'Монте-Карло: как % риска и ожидание влияют на просадки и итог.', color: 'var(--c4)' },
  { id: 'exam', icon: GraduationCap, title: 'Экзамен', text: '10 случайных вопросов из всех модулей. Ошибки ведут к нужным урокам.', color: 'var(--c5)' },
  { id: 'plan', icon: ClipboardCheck, title: 'Торговый план', text: 'Собери свои правила и получи чек-лист перед каждой сделкой.', color: 'var(--c6)' },
];

export default function Practice({ tab, stats, setStats, cards, setCards, plan, setPlan, track, saveEntry, openLesson }) {
  const current = drills.find(d => d.id === tab);
  const bump = (key, patch) => setStats(s => ({ ...s, [key]: { ...s[key], ...patch(s[key] || {}) } }));
  const props = { stats, bump, track };
  return (
    <div className="page practice-page">
      {!current ? (
        <>
          <div className="page-head">
            <div className="eyebrow">ТРЕНИРОВКА НАВЫКОВ</div>
            <h1>Практикум</h1>
            <p>Короткие упражнения по 3–5 минут. Каждое тренирует один конкретный навык трейдера и сохраняет твой прогресс.</p>
          </div>
          <div className="drill-grid stagger">
            {drills.map((d, i) => {
              const Icon = d.icon;
              return (
                <button key={d.id} className="drill-card" style={{ '--accent-c': d.color, '--i': i }} onClick={() => go('/practice/' + d.id)}>
                  <span className="drill-icon"><Icon size={24} /></span>
                  <h3>{d.title}</h3>
                  <p>{d.text}</p>
                  <span className="drill-meta">{drillMeta(d.id, stats, cards, plan)}<ArrowUpRight size={17} /></span>
                </button>
              );
            })}
          </div>
          <div className="soft-banner">
            <Lightbulb size={20} />
            <p><b>Как заниматься:</b> один урок из маршрута → одно упражнение здесь → одна запись в журнале. Регулярность важнее длительности: серия дней отображается на главной.</p>
          </div>
        </>
      ) : (
        <>
          <button className="back-link" onClick={() => go('/practice')}><ArrowLeft size={16} /> Практикум</button>
          <div className="drill-tabs" role="tablist">
            {drills.map(d => {
              const Icon = d.icon;
              return (
                <button key={d.id} role="tab" aria-selected={d.id === tab} className={d.id === tab ? 'active' : ''} onClick={() => go('/practice/' + d.id)}>
                  <Icon size={16} /><span>{d.title}</span>
                </button>
              );
            })}
          </div>
          <div className="drill-body" key={tab}>
            {tab === 'chart' && <ChartDrill {...props} />}
            {tab === 'sizing' && <SizingDrill {...props} />}
            {tab === 'cards' && <Flashcards {...props} cards={cards} setCards={setCards} />}
            {tab === 'series' && <SeriesLab {...props} />}
            {tab === 'exam' && <Exam {...props} openLesson={openLesson} saveEntry={saveEntry} />}
            {tab === 'plan' && <PlanBuilder plan={plan} setPlan={setPlan} track={track} />}
          </div>
        </>
      )}
    </div>
  );
}

function drillMeta(id, stats, cards, plan) {
  if (id === 'chart' || id === 'sizing') {
    const s = stats[id];
    return s.total ? `${s.correct} из ${s.total} верно · рекорд серии ${s.best}` : 'Ещё не начато';
  }
  if (id === 'cards') {
    const due = glossary.filter(g => isDue(cards[g.term], todayKey())).length;
    const learned = Object.values(cards).filter(c => c.box >= 4).length;
    return `${due} к повторению · ${learned} выучено`;
  }
  if (id === 'series') return stats.series.runs ? `Запусков: ${stats.series.runs}` : 'Попробуй разные % риска';
  if (id === 'exam') return stats.exam.attempts ? `Лучший результат ${stats.exam.best}/10` : 'Проверь себя';
  return `Заполнено ${planCompleteness(plan)}%`;
}

function ScoreBar({ session }) {
  return (
    <div className="score-bar">
      <span><CircleCheck size={16} /> {session.correct} верно</span>
      <span><CircleX size={16} /> {session.total - session.correct} {plural(session.total - session.correct, 'ошибка', 'ошибки', 'ошибок')}</span>
      <span className={session.streak >= 3 ? 'hot' : ''}><Flame size={16} /> серия {session.streak}</span>
    </div>
  );
}

function useSession(key, bump, track) {
  const [session, setSession] = useState({ correct: 0, total: 0, streak: 0 });
  const record = ok => {
    const streak = ok ? session.streak + 1 : 0;
    setSession(s => ({ correct: s.correct + (ok ? 1 : 0), total: s.total + 1, streak }));
    bump(key, s => ({ correct: (s.correct || 0) + (ok ? 1 : 0), total: (s.total || 0) + 1, best: Math.max(s.best || 0, streak) }));
    track();
  };
  return [session, record];
}

/* ───────────── 1. Чтение графика ───────────── */

const regimeHints = {
  up: 'Максимумы и минимумы последовательно повышаются. Откаты не обновляют предыдущий минимум — это и есть восходящая структура.',
  down: 'Максимумы и минимумы последовательно понижаются. Отскоки не пробивают предыдущий максимум.',
  range: 'Цена возвращается к середине, максимумы и минимумы примерно на одних уровнях. Направленного смещения нет — тренд-стратегии здесь страдают.',
  breakout: 'Долгое колебание в границах, затем закрытия выше диапазона и продолжение. Пробой — гипотеза: подтверждением служит удержание цены за границей.',
};

function ChartDrill({ bump, track }) {
  const [round, setRound] = useState(() => Math.floor(Math.random() * 1000));
  const [answer, setAnswer] = useState(null);
  const [session, record] = useSession('chart', bump, track);
  const kinds = Object.keys(REGIMES);
  const kind = kinds[Math.floor(rng(round * 13 + 5)() * kinds.length)];
  const candles = useMemo(() => makeRegime(kind, round), [kind, round]);
  const choose = k => { if (answer) return; setAnswer(k); record(k === kind); };
  const next = () => { setAnswer(null); setRound(r => r + 1); };
  useEffect(() => {
    const fn = e => {
      if (e.target.closest('input,textarea,select')) return;
      if (!answer && ['1', '2', '3', '4'].includes(e.key)) choose(kinds[+e.key - 1]);
      if (answer && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); next(); }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  });
  return (
    <div className="drill-layout">
      <section className="panel">
        <div className="drill-head">
          <div><span className="eyebrow">ЧТЕНИЕ ГРАФИКА · ГРАФИК {round % 1000}</span><h2>Какая здесь структура?</h2></div>
          <ScoreBar session={session} />
        </div>
        <div className="chart-frame" key={round}><Chart candles={candles} visible={candles.length} stagger label="Тренировочный график: определи структуру" /></div>
        <div className="answer-grid">
          {kinds.map((k, i) => (
            <button key={k} onClick={() => choose(k)} disabled={!!answer && k !== answer && k !== kind}
              className={'answer ' + (answer && k === kind ? 'correct' : '') + (answer === k && k !== kind ? ' wrong' : '')}>
              <kbd>{i + 1}</kbd>{REGIMES[k]}
            </button>
          ))}
        </div>
        {answer && (
          <div className={'quiz-feedback pop ' + (answer === kind ? 'success' : 'retry')}>
            <b>{answer === kind ? 'Верно!' : `Это ${REGIMES[kind].toLowerCase()}.`}</b>
            <p>{regimeHints[kind]}</p>
            <button className="primary" onClick={next} autoFocus>Следующий график <ArrowRight size={16} /></button>
          </div>
        )}
      </section>
      <aside className="drill-aside">
        <div className="aside-card">
          <span className="eyebrow">НА ЧТО СМОТРЕТЬ</span>
          <ol className="check-list">
            <li>Сравни <b>последние максимумы</b> с предыдущими.</li>
            <li>Сравни <b>последние минимумы</b> с предыдущими.</li>
            <li>Где цена сейчас относительно <b>начала</b> графика?</li>
            <li>Были ли долгие <b>колебания в границах</b>?</li>
          </ol>
          <p className="footnote">Клавиши 1–4 — ответ, Enter — следующий график. Данные искусственные.</p>
        </div>
        <button className="secondary full" onClick={() => go('/lesson/structure')}>Урок «Тренд и диапазон» <ArrowUpRight size={15} /></button>
      </aside>
    </div>
  );
}

/* ───────────── 2. Расчёт позиции ───────────── */

function SizingDrill({ bump, track }) {
  const [round, setRound] = useState(() => 1 + Math.floor(Math.random() * 500));
  const [value, setValue] = useState('');
  const [result, setResult] = useState(null);
  const [session, record] = useSession('sizing', bump, track);
  const p = useMemo(() => sizingProblem(round), [round]);
  const check = e => {
    e.preventDefault();
    if (result || value === '') return;
    const ok = Number(value.replace(',', '.')) === p.answer;
    setResult(ok ? 'ok' : 'bad');
    record(ok);
  };
  const next = () => { setRound(r => r + 1); setValue(''); setResult(null); };
  return (
    <div className="drill-layout">
      <section className="panel">
        <div className="drill-head">
          <div><span className="eyebrow">РАСЧЁТ ПОЗИЦИИ · ЗАДАЧА {round}</span><h2>Сколько единиц можно взять?</h2></div>
          <ScoreBar session={session} />
        </div>
        <div className="problem-grid">
          <div><small>Капитал</small><b>{money(p.capital)} $</b></div>
          <div><small>Риск на сделку</small><b>{money(p.riskPct)}%</b></div>
          <div><small>Направление</small><b className={p.long ? 'positive' : 'negative'}>{p.long ? 'Покупка' : 'Продажа'}</b></div>
          <div><small>Вход</small><b>{money(p.entry)}</b></div>
          <div><small>Стоп</small><b>{money(p.stop)}</b></div>
          <div><small>Комиссии</small><b>не учитываем</b></div>
        </div>
        <form className="answer-form" onSubmit={check}>
          <label>Количество единиц (округли вниз до целого)
            <input inputMode="decimal" autoFocus value={value} disabled={!!result} onChange={e => setValue(e.target.value)} placeholder="Например: 25" />
          </label>
          {!result && <button className="primary" disabled={value === ''}>Проверить</button>}
        </form>
        {result && (
          <div className={'quiz-feedback pop ' + (result === 'ok' ? 'success' : 'retry')}>
            <b>{result === 'ok' ? 'Точно!' : `Правильный ответ: ${p.answer}`}</b>
            <div className="solution">
              <div><span>1</span>Бюджет риска = {money(p.capital)} × {money(p.riskPct)}% = <b>{money(p.budget)} $</b></div>
              <div><span>2</span>Риск на единицу = |{money(p.entry)} − {money(p.stop)}| = <b>{money(p.distance)} $</b></div>
              <div><span>3</span>Количество = {money(p.budget)} ÷ {money(p.distance)} = {money(p.budget / p.distance)} → <b>{p.answer}</b></div>
            </div>
            <p>Позиция ≈ {money(p.answer * p.entry)} $ — это {money(p.answer * p.entry / p.capital * 100, 0)}% капитала. Размер позиции и размер риска — разные величины.</p>
            <button className="primary" onClick={next} autoFocus>Следующая задача <ArrowRight size={16} /></button>
          </div>
        )}
      </section>
      <aside className="drill-aside">
        <div className="aside-card formula-card">
          <span className="eyebrow">ФОРМУЛА</span>
          <div className="formula">Кол-во = <span>Капитал × Риск%</span><i /> <span>|Вход − Стоп|</span></div>
          <p>Сначала решаешь, сколько готов потерять, если идея не сработала. Количество — следствие, а не желание.</p>
        </div>
        <button className="secondary full" onClick={() => go('/lesson/sizing')}>Урок «Размер позиции» <ArrowUpRight size={15} /></button>
      </aside>
    </div>
  );
}

/* ───────────── 3. Карточки терминов ───────────── */

function Flashcards({ cards, setCards, bump, track }) {
  const today = todayKey();
  const [direction, setDirection] = useState('en');
  const [extra, setExtra] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [queue, setQueue] = useState(() => shuffle(glossary.filter(g => isDue(cards[g.term], today)).map(g => g.term)));
  const [done, setDone] = useState(0);
  const term = queue[0];
  const card = glossary.find(g => g.term === term);
  const boxes = [1, 2, 3, 4, 5].map(b => glossary.filter(g => (cards[g.term]?.box || 1) === b).length);
  const answer = ok => {
    if (!extra) setCards(c => ({ ...c, [term]: reviewCard(c[term], ok, today) }));
    bump('cards', s => ({ reviewed: (s.reviewed || 0) + 1 }));
    track();
    setFlipped(false);
    setDone(n => n + 1);
    setQueue(q => (ok ? q.slice(1) : [...q.slice(1), q[0]]));
  };
  useEffect(() => {
    const fn = e => {
      if (!card || e.target.closest('input,textarea,select')) return;
      if (e.key === ' ') { e.preventDefault(); setFlipped(f => !f); }
      if (flipped && e.key === '1') answer(false);
      if (flipped && e.key === '2') answer(true);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  });
  const front = direction === 'en' ? card?.term : card?.ru;
  const back = direction === 'en' ? card?.ru : card?.term;
  return (
    <div className="drill-layout">
      <section className="panel flash-panel">
        <div className="drill-head">
          <div><span className="eyebrow">КАРТОЧКИ · ИНТЕРВАЛЬНОЕ ПОВТОРЕНИЕ</span><h2>{card ? 'Вспомни значение' : 'На сегодня всё повторено'}</h2></div>
          <div className="segmented">
            <button className={direction === 'en' ? 'selected' : ''} onClick={() => setDirection('en')}>EN → RU</button>
            <button className={direction === 'ru' ? 'selected' : ''} onClick={() => setDirection('ru')}>RU → EN</button>
          </div>
        </div>
        {card ? (
          <>
            <button className={'flashcard ' + (flipped ? 'flipped' : '')} onClick={() => setFlipped(f => !f)} aria-label="Перевернуть карточку">
              <span className="flash-face front"><small>{direction === 'en' ? 'Английский термин' : 'Русский смысл'}</small><strong>{front}</strong><em>Нажми, чтобы перевернуть</em></span>
              <span className="flash-face back"><small>{direction === 'en' ? 'Русский смысл' : 'Английский термин'}</small><strong>{back}</strong><p>{card.body}</p></span>
            </button>
            <div className="flash-actions">
              <button className="secondary" disabled={!flipped} onClick={() => answer(false)}><kbd>1</kbd> Не помню</button>
              <button className="primary" disabled={!flipped} onClick={() => answer(true)}><kbd>2</kbd> Помню</button>
            </div>
            <p className="footnote center">Осталось в очереди: {queue.length} · повторено за сессию: {done}. Пробел — перевернуть.</p>
          </>
        ) : (
          <div className="empty-state">
            <Trophy size={34} />
            <h3>Отлично! Следующее повторение — завтра</h3>
            <p>Карточки, которые ты помнишь, будут появляться всё реже: через 1, 3, 7 и 14 дней.</p>
            <button className="secondary" onClick={() => { setExtra(true); setQueue(shuffle(glossary.map(g => g.term))); }}><Shuffle size={16} /> Повторить все без влияния на график</button>
          </div>
        )}
      </section>
      <aside className="drill-aside">
        <div className="aside-card">
          <span className="eyebrow">КОРОБКИ ЛЕЙТНЕРА</span>
          <div className="box-bars">
            {boxes.map((n, i) => (
              <div key={i}><i style={{ height: Math.max(6, n / glossary.length * 120) + 'px' }} /><b>{n}</b><small>{['сегодня', '1 дн', '3 дн', '7 дн', '14 дн'][i]}</small></div>
            ))}
          </div>
          <p className="footnote">Верный ответ переносит карточку в следующую коробку, ошибка — обратно в первую.</p>
        </div>
        <button className="secondary full" onClick={() => go('/glossary')}>Весь словарь <ArrowUpRight size={15} /></button>
      </aside>
    </div>
  );
}

/* ───────────── 4. Серия сделок (Монте-Карло) ───────────── */

function SeriesLab({ bump, track }) {
  const [p, setP] = useState({ winRate: 45, rr: 2, riskPct: 1, trades: 100, cost: 0.1 });
  const [seed, setSeed] = useState(7);
  const sim = useMemo(() => simulateSeries({ ...p, winRate: p.winRate / 100, seed, paths: 60 }), [p, seed]);
  const W = 760, H = 300, start = 10000;
  const maxima = sim.paths.map(x => Math.max(...x.curve)).sort((a, b) => a - b);
  const top = Math.max(start * 1.15, maxima[Math.floor(maxima.length * 0.92)] || start);
  const bottom = Math.min(start * 0.6, ...sim.paths.map(x => Math.min(...x.curve)));
  const yy = v => 14 + (top - Math.min(top, v)) / (top - bottom) * (H - 34);
  const xx = i => 8 + i / p.trades * (W - 60);
  const sorted = [...sim.paths].sort((a, b) => a.final - b.final);
  const median = sorted[Math.floor(sorted.length / 2)];
  const path = curve => curve.map((v, i) => (i ? 'L' : 'M') + xx(i).toFixed(1) + ' ' + yy(v).toFixed(1)).join(' ');
  const set = (k, v) => setP(o => ({ ...o, [k]: v }));
  const rerun = () => { setSeed(s => s + 1); bump('series', s => ({ runs: (s.runs || 0) + 1 })); track(); };
  const sliders = [
    ['winRate', 'Доля выигрышей', 20, 80, 1, v => v + '%'],
    ['rr', 'Выигрыш к риску (R)', 0.5, 4, 0.1, v => money(v, 1) + 'R'],
    ['riskPct', 'Риск на сделку', 0.25, 10, 0.25, v => money(v) + '%'],
    ['trades', 'Сделок в серии', 30, 300, 10, v => v],
    ['cost', 'Расходы на сделку', 0, 0.5, 0.05, v => money(v) + 'R'],
  ];
  const insight = sim.expectancyR <= 0
    ? 'Ожидание отрицательное: никакой размер позиции и «управление капиталом» не превратят такую серию в прибыльную. Увеличение риска только ускорит потери.'
    : p.riskPct >= 5
      ? `Ожидание положительное, но при риске ${money(p.riskPct)}% обычная серия из ${sim.worstStreak} убытков подряд даёт просадку до ${money(sim.worstDD * 100, 0)}%. Психологически это почти невозможно выдержать.`
      : p.riskPct <= 2
        ? 'Положительное ожидание и умеренный риск: просадки неизбежны, но остаются переживаемыми. Это и есть цель управления риском.'
        : 'Попробуй сравнить с риском 1%: итоговая медиана растёт медленнее, но просадки становятся заметно мельче.';
  return (
    <div className="drill-layout wide">
      <section className="panel">
        <div className="drill-head">
          <div><span className="eyebrow">СЕРИЯ СДЕЛОК · 60 ВАРИАНТОВ БУДУЩЕГО</span><h2>Одна система — разные судьбы счёта</h2></div>
          <button className="secondary" onClick={rerun}><RefreshCw size={16} /> Новая выборка</button>
        </div>
        <svg className="series-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Кривые капитала для 60 вариантов серии сделок">
          <line x1="8" x2={W - 52} y1={yy(start)} y2={yy(start)} className="start-line" />
          <text x={W - 48} y={yy(start) + 4} className="axis-text">10 000</text>
          <text x={W - 48} y={yy(top) + 8} className="axis-text">{money(top / 1000, 0)}k</text>
          <text x={W - 48} y={yy(bottom)} className="axis-text">{money(bottom / 1000, 0)}k</text>
          <g key={seed + JSON.stringify(p)} className="series-paths">
            {sim.paths.map((x, i) => <path key={i} pathLength="1" d={path(x.curve)} className={x.final >= start ? 'path-up' : 'path-down'} />)}
            <path pathLength="1" d={path(median.curve)} className="path-median" />
          </g>
        </svg>
        <div className="legend"><span><i className="lg-up" /> закончили в плюсе</span><span><i className="lg-down" /> закончили в минусе</span><span><i className="lg-med" /> медианный вариант</span></div>
        <div className="metric-grid">
          <Metric label="Ожидание сделки" value={(sim.expectancyR > 0 ? '+' : '') + money(sim.expectancyR) + 'R'} tone={sim.expectancyR > 0 ? 'positive' : 'negative'} />
          <Metric label="Медианный итог" value={money(sim.median, 0) + ' $'} tone={sim.median >= start ? 'positive' : 'negative'} />
          <Metric label="10% худших ниже" value={money(sim.p10, 0) + ' $'} />
          <Metric label="Вариантов в минусе" value={money(sim.lossShare * 100, 0) + '%'} />
          <Metric label="Типичная просадка" value={money(sim.medianDD * 100, 0) + '%'} />
          <Metric label="Худшая просадка" value={money(sim.worstDD * 100, 0) + '%'} tone={sim.worstDD > 0.3 ? 'negative' : ''} />
          <Metric label="Убытков подряд (макс.)" value={sim.worstStreak} />
          <Metric label="Просадка ≥ 50%" value={money(sim.halfShare * 100, 0) + '%'} tone={sim.halfShare > 0 ? 'negative' : ''} />
        </div>
        <div className="insight"><Lightbulb size={19} /><p>{insight}</p></div>
      </section>
      <aside className="panel drill-aside-panel">
        <span className="eyebrow">ПАРАМЕТРЫ СИСТЕМЫ</span>
        {sliders.map(([k, t, min, max, step, f]) => (
          <label key={k}>{t} <b>{f(p[k])}</b>
            <input type="range" min={min} max={max} step={step} value={p[k]} onChange={e => set(k, +e.target.value)} />
          </label>
        ))}
        <p className="footnote">Риск считается от текущего капитала. Сделки независимы — на реальном рынке серии убытков бывают длиннее из-за смены режима.</p>
      </aside>
    </div>
  );
}

const Metric = ({ label, value, tone = '' }) => <div className="metric"><small>{label}</small><b className={tone}>{value}</b></div>;

/* ───────────── 5. Экзамен ───────────── */

function Exam({ stats, bump, track, openLesson, saveEntry }) {
  const [questions, setQuestions] = useState(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [saved, setSaved] = useState(false);
  const start = () => {
    setQuestions(shuffle(lessons).slice(0, 10).map(l => {
      const quiz = shuffle(l.quizzes)[0];
      const order = shuffle(quiz.options.map((o, i) => i));
      return { lesson: l, quiz, options: order.map(i => quiz.options[i]), answer: order.indexOf(quiz.answer) };
    }));
    setIndex(0); setPicked(null); setAnswers([]); setSaved(false);
  };
  const q = questions?.[index];
  const finished = questions && answers.length === questions.length && picked === null;
  const score = answers.filter(Boolean).length;
  const pick = i => {
    if (picked !== null) return;
    setPicked(i);
    setAnswers(a => [...a, i === q.answer]);
  };
  const next = () => {
    if (index + 1 >= questions.length) {
      const final = answers.filter(Boolean).length;
      bump('exam', s => ({ attempts: (s.attempts || 0) + 1, best: Math.max(s.best || 0, final), last: final }));
      track();
    } else setIndex(index + 1);
    setPicked(null);
  };
  if (!questions) {
    return (
      <section className="panel exam-start">
        <GraduationCap size={40} />
        <h2>Экзамен по всему маршруту</h2>
        <p>10 случайных вопросов из 30 уроков, варианты перемешаны. После каждого ответа — объяснение. В конце — список уроков для повторения.</p>
        {stats.exam.attempts > 0 && <div className="exam-best"><Trophy size={18} /> Лучший результат: <b>{stats.exam.best}/10</b> · попыток: {stats.exam.attempts}</div>}
        <button className="primary" onClick={start}>Начать экзамен <ArrowRight size={16} /></button>
      </section>
    );
  }
  if (finished) {
    const mistakes = questions.filter((_, i) => !answers[i]);
    const grade = score >= 9 ? 'Отлично — материал усвоен.' : score >= 7 ? 'Хорошо. Повтори несколько уроков ниже.' : score >= 5 ? 'Базу ты понимаешь, но пробелы заметны.' : 'Стоит пройти маршрут ещё раз — это нормально.';
    return (
      <section className="panel exam-result pop">
        <div className="score-ring" style={{ '--p': score * 10 }}><b>{score}</b><small>из 10</small></div>
        <h2>{grade}</h2>
        {mistakes.length > 0 && (
          <div className="mistakes">
            <span className="eyebrow">ПОВТОРИТЬ</span>
            {mistakes.map(m => (
              <button key={m.lesson.id} className="source-link" onClick={() => openLesson(m.lesson.id)}>
                <CircleX size={16} /><div><b>{m.lesson.title}</b><small>{m.lesson.moduleTitle}</small></div><ArrowUpRight size={14} />
              </button>
            ))}
          </div>
        )}
        <div className="button-row center">
          <button className="primary" onClick={start}><RefreshCw size={16} /> Пройти ещё раз</button>
          <button className="secondary" disabled={saved} onClick={() => { saveEntry({ type: 'Экзамен', title: `Экзамен: ${score}/10`, note: mistakes.length ? 'Повторить: ' + mistakes.map(m => m.lesson.title).join('; ') : 'Все ответы верны.', result: score + '/10', process: 'Для разбора', emotion: 'Спокойствие' }); setSaved(true); }}>{saved ? 'Сохранено' : 'Записать в журнал'}</button>
        </div>
      </section>
    );
  }
  return (
    <section className="panel quiz-card exam-card">
      <div className="exam-progress"><span>Вопрос {index + 1} из {questions.length}</span><div className="progress-track"><i style={{ width: (index + (picked !== null ? 1 : 0)) / questions.length * 100 + '%' }} /></div><small>{q.lesson.moduleTitle}</small></div>
      <h2 key={index} className="pop">{q.quiz.question}</h2>
      <div className="quiz-options">
        {q.options.map((o, i) => (
          <button key={o} onClick={() => pick(i)} disabled={picked !== null && i !== picked && i !== q.answer}
            className={(picked === i ? 'chosen ' : '') + (picked !== null && i === q.answer ? 'correct ' : '') + (picked === i && i !== q.answer ? 'wrong' : '')}>
            <span>{String.fromCharCode(65 + i)}</span>{o}{picked !== null && i === q.answer && <Check size={18} />}
          </button>
        ))}
      </div>
      {picked !== null && (
        <div className={'quiz-feedback pop ' + (picked === q.answer ? 'success' : 'retry')}>
          <b>{picked === q.answer ? 'Верно.' : 'Не совсем.'}</b>
          <p>{q.quiz.feedback}</p>
          <button className="primary" onClick={next} autoFocus>{index + 1 >= questions.length ? 'Посмотреть результат' : 'Следующий вопрос'} <ArrowRight size={16} /></button>
        </div>
      )}
    </section>
  );
}

/* ───────────── 6. Торговый план ───────────── */

export const emptyPlan = {
  market: '', timeframe: '', hours: '', context: '', entry: '', stop: '', target: '',
  risk: 0.5, dailyLimit: 3, maxTrades: 3,
  noTrade: 'Перед важными новостями\nПосле двух убытков подряд\nЕсли не выспался или раздражён\nЕсли не могу назвать условие отмены',
};
const planFields = [
  ['market', 'Рынок и инструменты', 'Например: акции крупных компаний, BTC/USDT спот'],
  ['timeframe', 'Таймфреймы', 'Например: контекст H1, вход M15'],
  ['hours', 'Когда я торгую', 'Например: 17:00–20:00 по Алматы, только будни'],
  ['context', 'Контекст сетапа', 'Какая структура рынка должна быть, чтобы я вообще искал вход?', true],
  ['entry', 'Условие входа', 'Что конкретно должно произойти? Наблюдаемое событие, а не ощущение.', true],
  ['stop', 'Где идея отменяется (стоп)', 'Какое движение цены доказывает, что я ошибся?', true],
  ['target', 'Выход и цель', 'Где фиксирую результат? Двигаю ли стоп и по какому правилу?', true],
];
export const planCompleteness = plan => {
  const filled = planFields.filter(([k]) => String(plan?.[k] || '').trim()).length;
  return Math.round(filled / planFields.length * 100);
};

function PlanBuilder({ plan, setPlan, track }) {
  const [checks, setChecks] = useState({});
  const set = (k, v) => setPlan(p => ({ ...p, [k]: v }));
  const pct = planCompleteness(plan);
  const checklist = [
    ['Контекст соответствует плану', plan.context],
    ['Есть условие входа, и оно выполнено', plan.entry],
    ['Стоп определён до входа', plan.stop],
    [`Риск не больше ${money(plan.risk)}%, количество рассчитано`, null],
    [`Сегодня убыток меньше ${plan.dailyLimit}R и сделок меньше ${plan.maxTrades}`, null],
    ['Ни одно условие из «Когда я не торгую» не выполняется', null],
    ['Причина входа записана', null],
  ];
  const ready = checklist.every((_, i) => checks[i]);
  const text = () => [
    'МОЙ ТОРГОВЫЙ ПЛАН', `Составлен: ${new Date().toLocaleDateString('ru-RU')}`, '',
    ...planFields.map(([k, t]) => `${t}:\n${plan[k] || '—'}\n`),
    `Риск на сделку: ${plan.risk}%`, `Дневной лимит убытка: ${plan.dailyLimit}R`, `Максимум сделок в день: ${plan.maxTrades}`, '',
    'Когда я НЕ торгую:', plan.noTrade, '', 'ЧЕК-ЛИСТ ПЕРЕД ВХОДОМ:', ...checklist.map(([t]) => '☐ ' + t),
  ].join('\n');
  const download = () => {
    const url = URL.createObjectURL(new Blob([text()], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'Мой-торговый-план.txt'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    track();
  };
  return (
    <div className="drill-layout wide plan-layout">
      <section className="panel">
        <div className="drill-head">
          <div><span className="eyebrow">ТОРГОВЫЙ ПЛАН · СОХРАНЯЕТСЯ АВТОМАТИЧЕСКИ</span><h2>Правила, которые ты пишешь заранее</h2></div>
          <div className="plan-meter"><div className="progress-track"><i style={{ width: pct + '%' }} /></div><small>Заполнено {pct}%</small></div>
        </div>
        <div className="plan-form">
          {planFields.map(([k, t, ph, long]) => (
            <label key={k} className={long ? 'span-2' : ''}>{t}
              {long ? <textarea rows="3" value={plan[k]} placeholder={ph} onChange={e => set(k, e.target.value)} onBlur={track} />
                : <input value={plan[k]} placeholder={ph} onChange={e => set(k, e.target.value)} onBlur={track} />}
            </label>
          ))}
          <label>Риск на сделку, % <b className={plan.risk > 2 ? 'negative' : ''}>{money(plan.risk)}%</b><input type="range" min="0.25" max="5" step="0.25" value={plan.risk} onChange={e => set('risk', +e.target.value)} /></label>
          <label>Дневной лимит убытка <b>{plan.dailyLimit}R</b><input type="range" min="1" max="8" step="1" value={plan.dailyLimit} onChange={e => set('dailyLimit', +e.target.value)} /></label>
          <label>Сделок в день максимум <b>{plan.maxTrades}</b><input type="range" min="1" max="10" step="1" value={plan.maxTrades} onChange={e => set('maxTrades', +e.target.value)} /></label>
          <label className="span-2">Когда я НЕ торгую<textarea rows="4" value={plan.noTrade} onChange={e => set('noTrade', e.target.value)} /></label>
        </div>
        {plan.risk > 2 && <p className="quality-warning">Риск больше 2% на сделку: серия из 10 убытков (обычное дело) снимет около {money((1 - Math.pow(1 - plan.risk / 100, 10)) * 100, 0)}% счёта.</p>}
        <div className="button-row">
          <button className="secondary" onClick={download}><Download size={16} /> Скачать план</button>
          <button className="secondary" onClick={() => window.print()}><Printer size={16} /> Распечатать</button>
        </div>
      </section>
      <aside className="panel checklist-panel">
        <span className="eyebrow">ЧЕК-ЛИСТ ПЕРЕД КАЖДЫМ ВХОДОМ</span>
        <h3>Отметь всё — или пропусти сделку</h3>
        <div className="checklist">
          {checklist.map(([t, detail], i) => (
            <label key={i} className={'check-row ' + (checks[i] ? 'checked' : '')}>
              <input type="checkbox" checked={!!checks[i]} onChange={() => setChecks(c => ({ ...c, [i]: !c[i] }))} />
              <span className="check-box"><Check size={14} /></span>
              <span>{t}{detail && <small>{detail}</small>}</span>
            </label>
          ))}
        </div>
        <div className={'check-verdict ' + (ready ? 'ok' : '')}>
          {ready ? <><CircleCheck size={18} /> Все условия выполнены — действуй по плану.</> : <><Eye size={18} /> Пока не все пункты отмечены. Пропуск сделки — тоже решение.</>}
        </div>
        <button className="text-button" onClick={() => setChecks({})}><RefreshCw size={14} /> Сбросить отметки</button>
      </aside>
    </div>
  );
}
