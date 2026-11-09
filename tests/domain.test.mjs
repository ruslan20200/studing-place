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
