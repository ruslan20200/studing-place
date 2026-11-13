import React,{useState} from 'react';
import {ArrowRight,MoveUpRight,RotateCcw,Check,Info,ArrowDown,BookOpen} from 'lucide-react';
import {fillBuy,positionSize,expectancy,recovery,makeCandles} from './domain.mjs';
export const money=(n,d=2)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:d}).format(n);

export function Chart({candles=makeCandles(),visible=44,trade,compact=false,annotated=false,stagger=false,label='Учебный свечной график с искусственными ценами'}){
 const data=candles.slice(0,visible),W=850,H=compact?235:340,pad=42;
 const prices=data.flatMap(c=>[c.h,c.l]);if(trade)prices.push(trade.stop,trade.target);
 const min=Math.min(...prices)-1,max=Math.max(...prices)+1;
 const y=v=>22+(max-v)/(max-min)*(H-65),step=(W-pad*2)/Math.max(visible,36);
 const lastX=pad+(data.length-1)*step;
 return <svg className="price-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
  {[0,1,2,3,4].map(i=>{const price=min+(max-min)*i/4;return <g key={i}><line x1="20" x2={W-36} y1={y(price)} y2={y(price)} stroke="currentColor" opacity=".1"/><text x={W-30} y={y(price)+4} fill="currentColor" opacity=".6" fontSize="11">{price.toFixed(1)}</text></g>;})}
  {trade&&<g className="trade-zones"><rect className="zone-target" x={pad} width={Math.max(0,W-45-pad)} y={Math.min(y(trade.entry),y(trade.target))} height={Math.abs(y(trade.entry)-y(trade.target))}/><rect className="zone-stop" x={pad} width={Math.max(0,W-45-pad)} y={Math.min(y(trade.entry),y(trade.stop))} height={Math.abs(y(trade.entry)-y(trade.stop))}/></g>}
  {data.map((c,i)=>{const x=pad+i*step;const up=c.c>=c.o;return <g key={i} className={'candle '+(up?'up':'down')} style={stagger?{animationDelay:i*16+'ms'}:undefined}><line x1={x} x2={x} y1={y(c.h)} y2={y(c.l)} stroke="currentColor" strokeWidth="1.5"/><rect x={x-step*.3} y={y(Math.max(c.o,c.c))} width={step*.6} height={Math.max(2,Math.abs(y(c.o)-y(c.c)))} rx="1.4" fill="currentColor"/><rect x={x-step*.3} y={H-25-c.v/7} width={step*.6} height={c.v/7} fill="currentColor" opacity=".2"/></g>;})}
  {data.length>0&&<g className="last-price"><line x1={lastX} x2={W-36} y1={y(data.at(-1).c)} y2={y(data.at(-1).c)} stroke="currentColor" strokeDasharray="2 4" opacity=".55"/><circle cx={lastX} cy={y(data.at(-1).c)} r="3.5" fill="currentColor"/></g>}
  {trade&&[[trade.entry,'Вход','line-entry'],[trade.stop,'Стоп','line-stop'],[trade.target,'Цель','line-target']].map(([v,t,c])=><g key={t} className={c}><line x1="20" x2={W-45} y1={y(v)} y2={y(v)} stroke="currentColor" strokeDasharray="6 5" strokeWidth="1.4"/><text x="26" y={y(v)-6} fill="currentColor" fontSize="12" fontWeight="600">{t} {v.toFixed(2)}</text></g>)}
  {annotated&&<g className="annotation-line"><path d={`M 90 ${y(data[5]?.h||100)-30} L 330 ${y(data[18]?.h||103)-30}`} stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 5"/><text x="92" y="26" fill="currentColor" fontSize="12">Наблюдаем структуру, затем формулируем сценарий</text></g>}
  <text x="22" y={H-2} fill="currentColor" opacity=".5" fontSize="11">{data.length?'№1':''}</text><text x={W/2} y={H-2} fill="currentColor" opacity=".5" fontSize="11">{data.length?'№'+Math.ceil(data.length/2):''}</text><text x={W-70} y={H-2} fill="currentColor" opacity=".5" fontSize="11">{data.length?'№'+data.length:''}</text>
 </svg>;
}

export function CandleLab(){
 const [close,setClose]=useState(105);const o=100,h=108,l=96;
 const y=v=>30+(110-v)*13;
 return <div className="lab candle-lab"><div className="candle-controls"><div className="eyebrow">КОНСТРУКТОР СВЕЧИ</div><h3>Что изменит закрытие?</h3><p>Передвинь ползунок. Открытие и крайние цены остаются прежними.</p><p className={'candle-verdict '+(close>=o?'positive':'negative')}>{close===o?'Доджи: закрытие равно открытию. Путь цены и мотивы участников по этому совпадению неизвестны.':close>o?`Бычья свеча: тело ${close-o}, верхняя тень ${h-close}. ${h-close<=1?'Закрытие близко к максимуму этого интервала.':'Цена откатилась от максимума.'}`:`Медвежья свеча: тело ${o-close}, нижняя тень ${close-l}. ${close-l<=1?'Закрытие близко к минимуму этого интервала.':'Закрытие выше минимума интервала.'}`}</p><label>Закрытие <b>{close}</b><input aria-label="Закрытие свечи" type="range" min="96" max="108" value={close} onChange={e=>setClose(+e.target.value)}/></label><div className="mini-metrics"><span>Открытие <b>100</b></span><span>Максимум <b>108</b></span><span>Минимум <b>96</b></span></div></div><svg viewBox="0 0 320 245" role="img" aria-label={`Свеча: открытие 100, максимум 108, минимум 96, закрытие ${close}`}><g className={'candle-big '+(close>=o?'up':'down')}><line x1="120" x2="120" y1={y(h)} y2={y(l)} stroke="currentColor" strokeWidth="3"/><rect x="96" y={y(Math.max(o,close))} width="48" height={Math.max(3,Math.abs(y(o)-y(close)))} rx="4" fill="currentColor"/></g><g className="open-mark"><line x1="60" x2="92" y1={y(o)} y2={y(o)} stroke="currentColor" strokeDasharray="3 3"/><text x="14" y={y(o)+4} fontSize="12" fill="currentColor">Откр. 100</text></g>{[[h,'Максимум'],[l,'Минимум'],[close,'Закрытие']].map(([v,t])=><g key={t}><line x1="150" x2="178" y1={y(v)} y2={y(v)} stroke="currentColor" opacity=".4"/><text x="186" y={y(v)+4} fontSize="13" fill="currentColor">{t} · {v}</text></g>)}</svg></div>;
}

export function OrderBookLab(){
 const [qty,setQty]=useState(3);const result=fillBuy(qty);
 return <div className="lab"><div className="lab-title"><div><div className="eyebrow">ИСПОЛНЕНИЕ РЫНОЧНОЙ ПОКУПКИ</div><h3>Цена зависит от количества</h3></div><span className="pill">Искусственный стакан</span></div><div className="book-lab-grid"><div><div className="book-row book-head"><span>Цена продажи</span><span>Доступно</span><span>Твой объём</span></div>{[[104,8],[103,5],[102,3],[101,2]].map(([p,q])=><div className="book-row" key={p}><div className="depth-bar" style={{width:`${q/8*100}%`}}/><span>{p.toFixed(2)}</span><span>{q}</span><strong>{result.fills.find(x=>x.price===p)?.quantity||'—'}</strong></div>)}<div className="spread-row">Спред 1,00 · лучший bid 100,00</div></div><div><label>Купить единиц <b>{qty}</b><input aria-label="Количество для покупки" type="range" min="1" max="18" value={qty} onChange={e=>setQty(+e.target.value)}/></label><div className="large-number">{money(result.average)}<small>средняя цена</small></div><p>Заявка забирает предложения от самой низкой цены вверх. Комиссия здесь не включена.</p></div></div></div>;
}

export function RiskCalculator(){
 const [v,setV]=useState({capital:2000,riskPct:.5,entry:50,stop:48,costs:2,multiplier:1,step:1});
 const r=positionSize(v);
 const fields=[['capital','Учебный капитал, $'],['riskPct','Лимит риска, %'],['entry','Цена входа'],['stop','Цена стопа'],['costs','Резерв расходов, $'],['multiplier','Стоимость движения на 1'],['step','Шаг количества']];
 return <div className="lab"><div className="lab-title"><div><div className="eyebrow">КАЛЬКУЛЯТОР ДЛЯ ЛИНЕЙНОГО ИНСТРУМЕНТА</div><h3>Сначала риск. Потом количество.</h3></div></div><div className="risk-grid"><div className="field-grid">{fields.map(([k,t])=><label key={k}>{t}<input type="number" aria-label={t} min={k==='costs'?0:0.0001} step="any" value={v[k]} onChange={e=>setV({...v,[k]:e.target.value===''?'':Number(e.target.value)})}/></label>)}</div><div className="risk-result"><span>Допустимое количество</span><strong>{r.valid?money(r.quantity,8):'—'}</strong><small>единиц · округление вниз</small><hr/><div>Бюджет риска <b>{r.valid?money(r.budget)+' $':'—'}</b></div><div>Риск с расходами <b>{r.valid?money(r.plannedLoss)+' $':'—'}</b></div><p>{!r.valid?'Проверь положительные значения и разные цены входа и стопа.':r.quantity===0?'Минимальный размер не помещается в лимит: такая сделка пропускается.':'Расчёт предполагает исполнение по стопу. Разрыв или проскальзывание могут увеличить убыток.'}</p></div></div><p className="footnote">Резерв расходов — фиксированная учебная оценка для всей сделки. Для тарифа от оборота его нужно пересчитать по фактическому размеру. Обратные и нелинейные контракты требуют другой формулы.</p></div>;
}

export function ExpectancyLab(){
 const [p,setP]=useState(40),[win,setWin]=useState(2),[loss,setLoss]=useState(1),[cost,setCost]=useState(.1);
 const e=expectancy(p/100,win,loss,cost);
 return <div className="lab"><div className="eyebrow">МОДЕЛЬ, А НЕ ПРОГНОЗ</div><h3>Частота и размер работают вместе</h3><div className="expect-grid"><div>{[['Выигрышных сделок, %',p,setP,5,95,1],['Средний выигрыш, R',win,setWin,.2,5,.1],['Средний проигрыш, R',loss,setLoss,.2,5,.1],['Расходы на сделку, R',cost,setCost,0,1,.05]].map(([t,val,set,min,max,step])=><label key={t}>{t}<b>{money(val)}</b><input type="range" aria-label={t} value={val} min={min} max={max} step={step} onChange={a=>set(+a.target.value)}/></label>)}</div><div className="expect-result"><span>Ожидание одной сделки</span><strong className={e>=0?'positive':'negative'}>{e>0?'+':''}{money(e)}R</strong><div className="outcome-bars"><i style={{flex:p,background:'var(--up)'}}/><i style={{flex:100-p,background:'var(--down)'}}/></div><p>{money(p/100)} × {money(win)} − {money(1-p/100)} × {money(loss)} − {money(cost)}</p><small>Наблюдаемые параметры имеют ошибку оценки и могут измениться.</small></div></div></div>;
}

export function DrawdownLab(){const [d,setD]=useState(20);return <div className="lab drawdown-lab"><div><div className="eyebrow">ВОССТАНОВЛЕНИЕ КАПИТАЛА</div><h3>Проценты не симметричны</h3><label>Просадка <b>{d}%</b><input aria-label="Просадка" type="range" min="1" max="80" value={d} onChange={e=>setD(+e.target.value)}/></label><p>Из 1 000 $ осталось {money(1000*(1-d/100))} $.</p></div><div className="large-number">+{money(recovery(d/100)*100)}%<small>нужно для восстановления</small></div></div>;}

const diagrams={
 flow:['Ты формулируешь решение','Терминал передаёт поручение','Брокер обеспечивает доступ','Площадка исполняет по правилам'],
 products:['Базовый актив','Форма: спот / фонд / контракт','Спецификация и расходы','Расчёт денежного риска'],
 costs:['Движение цены','− Комиссии входа и выхода','− Прочие издержки','= Чистый результат'],
 indicators:['Цена и объём','Формула и выбранное окно','Показатель','Гипотеза для проверки'],
 setup:['Контекст','Сигнал и вход','Отмена и размер','Защитный выход и цель'],
 backtest:['Зафиксировать правила','Проверить на истории','Новые данные','Демо и оценка исполнения'],
 journal:['До: идея и риск','Во время: факт исполнения','После: процесс и деньги','Повтор: один навык'],
 news:['Ожидания уже в цене','Новые данные и пересмотр','Реакция участников','Доступные цены исполнения'],
 tilt:['Событие: защитный выход','Мысль: «нужно вернуть»','Сигнал: напряжение и спешка','Пауза и проверка правил'],
 biases:['Первая идея','Поиск удобных аргументов','Записать опровержение','Пересмотреть по данным'],
 learning:['Один элемент','Короткая попытка','Обратная связь','Повтор без подсказки'],
 routine:['Подготовка','Решение до раскрытия','Оценка процесса','Один вывод'],
 checkpoint:['Объяснить механику','Рассчитать риск','Соблюсти правило','Назвать следующий вопрос'],
 correlation:['Разные тикеры','Общий фактор движения','Одновременный неблагоприятный исход','Проверка общего риска'],
 uncertainty:['Известны правила','Неизвестен один исход','Ограничен плановый риск','Проверяется серия решений'],
 leverage:['Капитал 1 000 $','Позиция 10 000 $','Изменение цены −1%','Около −10% капитала'],
 outcome:['План + прибыль','План + убыток','Нарушение + прибыль','Нарушение + убыток']
};

export function Visual({type,interactive=true}){
 if(type==='candle')return <CandleLab/>;
 if(type==='orderbook')return <OrderBookLab/>;
 if(type==='risk')return <RiskCalculator/>;
 if(type==='expectancy')return <ExpectancyLab/>;
 if(type==='drawdown')return <DrawdownLab/>;
 if(['chart','levels','fvg'].includes(type))return <div className="lab chart-lab"><div className="lab-title"><div><div className="eyebrow">УЧЕБНАЯ ИЛЛЮСТРАЦИЯ</div><h3>{type==='fvg'?'Область между крайними свечами':type==='levels'?'Линия — начало вопроса':'Сначала наблюдение, затем сценарий'}</h3></div><span className="pill">Искусственные данные</span></div>{type==='fvg'?<svg viewBox="0 0 760 250" role="img" aria-label="Три свечи и зона FVG между максимумом первой и минимумом третьей"><g className="fvg-zone"><rect x="175" y="122" width="420" height="53" fill="currentColor" opacity=".14"/><line x1="175" x2="595" y1="122" y2="122" stroke="currentColor" strokeDasharray="5 5"/><line x1="175" x2="595" y1="175" y2="175" stroke="currentColor" strokeDasharray="5 5"/><text x="600" y="153" fill="currentColor" fontSize="15" fontWeight="700">FVG</text></g>{[[230,185,215,175,232],[380,116,199,88,222],[530,77,112,52,122]].map(([x,a,b,h,l],i)=><g key={i}><g className="candle up" style={{animationDelay:i*120+'ms'}}><line x1={x} x2={x} y1={h} y2={l} stroke="currentColor" strokeWidth="3"/><rect x={x-23} y={a} width="46" height={b-a} fill="currentColor" rx="3"/></g><text x={x-30} y="247" fill="currentColor" opacity=".6" fontSize="13">Свеча {i+1}</text></g>)}<text x="24" y="30" fill="currentColor" opacity=".65" fontSize="13">Вторая свеча могла торговаться внутри зоны</text></svg>:<Chart annotated visible={38}/>}</div>;
 const items=diagrams[type]||diagrams.flow;
 return <div className={'lab diagram '+(type==='outcome'?'matrix':'')}><div className="eyebrow">РАЗЛОЖИМ ПО ШАГАМ</div><div className="diagram-row">{items.map((t,i)=><React.Fragment key={t}><div className="diagram-step"><span>0{i+1}</span><strong>{t}</strong></div>{i<items.length-1&&<ArrowRight size={18} className="diagram-arrow"/>}</React.Fragment>)}</div></div>;
}
