import {fromLocalDateTime,journalDay} from '../journal.mjs';

/** Separate in-memory examples; never persisted as the user's trading history. */
export function demoJournal(now=new Date().toISOString()) {
  const today=journalDay(now),anchor=Date.parse(today+'T12:00:00Z');
  const outcomes=[18,-12,26,9,-19,31,-8,14,22,-15,17,-11,35,8,-14,21,13,-9,28,16];
  const setups=['Пробой уровня','Откат по тренду','Возврат в диапазон'];
  const entries=outcomes.map((net,index)=>{
    const day=new Date(anchor-(outcomes.length-1-index)*86400000).toISOString().slice(0,10);
    const direction=index%3===0?'short':'long',entry=200+index,quantity=2,fees=2;
    const openedAt=fromLocalDateTime(day+'T14:00'),closedAt=fromLocalDateTime(day+'T15:30');
    const mistakes=index%5===1?['Ранний выход']:index%7===3?['Вход без сигнала','Пропущен чек-лист']:[];
    return {id:'demo-trade-'+index,title:`${index%2?'AAPL':'DEMO'} · учебный пример`,note:'Вымышленная сделка для знакомства с журналом. Посмотри расчёт результата, сценарий и соблюдение плана.',result:'',date:closedAt,type:'Демонстрация',emotion:index%5===1?'Спешка':'Спокойствие',process:mistakes.length?'Для разбора':'Соблюдены правила',trade:{version:1,symbol:index%2?'AAPL':'DEMO',direction,currency:'USD',entry,exit:entry+(direction==='long'?1:-1)*(net+fees)/quantity,quantity,multiplier:1,fees,stop:entry+(direction==='long'?-10:10),target:entry+(direction==='long'?20:-20),riskMoney:22,openedAt,closedAt,setup:setups[index%3],mistakes,tags:['Вымышленные данные'],source:'manual'}};
  });
  const openedAt=fromLocalDateTime(today+'T10:00');
  entries.push({id:'demo-open',title:'DEMO · открытая позиция',note:'Открытая позиция не входит в статистику закрытых сделок.',result:'',date:openedAt,type:'Демонстрация',emotion:'Спокойствие',process:'Для разбора',trade:{...entries[0].trade,symbol:'DEMO',direction:'long',entry:220,exit:null,stop:210,target:240,openedAt,closedAt:null,setup:'Пробой уровня',mistakes:[]}});
  entries.push({id:'demo-note',title:'Вывод после сессии',note:'На примере видно, как можно отдельно отмечать ранний выход и соблюдение плана. Следующее упражнение — проверить условие выхода до входа.',result:'',date:fromLocalDateTime(today+'T16:00'),type:'Заметка',emotion:'Спокойствие',process:'Для разбора'});
  return entries;
}
