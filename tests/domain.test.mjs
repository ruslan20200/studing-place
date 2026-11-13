import test from 'node:test';
import assert from 'node:assert/strict';
import {positionSize,expectancy,recovery,fillBuy,makeCandles,settleTrade} from '../src/domain.mjs';
test('position risk reserves costs and floors to instrument step',()=>{
 const r=positionSize({capital:2000,riskPct:.5,entry:50,stop:48,costs:2});assert.equal(r.quantity,4);assert.equal(r.plannedLoss,10);
 const small=positionSize({capital:100,riskPct:.5,entry:50,stop:48,costs:0});assert.equal(small.quantity,0);
 assert.equal(positionSize({capital:1000,riskPct:1,entry:50,stop:50}).valid,false);
});
test('expectancy and asymmetric recovery',()=>{assert.ok(Math.abs(expectancy(.4,2,1,.1)-.1)<1e-10);assert.equal(recovery(.5),1);});
test('execution consumes available levels and reports insufficient liquidity',()=>{assert.equal(fillBuy(3).average,304/3);assert.equal(fillBuy(25).remaining,7);});
test('synthetic candles are deterministic and contain valid OHLC',()=>{assert.deepEqual(makeCandles(3),makeCandles(3));assert.ok(makeCandles().every(c=>c.l<=Math.min(c.o,c.c)&&c.h>=Math.max(c.o,c.c)));});
test('OHLC ambiguity chooses stop and gaps worsen stop fill',()=>{
 const t={direction:'long',entry:100,stop:98,target:104,distance:2};
 const r=settleTrade(t,{o:100,l:97,h:105});assert.equal(r.ambiguous,true);assert.equal(r.exit,98);
 assert.equal(settleTrade(t,{o:96,l:95,h:97}).exit,96);
});

import {makeRegime,tradeStats,simulateSeries,sizingProblem,reviewCard,isDue,streakDays,levelFor,addDays} from '../src/domain.mjs';
test('chart regimes look like their labels',()=>{
 for(let s=1;s<=25;s++){
  const net=k=>{const c=makeRegime(k,s);return c.at(-1).c-c[0].o;};
  assert.ok(net('up')>8,'up '+s);assert.ok(net('down')<-8,'down '+s);assert.ok(Math.abs(net('range'))<6,'range '+s);assert.ok(net('breakout')>6,'breakout '+s);
  const r=makeRegime('range',s);assert.ok(r.every(c=>c.l<=Math.min(c.o,c.c)&&c.h>=Math.max(c.o,c.c)));
 }
});
test('trade statistics in R',()=>{
 const s=tradeStats([1,-1,-1,2,-1]);assert.equal(s.n,5);assert.equal(s.wins,2);assert.equal(s.total,0);assert.equal(s.maxDD,2);assert.equal(s.profitFactor,1);
 assert.equal(tradeStats([]).winRate,0);
});
test('monte carlo is deterministic and bounded',()=>{
 const a=simulateSeries({winRate:.4,rr:2,riskPct:1,trades:50,paths:20});const b=simulateSeries({winRate:.4,rr:2,riskPct:1,trades:50,paths:20});
 assert.equal(a.median,b.median);assert.ok(a.p10<=a.median&&a.median<=a.p90);assert.ok(a.worstDD>=0&&a.worstDD<=1);assert.ok(Math.abs(a.expectancyR-.2)<1e-9);
 const ruin=simulateSeries({winRate:.1,rr:1,riskPct:50,trades:60,paths:10});assert.ok(ruin.paths.every(p=>p.final>=0));
});
test('sizing problems have an exact integer answer',()=>{
 for(let s=1;s<60;s++){const p=sizingProblem(s);assert.equal(p.answer,Math.floor(p.capital*p.riskPct/100/Math.abs(p.entry-p.stop)+1e-9));assert.ok(p.answer>0);}
});
test('spaced repetition and streaks',()=>{
 assert.deepEqual(reviewCard(undefined,true,'2026-01-01'),{box:2,due:'2026-01-02'});
 assert.deepEqual(reviewCard({box:4},false,'2026-01-01'),{box:1,due:'2026-01-01'});
 assert.equal(isDue({due:'2026-01-03'},'2026-01-02'),false);
 assert.equal(addDays('2026-02-28',1),'2026-03-01');
 assert.equal(streakDays(['2026-01-01','2026-01-02','2026-01-03'],'2026-01-03'),3);
 assert.equal(streakDays(['2026-01-01','2026-01-02'],'2026-01-03'),2);
 assert.equal(streakDays(['2026-01-01'],'2026-01-03'),0);
 assert.equal(levelFor(0).name,'Новичок');assert.equal(levelFor(450).index,1);
});
