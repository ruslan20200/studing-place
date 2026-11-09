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
export function settleTrade(trade,candle,cost=.1){
 const long=trade.direction==='long';
 const hitStop=long?candle.l<=trade.stop:candle.h>=trade.stop;
 const hitTarget=long?candle.h>=trade.target:candle.l<=trade.target;
 if(!hitStop&&!hitTarget)return null;
 const price=hitStop?(long?Math.min(candle.o,trade.stop):Math.max(candle.o,trade.stop)):trade.target;
 return {exit:price,reason:hitStop?'Защитный выход':'Цель',ambiguous:hitStop&&hitTarget,r:(long?price-trade.entry:trade.entry-price)/trade.distance-cost};
}
