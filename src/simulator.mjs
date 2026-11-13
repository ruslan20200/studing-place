import { makeCandles, settleTrade, tradeResultR } from './domain.mjs';
export const SIM_START = 10000;
export const SIM_COST = .1;
export const initialSimulator = () => ({ seed: 17, visible: 26, trade: null, events: [], distance: 2, rr: 2, riskPct: 1, speed: 1, reason: '' });
export const simulatorBalance = session => SIM_START + session.events.reduce((sum, event) => sum + event.pnl, 0);
export function simulatorRisk(session) {
  const budget = Math.max(0, simulatorBalance(session) * session.riskPct / 100);
  const priceRisk = budget / (1 + SIM_COST);
  return { budget, priceRisk, costs: priceRisk * SIM_COST, targetNet: budget * session.rr };
}
export function openSimulator(session, direction) {
  if (session.trade || session.visible >= 90 || !session.reason.trim() || simulatorBalance(session) <= 0 || !['long', 'short'].includes(direction)) return session;
  const entry = makeCandles(session.seed)[session.visible - 1].c;
  const targetDistance = session.distance * (session.rr * (1 + SIM_COST) + SIM_COST);
  return { ...session, trade: { direction, entry, distance: session.distance, riskMoney: simulatorRisk(session).budget, riskIncludesCosts: true, openedAt: new Date().toISOString(), stop: entry + (direction === 'long' ? -session.distance : session.distance), target: entry + (direction === 'long' ? targetDistance : -targetDistance) } };
}
function finish(session, result, step, id) {
  const trade = session.trade;
  const priceRisk=trade.riskMoney/(trade.riskIncludesCosts?1+SIM_COST:1);
  const closedAt=new Date().toISOString();
  const event = { ...result, pnl: result.r * trade.riskMoney, direction: trade.direction, entry: trade.entry, stop:trade.stop, target:trade.target, quantity:priceRisk/trade.distance, fees:priceRisk*SIM_COST, riskMoney:trade.riskMoney, openedAt:trade.openedAt||closedAt, closedAt, step, reasonText: session.reason, saved: false, id };
  return { ...session, trade: null, events: [event, ...session.events] };
}
export function advanceSimulator(session, id) {
  if (session.visible >= 90) return session;
  const candle = makeCandles(session.seed)[session.visible];
  let next = session;
  if (session.trade) {
    const result = settleTrade(session.trade, candle, SIM_COST);
    if (result) next = finish(session, result, session.visible + 1, id);
    else if (session.visible + 1 === 90) next = finish(session, { exit: candle.c, reason: 'Конец данных', r: tradeResultR(session.trade, candle.c, SIM_COST) }, 90, id);
  }
  return { ...next, visible: session.visible + 1 };
}
export function closeSimulator(session, id) {
  if (!session.trade) return session;
  const exit = makeCandles(session.seed)[session.visible - 1].c;
  return finish(session, { exit, reason: 'Ручной выход', r: tradeResultR(session.trade, exit, SIM_COST) }, session.visible, id);
}
export function restartSimulator(session, seed = session.seed) {
  // An open position must be closed explicitly; replay never erases account history.
  return session.trade ? session : { ...session, seed, visible: 26, reason: '' };
}
