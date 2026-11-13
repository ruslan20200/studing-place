import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackup, parseBackup, mergeProgress, restoreProgress } from '../src/progress.mjs';
import { initialSimulator, openSimulator, advanceSimulator, closeSimulator, restartSimulator, simulatorBalance, simulatorRisk } from '../src/simulator.mjs';
import { settleTrade, tradeResultR } from '../src/domain.mjs';
import { lessons } from '../src/data/curriculum.js';
import { readingPractice } from '../src/data/reading-practice.js';
import fs from 'node:fs';

const near = (a, b) => assert.ok(Math.abs(a-b) < 1e-8, `${a} != ${b}`);
class MemoryStorage {
  data = new Map();
  get length() { return this.data.size; }
  key(index) { return [...this.data.keys()][index] ?? null; }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}
const entry = { id:'one', title:'Проверка', note:'Причина до входа', type:'Тренажёр', date:'2026-11-11T12:00:00Z', emotion:'Спокойствие', process:'Для разбора', result:'-1R' };
const plan = { market:'BTC/USDT спот', timeframe:'M15', hours:'Днём', context:'Диапазон', entry:'Закрытие', stop:'Отмена', target:'Правило выхода', noTrade:'При неизвестных расходах', risk:.5, dailyLimit:3, maxTrades:3 };

test('full backup restores account, open position, journal, plan, cards, reading and all activity', () => {
  const storage = new MemoryStorage();
  let session = openSimulator({...initialSimulator(), reason:'Учебный сценарий'},'long');
  const data = {
    'campus.simulator':session, 'campus.journal':[entry], 'campus.completed':['orders'], 'campus.notes':{orders:'Моя заметка'},
    'campus.plan':plan, 'campus.cards':{Bid:{box:3,due:'2026-11-15'}}, 'campus.stats':{sim:{trades:4},exam:{attempts:2,best:9,last:7}},
    'campus.activity':{'2026-11-11':{practice:3,journal:1}}, 'campus.reader.murphy':{chapter:4,done:[0,1,3],size:20}, 'campus.last':'orders','campus.theme':'dark',
  };
  for(const [key,value] of Object.entries(data)) storage.setItem(key,JSON.stringify(value));
  storage.setItem('unrelated','untouched');
  const backup=parseBackup(JSON.stringify(createBackup(storage)));
  const destination=new MemoryStorage();restoreProgress(destination,backup.data);
  assert.deepEqual(createBackup(destination).data,data);
  assert.equal(destination.getItem('unrelated'),null);
  const restored=JSON.parse(destination.getItem('campus.simulator'));
  near(tradeResultR(restored.trade,restored.trade.stop),-1);
});
test('legacy import adds data and does not overwrite current notes or duplicate journal entries', () => {
  const legacy=parseBackup(JSON.stringify({version:1,journal:[entry],completed:['orders'],notes:{orders:'Из копии',candles:'Новая'}}));
  const current={'campus.notes':{orders:'Текущая'},'campus.journal':[{...entry,note:'Текущее наблюдение'}],'campus.completed':['candles']};
  const once=mergeProgress(current,legacy.data),twice=mergeProgress(once,legacy.data);
  assert.deepEqual(once,twice);
  assert.deepEqual(once['campus.completed'],['candles','orders']);
  assert.equal(once['campus.notes'].orders,'Текущая');
  assert.equal(once['campus.notes'].candles,'Новая');
  assert.equal(once['campus.journal'][0].note,'Текущее наблюдение');
});
test('merge preserves started local account, fills an empty plan, unions reading without doubling statistics', () => {
  const local=openSimulator({...initialSimulator(),reason:'Мой вход'},'short');
  const current={'campus.simulator':local,'campus.stats':{sim:{trades:8}},'campus.plan':{...plan,market:'',timeframe:'',hours:'',context:'',entry:'',stop:'',target:'',risk:.5},'campus.reader.murphy':{chapter:3,done:[0],size:18}};
  const incoming={'campus.simulator':initialSimulator(),'campus.stats':{sim:{trades:10}},'campus.plan':{...plan,risk:1},'campus.reader.murphy':{chapter:8,done:[1,2],size:20}};
  const merged=mergeProgress(current,incoming);
  assert.deepEqual(merged['campus.simulator'],local);
  assert.equal(merged['campus.stats'].sim.trades,10);
  assert.equal(merged['campus.plan'].risk,1);
  assert.equal(merged['campus.reader.murphy'].chapter,3);
  assert.deepEqual(merged['campus.reader.murphy'].done,[0,1,2]);
  assert.deepEqual(mergeProgress(merged,incoming),merged);
});
test('malformed backups cannot replace typed application state', () => {
  const invalid=[{'campus.notes':{orders:{text:'bad'}}},{'campus.stats':{chart:{correct:3}}},{'campus.simulator':{...initialSimulator(),visible:900}},{'campus.plan':[]},{'campus.journal':[{id:'bad',note:'missing fields'}]},{'other.key':[]}];
  for(const data of invalid) assert.throws(()=>parseBackup(JSON.stringify({app:'trading-campus',version:2,data})));
});
test('a failed multi-key import rolls back keys written before storage filled up', () => {
  const storage=new MemoryStorage();storage.setItem('campus.completed','["orders"]');
  const before=[...storage.data];const write=storage.setItem.bind(storage);let writes=0;
  storage.setItem=(key,value)=>{if(++writes===2)throw Error('Quota');write(key,value);};
  assert.throws(()=>restoreProgress(storage,{'campus.completed':['candles'],'campus.notes':{orders:'Текст'}}));
  assert.deepEqual([...storage.data],before);
});
test('pending in-memory changes are included in backup when browser saving fails', () => {
  const storage=new MemoryStorage();storage.setItem('campus.notes','{"orders":"Старое"}');
  const backup=createBackup(storage,{'campus.notes':{orders:'Последнее изменение'}});
  assert.equal(backup.data['campus.notes'].orders,'Последнее изменение');
});
test('a fresh browser can export and import its empty progress', () => {
  const storage = new MemoryStorage();
  assert.deepEqual(parseBackup(JSON.stringify(createBackup(storage))).data,{});
});
test('unsaved changes remain downloadable when access to storage is blocked entirely', () => {
  const storage={get length(){throw Error('SecurityError');}};
  assert.deepEqual(createBackup(storage,{'campus.notes':{orders:'Запись'}}).data,{'campus.notes':{orders:'Запись'}});
});
test('100 dollar risk contains costs and net target is exactly selected R for long and short', () => {
  for(const direction of ['long','short']) {
    const session=openSimulator({...initialSimulator(),reason:'Правило',rr:2},direction);
    const risk=simulatorRisk(session);near(risk.budget,100);near(risk.priceRisk+risk.costs,100);
    const {trade}=session;
    near(tradeResultR(trade,trade.stop),-1);
    near(tradeResultR(trade,trade.target),2);
    near(tradeResultR(trade,trade.entry)*trade.riskMoney,-risk.costs);
    const candle=direction==='long'?{o:trade.entry,h:trade.entry,l:trade.stop,c:trade.stop}:{o:trade.entry,h:trade.stop,l:trade.entry,c:trade.stop};
    near(settleTrade(trade,candle).r*trade.riskMoney,-100);
    const gap=direction==='long'?{o:trade.stop-1,h:trade.stop,l:trade.stop-2}:{o:trade.stop+1,h:trade.stop+2,l:trade.stop};
    assert.ok(settleTrade(trade,gap).r < -1);
  }
});
test('replay and saved round trip retain history and balance; an open position cannot be discarded by replay', () => {
  const open=openSimulator({...initialSimulator(),reason:'Причина'},'long');
  assert.equal(restartSimulator(open,34),open);
  const closed=closeSimulator(open,'closed-1');
  const replay=restartSimulator(closed,34);
  assert.equal(replay.events.length,1);near(simulatorBalance(replay),simulatorBalance(closed));
  const restored=JSON.parse(JSON.stringify(replay));
  assert.deepEqual(restored.events,closed.events);
  assert.deepEqual(closeSimulator(restored,'duplicate'),restored);
});
test('last candle settles any remaining position only once', () => {
  let session=openSimulator({...initialSimulator(),visible:89,reason:'До конца'},'long');
  session=advanceSimulator(session,'last');
  assert.equal(session.visible,90);assert.equal(session.trade,null);assert.equal(session.events.length,1);
  assert.deepEqual(advanceSimulator(session,'duplicate'),session);
});
test('all thirty lessons have two distinct scenario questions, worked explanation and complete answer keys', () => {
  assert.equal(lessons.length,30);
  for(const lesson of lessons) {
    assert.ok(lesson.worked && lesson.mistake && lesson.explain.length >= 4,lesson.id);
    assert.equal(lesson.quizzes.length,2,lesson.id);
    assert.equal(new Set(lesson.quizzes.map(q=>q.question)).size,2);
    for(const q of lesson.quizzes){assert.equal(new Set(q.options).size,3);assert.ok(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<3);assert.ok(q.feedback.length>30);}
  }
  const catalog=JSON.parse(fs.readFileSync(new URL('../public/data/catalog.json',import.meta.url)));
  assert.ok(catalog.every(book=>readingPractice[book.id]?.questions.length===3));
});
