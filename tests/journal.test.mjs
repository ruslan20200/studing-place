import test from 'node:test';
import assert from 'node:assert/strict';
import {CURRENCIES,entryFromForm,filterJournal,formFromEntry,fromLocalDateTime,initialJournalForm,isJournalEntry,isJournalTrade,journalAnalytics,journalDay,journalGroups,localDateTime,monthCalendar,simulatorJournalTrade,tradeMetrics} from '../src/journal.mjs';
import {demoJournal} from '../src/data/journal-demo.js';
import {createBackup,parseBackup,mergeProgress} from '../src/progress.mjs';
import {initialSimulator,openSimulator,closeSimulator,advanceSimulator} from '../src/simulator.mjs';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function tradeEntry(patch={},index=0) {
  return {id:'trade-'+index,title:'Проверка',note:'Наблюдение',date:'2026-11-11T10:00:00.000Z',type:'Сделка',emotion:'Спокойствие',process:'Для разбора',result:'',trade:{version:1,symbol:'TEST',direction:'long',currency:'USD',entry:100,exit:110,quantity:2,multiplier:1,fees:2,stop:95,target:120,riskMoney:12,openedAt:'2026-11-11T09:00:00.000Z',closedAt:'2026-11-11T10:00:00.000Z',setup:'Пробой',mistakes:[],tags:[],source:'manual',...patch}};
}
const note={id:'note',title:'Старая учебная запись',note:'Цена не записана',date:'2026-11-11T12:00:00.000Z',type:'Тренажёр',emotion:'Спокойствие',process:'Для разбора',result:'+3R'};
test('linear long and short P&L account for multiplier, quantity and fees exactly once',()=>{
  const long=tradeMetrics(tradeEntry());near(long.gross,20);near(long.net,18);near(long.r,1.5);
  const short=tradeMetrics(tradeEntry({direction:'short',entry:110,exit:100,stop:115,target:90,quantity:.2,multiplier:100,fees:5,riskMoney:105}));
  near(short.gross,200);near(short.net,195);near(short.r,195/105);
});
test('open positions and old notes do not create realized profit or inferred R',()=>{
  const open=tradeEntry({exit:null,closedAt:null,fees:2});
  const stats=journalAnalytics([open,note]);
  assert.equal(stats.count,0);assert.equal(stats.open,1);assert.equal(stats.net,0);assert.equal(stats.winRate,null);assert.equal(stats.avgR,null);
  assert.equal(tradeMetrics(note),null);
});
test('net wins, losses, breakeven, expectancy and drawdown use chronological closed results',()=>{
  const entries=[tradeEntry({exit:111,closedAt:'2026-11-11T10:00:00Z'},1),tradeEntry({exit:93.5,closedAt:'2026-11-11T11:00:00Z'},2),tradeEntry({exit:101,closedAt:'2026-11-11T12:00:00Z'},3),tradeEntry({exit:116,closedAt:'2026-11-11T13:00:00Z'},4)];
  const stats=journalAnalytics([...entries].reverse());
  assert.deepEqual(stats.curve.map(point=>point.value),[0,20,5,5,35]);
  assert.equal(stats.wins,2);assert.equal(stats.losses,1);assert.equal(stats.breakeven,1);near(stats.winRate,.5);near(stats.expectancy,8.75);near(stats.profitFactor,50/15);near(stats.maxDrawdown,15);
});
test('different currencies stay separate across metrics, groups and calendar',()=>{
  const usd=tradeEntry(),kzt=tradeEntry({currency:'KZT',exit:1100},2);
  near(journalAnalytics([usd,kzt],'USD').net,18);near(journalAnalytics([usd,kzt],'KZT').net,1998);
  near(journalGroups([usd,kzt],'USD')[0].net,18);near(monthCalendar('2026-11',[usd,kzt],'USD').net,18);
});
test('calendar dates use Qyzylorda boundary and a Monday-first month',()=>{
  assert.equal(journalDay('2026-11-10T19:30:00Z'),'2026-11-11');
  const entry=tradeEntry({openedAt:'2026-11-10T18:00:00Z',closedAt:'2026-11-10T19:30:00Z'});
  const calendar=monthCalendar('2026-11',[entry,note]);
  assert.equal(calendar.cells.length,42);assert.equal(calendar.cells[6].number,1);
  assert.equal(calendar.days[10].closed,1);assert.equal(calendar.days[10].notes,1);assert.equal(calendar.days[9].closed,0);
});
test('local journal times round trip and invalid calendar dates are rejected',()=>{
  const iso=fromLocalDateTime('2026-11-11T16:25');assert.equal(iso,'2026-11-11T11:25:00.000Z');assert.equal(localDateTime(iso),'2026-11-11T16:25');
  assert.throws(()=>fromLocalDateTime('2026-02-30T10:00'));assert.throws(()=>fromLocalDateTime('not-a-date'));
});
test('scenario and multi-error breakdowns count each trade once per tag',()=>{
  const entries=[tradeEntry({mistakes:['Отыгрыш','Отыгрыш','Ранний выход']},1),tradeEntry({exit:95,setup:'Откат',mistakes:['Отыгрыш']},2)];
  const errors=journalGroups(entries,'USD','mistake');assert.equal(errors.find(group=>group.name==='Отыгрыш').count,2);assert.equal(errors.find(group=>group.name==='Ранний выход').count,1);
  near(errors.find(group=>group.name==='Отыгрыш').net,6);assert.equal(journalGroups(entries,'USD').length,2);
});
test('filters combine date, currency, scenario, mistake, status and text without treating notes as trades',()=>{
  const entry=tradeEntry({setup:'Откат',mistakes:['Спешка'],tags:['Лондон']});
  assert.equal(filterJournal([entry,note],{query:'лондон',currency:'USD',setup:'Откат',mistake:'Спешка',from:'2026-11-11',to:'2026-11-11',status:'closed'}).length,1);
  assert.equal(filterJournal([entry,note],{currency:'KZT'}).length,1);
  assert.equal(filterJournal([entry,note],{status:'open'}).length,0);
  assert.equal(filterJournal([entry],{from:'2026-11-12'}).length,0);
});
test('form validates parameters and fixes initial risk before later edits of costs',()=>{
  const form=initialJournalForm('trade','2026-11-11T10:00:00Z');Object.assign(form.values,{symbol:'aapl',entry:'100',exit:'110',quantity:'2',fees:'2',stop:'95',target:'120'});
  const created=entryFromForm(form);assert.equal(created.trade.symbol,'AAPL');near(created.trade.riskMoney,12);near(tradeMetrics(created).r,1.5);
  const edit=formFromEntry({...note,...created,id:'created'});edit.values.fees='4';const edited=entryFromForm(edit,created);
  near(edited.trade.riskMoney,12);near(tradeMetrics(edited).r,16/12);
  for(const patch of [{quantity:'0'},{entry:'-1'},{stop:'105'},{target:'90'},{fees:'-1'},{riskMoney:'0'},{exit:''},{closedAt:'2026-11-10T01:00'}])assert.throws(()=>entryFromForm({...form,values:{...form.values,...patch}}));
});
test('open form needs no exit and can later be closed, while incomplete numeric trades are rejected on import',()=>{
  const form=initialJournalForm('trade');Object.assign(form.values,{symbol:'TEST',entry:'100',status:'open',exit:''});
  const open=entryFromForm(form);assert.equal(open.trade.exit,null);assert.equal(open.trade.closedAt,null);
  assert.ok(isJournalTrade(open.trade));
  assert.throws(()=>parseBackup(JSON.stringify({app:'trading-campus',version:2,data:{'campus.journal':[tradeEntry({quantity:0})]}})));
  assert.throws(()=>parseBackup(JSON.stringify({app:'trading-campus',version:2,data:{'campus.journal':[tradeEntry({currency:'BAD'})]}})));
});
test('new simulator records reproduce the simulator dollar and R results in the journal',()=>{
  for(const direction of ['long','short']){
    let session=openSimulator({...initialSimulator(),reason:'Проверка'},direction);
    session=advanceSimulator(session,'next');
    if(session.trade)session=closeSimulator(session,'close');
    const event=session.events[0],trade=simulatorJournalTrade(event);
    assert.ok(trade);const metrics=tradeMetrics({trade});near(metrics.net,event.pnl);near(metrics.r,event.r);
  }
  assert.equal(simulatorJournalTrade({r:1,pnl:100}),undefined);
});
test('trade data, saved draft and recoverable trash survive a full backup; old v1 notes still load',()=>{
  const draft=initialJournalForm('trade');draft.values.symbol='Несохранённый черновик';
  const data={'campus.journal':[tradeEntry(),note],'campus.journalDraft':draft,'campus.journalTrash':[tradeEntry({},2)]};
  const storage={length:Object.keys(data).length,key:index=>Object.keys(data)[index],getItem:key=>JSON.stringify(data[key])};
  assert.deepEqual(parseBackup(JSON.stringify(createBackup(storage))).data,data);
  const old=parseBackup(JSON.stringify({version:1,journal:[note],completed:[],notes:{}}));assert.equal(old.data['campus.journal'][0].result,'+3R');
  const merged=mergeProgress(data,{'campus.journalTrash':[tradeEntry(),tradeEntry({},3)]});assert.ok(!merged['campus.journalTrash'].some(entry=>entry.id==='trade-0'));
});
test('demo records are valid examples with an open position, losses and multiple scenarios',()=>{
  const demo=demoJournal('2026-11-11T10:00:00Z');assert.ok(demo.every(isJournalEntry));
  const stats=journalAnalytics(demo);assert.equal(stats.count,20);assert.equal(stats.open,1);assert.equal(stats.net,170);assert.equal(stats.fees,40);assert.equal(stats.maxDrawdown,19);
  assert.equal(journalGroups(demo,'USD').length,3);assert.equal(CURRENCIES.includes('USDT'),true);
});
test('import restores a draft into an empty draft slot and respects locally deleted entries',()=>{
  const draft=initialJournalForm('trade');draft.values.symbol='Восстановить черновик';
  const deleted=tradeEntry({},2);
  const merged=mergeProgress({'campus.journal':[],'campus.journalTrash':[deleted],'campus.journalDraft':null},{'campus.journal':[deleted],'campus.journalDraft':draft});
  assert.deepEqual(merged['campus.journalDraft'],draft);assert.equal(merged['campus.journal'].length,0);assert.equal(merged['campus.journalTrash'].length,1);
});
test('editing keeps exact execution timestamps and updates a generated title after a symbol change',()=>{
  const original=tradeEntry({openedAt:'2026-11-11T09:00:12.123Z',closedAt:'2026-11-11T10:00:23.345Z'});original.title='TEST · покупка';
  const form=formFromEntry(original);form.values.symbol='NEW';const changed=entryFromForm(form,original);
  assert.equal(changed.trade.openedAt,original.trade.openedAt);assert.equal(changed.trade.closedAt,original.trade.closedAt);assert.equal(changed.title,'NEW · покупка');
  assert.throws(()=>entryFromForm({...form,values:{...form.values,closedAt:'2026-11-11T14:00'}},original));
});
