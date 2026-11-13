export const JOURNAL_ZONE = 'Asia/Qyzylorda';
export const CURRENCIES = ['USD', 'USDT', 'KZT', 'EUR', 'RUB'];
export const DEFAULT_MISTAKES = ['Вход без сигнала', 'Превышен риск', 'Ранний выход', 'Перенос стопа', 'Отыгрыш', 'Пропущен чек-лист'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const positive = value => Number.isFinite(value) && value > 0;
const instant = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const tagList = value => Array.isArray(value) && value.length <= 100 && value.every(tag => typeof tag === 'string' && tag.length <= 100);
export const parseTags = value => [...new Set(String(value || '').split(/[,;\n]/).map(tag => tag.trim()).filter(Boolean))].slice(0, 30);
const zoned = new Intl.DateTimeFormat('en-GB', {timeZone:JOURNAL_ZONE, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23'});
export function localDateTime(iso = new Date().toISOString()) {
  if (!instant(iso)) return '';
  const parts = Object.fromEntries(zoned.formatToParts(new Date(iso)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export const journalDay = iso => localDateTime(iso).slice(0,10);
export function fromLocalDateTime(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw Error('Укажи дату и время.');
  const desired = Date.parse(value + ':00Z');
  if (!Number.isFinite(desired)) throw Error('Проверь дату и время.');
  let guess = desired;
  for (let attempt = 0; attempt < 3; attempt++) {
    const actual = Date.parse(localDateTime(new Date(guess).toISOString()) + ':00Z');
    if (actual === desired) break;
    guess += desired - actual;
  }
  const iso = new Date(guess).toISOString();
  if (localDateTime(iso) !== value) throw Error('Такой даты или времени нет.');
  return iso;
}
export function isJournalTrade(trade) {
  return object(trade) && trade.version === 1 && typeof trade.symbol === 'string' && trade.symbol.trim().length > 0 && trade.symbol.length <= 80
    && ['long','short'].includes(trade.direction) && CURRENCIES.includes(trade.currency)
    && ['entry','quantity','multiplier'].every(key => positive(trade[key]))
    && (trade.exit === null || positive(trade.exit)) && Number.isFinite(trade.fees) && trade.fees >= 0
    && (trade.stop === null || positive(trade.stop) && (trade.direction === 'long' ? trade.stop < trade.entry : trade.stop > trade.entry))
    && (trade.target === null || positive(trade.target) && (trade.direction === 'long' ? trade.target > trade.entry : trade.target < trade.entry))
    && (trade.riskMoney === null || positive(trade.riskMoney))
    && instant(trade.openedAt) && (trade.closedAt === null || instant(trade.closedAt) && Date.parse(trade.closedAt) >= Date.parse(trade.openedAt))
    && (trade.exit === null) === (trade.closedAt === null)
    && typeof trade.setup === 'string' && trade.setup.length <= 200 && tagList(trade.mistakes) && tagList(trade.tags)
    && ['manual','simulator'].includes(trade.source)
    && (trade.exit === null || Number.isFinite((trade.exit - trade.entry) * trade.quantity * trade.multiplier - trade.fees));
}
export function isJournalEntry(entry) {
  return object(entry) && ['id','title','note','date','type','emotion','process'].every(key => typeof entry[key] === 'string')
    && instant(entry.date) && (entry.result === undefined || typeof entry.result === 'string')
    && (entry.trade === undefined || isJournalTrade(entry.trade));
}
export const isJournalDraft = value => value === null || object(value) && ['trade','note'].includes(value.kind)
  && (value.editingId === null || typeof value.editingId === 'string') && object(value.values)
  && Object.values(value.values).every(item => typeof item === 'string');
export function tradeMetrics(entry) {
  const trade = entry.trade;
  if (!isJournalTrade(trade)) return null;
  const closed = trade.exit !== null;
  const gross = closed ? (trade.direction === 'long' ? 1 : -1) * (trade.exit - trade.entry) * trade.quantity * trade.multiplier : null;
  const rawNet = closed ? gross - trade.fees : null;
  const net = rawNet !== null && Math.abs(rawNet) < 1e-8 ? 0 : rawNet;
  return { trade, closed, gross, net, r: closed && trade.riskMoney ? net / trade.riskMoney : null, day:journalDay(trade.closedAt || trade.openedAt) };
}
export const entryTime = entry => entry.trade?.closedAt || entry.trade?.openedAt || entry.date;
export const sortJournal = entries => [...entries].sort((a,b) => Date.parse(entryTime(b)) - Date.parse(entryTime(a)));
export function filterJournal(entries, {query='',currency='',setup='',mistake='',from='',to='',status='all'} = {}) {
  const needle = query.trim().toLocaleLowerCase('ru');
  return sortJournal(entries.filter(entry => {
    const metrics = tradeMetrics(entry), trade = metrics?.trade;
    const day = journalDay(entryTime(entry));
    if (from && day < from || to && day > to) return false;
    if (trade && currency && trade.currency !== currency) return false;
    if (setup && (!trade || (trade.setup.trim() || 'Без сценария') !== setup)) return false;
    if (mistake && (!trade || !trade.mistakes.includes(mistake))) return false;
    if (status === 'open' && (!trade || metrics.closed) || status === 'closed' && (!trade || !metrics.closed)) return false;
    const text = [entry.title,entry.note,entry.emotion,entry.process,entry.result,trade?.symbol,trade?.setup,...(trade?.tags || []),...(trade?.mistakes || [])].join(' ').toLocaleLowerCase('ru');
    return !needle || text.includes(needle);
  }));
}
export function journalAnalytics(entries, currency = 'USD') {
  const positions = entries.map(tradeMetrics).filter(metrics => metrics && metrics.trade.currency === currency);
  const closed = positions.filter(metrics => metrics.closed).sort((a,b) => Date.parse(a.trade.closedAt) - Date.parse(b.trade.closedAt));
  let cumulative=0, peak=0, maxDrawdown=0, winSum=0, lossSum=0, wins=0, losses=0, breakeven=0, fees=0;
  const curve = [{date:null,value:0}];
  for (const item of closed) {
    cumulative += item.net; fees += item.trade.fees;
    if (item.net > 0) { wins++; winSum+=item.net; } else if (item.net < 0) { losses++; lossSum-=item.net; } else breakeven++;
    peak = Math.max(peak,cumulative); maxDrawdown = Math.max(maxDrawdown,peak-cumulative);
    curve.push({date:item.trade.closedAt,value:cumulative});
  }
  const withR = closed.filter(item => item.r !== null);
  return {currency,count:closed.length,open:positions.length-closed.length,wins,losses,breakeven,net:cumulative,fees,
    winRate:closed.length?wins/closed.length:null,profitFactor:lossSum?winSum/lossSum:winSum?Infinity:null,
    expectancy:closed.length?cumulative/closed.length:null,avgWin:wins?winSum/wins:null,avgLoss:losses?lossSum/losses:null,
    avgR:withR.length?withR.reduce((sum,item)=>sum+item.r,0)/withR.length:null,rCount:withR.length,maxDrawdown,curve};
}
export function journalGroups(entries, currency, kind = 'setup') {
  const groups = new Map();
  for (const entry of entries) {
    const metrics = tradeMetrics(entry);
    if (!metrics?.closed || metrics.trade.currency !== currency) continue;
    const keys = kind === 'mistake' ? [...new Set(metrics.trade.mistakes)] : [metrics.trade.setup.trim() || 'Без сценария'];
    for (const key of keys) groups.set(key,[...(groups.get(key)||[]),entry]);
  }
  return [...groups].map(([name,items])=>({name,...journalAnalytics(items,currency)})).sort((a,b)=>b.count-a.count || a.name.localeCompare(b.name,'ru'));
}
export function monthCalendar(month, entries, currency='USD') {
  if (!/^\d{4}-\d{2}$/.test(month)) throw Error('Неверный месяц');
  const [year,number] = month.split('-').map(Number);
  if (number < 1 || number > 12) throw Error('Неверный месяц');
  const count = new Date(Date.UTC(year,number,0)).getUTCDate();
  const offset = (new Date(Date.UTC(year,number-1,1)).getUTCDay()+6)%7;
  const days = Array.from({length:count},(_,index)=>({key:`${month}-${String(index+1).padStart(2,'0')}`,number:index+1,closed:0,open:0,notes:0,net:null}));
  const byDate = new Map(days.map(day=>[day.key,day]));
  for(const entry of entries) {
    const day=byDate.get(journalDay(entryTime(entry)));if(!day)continue;
    const metrics=tradeMetrics(entry);
    if(!metrics){day.notes++;continue;}
    if(metrics.trade.currency!==currency)continue;
    if(metrics.closed){day.closed++;day.net=(day.net??0)+metrics.net;}else day.open++;
  }
  const cells=[...Array(offset).fill(null),...days];while(cells.length%7)cells.push(null);
  return {days,cells,net:days.reduce((sum,day)=>sum+(day.net??0),0),closed:days.reduce((sum,day)=>sum+day.closed,0)};
}
export function moveMonth(month, delta) {
  const [year,number]=month.split('-').map(Number),date=new Date(Date.UTC(year,number-1+delta,1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`;
}
export function initialJournalForm(kind='trade', iso=new Date().toISOString()) {
  return {kind,editingId:null,values:{title:'',note:'',result:'',emotion:'Спокойствие',process:'Для разбора',symbol:'',direction:'long',currency:'USD',entry:'',exit:'',quantity:'1',multiplier:'1',fees:'0',stop:'',target:'',riskMoney:'',openedAt:localDateTime(iso),closedAt:localDateTime(iso),setup:'',mistakes:'',tags:'',status:'closed'}};
}
export function formFromEntry(entry) {
  const form=initialJournalForm(entry.trade?'trade':'note');form.editingId=entry.id;
  for(const key of ['title','note','result','emotion','process'])form.values[key]=entry[key]||'';
  if(entry.trade){const trade=entry.trade;for(const key of ['symbol','direction','currency','entry','exit','quantity','multiplier','fees','stop','target','riskMoney','setup'])form.values[key]=trade[key]===null?'':String(trade[key]);
    form.values.openedAt=localDateTime(trade.openedAt);form.values.closedAt=localDateTime(trade.closedAt||trade.openedAt);
    form.values.status=trade.exit===null?'open':'closed';form.values.mistakes=trade.mistakes.join(', ');form.values.tags=trade.tags.join(', ');
  }
  return form;
}
const numeric = (value, fallback=null) => String(value??'').trim()===''?fallback:Number(String(value).replace(',','.'));
export function entryFromForm(form, original) {
  const values=form.values;
  const base={title:values.title.trim(),note:values.note.trim(),result:values.result.trim(),emotion:values.emotion,process:values.process,type:original?.type||'Самостоятельная практика'};
  if(form.kind==='note'){
    if(!base.title||!base.note)throw Error('Для заметки заполни название и наблюдение.');
    return base;
  }
  const trade={version:1,symbol:values.symbol.trim().toUpperCase(),direction:values.direction,currency:values.currency,entry:numeric(values.entry),exit:values.status==='open'?null:numeric(values.exit),quantity:numeric(values.quantity),multiplier:numeric(values.multiplier),fees:numeric(values.fees,0),stop:numeric(values.stop),target:numeric(values.target),riskMoney:numeric(values.riskMoney),openedAt:fromLocalDateTime(values.openedAt),closedAt:values.status==='open'?null:fromLocalDateTime(values.closedAt),setup:values.setup.trim(),mistakes:parseTags(values.mistakes),tags:parseTags(values.tags),source:original?.trade?.source||'manual'};
  if(original?.trade&&values.openedAt===localDateTime(original.trade.openedAt))trade.openedAt=original.trade.openedAt;
  if(trade.closedAt&&original?.trade?.closedAt&&values.closedAt===localDateTime(original.trade.closedAt))trade.closedAt=original.trade.closedAt;
  if(!trade.symbol)throw Error('Укажи инструмент, например AAPL или BTCUSDT.');
  if(!['entry','quantity','multiplier'].every(key=>positive(trade[key]))||trade.exit!==null&&!positive(trade.exit))throw Error('Цены, количество и стоимость движения должны быть больше нуля.');
  if(values.status==='closed'&&trade.exit===null)throw Error('Для закрытой сделки укажи цену выхода.');
  if(!Number.isFinite(trade.fees)||trade.fees<0)throw Error('Расходы должны быть нулём или положительным числом.');
  if(trade.closedAt&&Date.parse(trade.closedAt)<Date.parse(trade.openedAt))throw Error('Выход не может быть раньше входа.');
  if(trade.stop!==null&&(!positive(trade.stop)||(trade.direction==='long'?trade.stop>=trade.entry:trade.stop<=trade.entry)))throw Error('Стоп покупки должен быть ниже входа, стоп продажи — выше.');
  if(trade.target!==null&&(!positive(trade.target)||(trade.direction==='long'?trade.target<=trade.entry:trade.target>=trade.entry)))throw Error('Цель покупки должна быть выше входа, цель продажи — ниже.');
  if(trade.riskMoney===null&&trade.stop!==null)trade.riskMoney=Math.abs(trade.entry-trade.stop)*trade.quantity*trade.multiplier+trade.fees;
  if(!isJournalTrade(trade))throw Error('Проверь параметры сделки и положительный исходный риск.');
  const autoTitle=`${trade.symbol} · ${trade.direction==='long'?'покупка':'продажа'}`;
  const oldAutoTitle=original?.trade?`${original.trade.symbol} · ${original.trade.direction==='long'?'покупка':'продажа'}`:null;
  return {...base,title:!base.title||base.title===oldAutoTitle?autoTitle:base.title,type:original?.type||'Сделка',trade};
}
export function simulatorJournalTrade(event) {
  if(!positive(event.quantity)||!positive(event.riskMoney))return undefined;
  const trade={version:1,symbol:'DEMO',direction:event.direction,currency:'USD',entry:event.entry,exit:event.exit,quantity:event.quantity,multiplier:1,fees:event.fees,stop:event.stop,target:event.target,riskMoney:event.riskMoney,openedAt:event.openedAt,closedAt:event.closedAt,setup:'Учебный тренажёр',mistakes:[],tags:['Искусственный рынок'],source:'simulator'};
  return isJournalTrade(trade)?trade:undefined;
}
