import React, { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { shuffle } from './store';

export function shuffledQuestion(question) {
  const order = shuffle(question.options.map((_, index) => index));
  return { ...question, options: order.map(index => question.options[index]), answer: order.indexOf(question.answer) };
}
export default function LessonQuiz({ questions, onComplete, completeLabel }) {
  const [bank, setBank] = useState(() => shuffle(questions).map(shuffledQuestion));
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState(null);
  const [checked, setChecked] = useState(false);
  const [finished, setFinished] = useState(false);
  const question = bank[index];
  const correct = checked && choice === question.answer;
  const next = () => {
    if (index === bank.length - 1) setFinished(true);
    else { setIndex(value => value + 1); setChoice(null); setChecked(false); }
  };
  const retry = () => {
    setBank(value => value.map((item, at) => at === index ? shuffledQuestion(item) : item));
    setChoice(null); setChecked(false);
  };
  if (finished) return <section className="quiz-card"><span className="eyebrow">ПРОВЕРКА ЗАВЕРШЕНА</span><h2>Обе ситуации разобраны</h2><p>Ты применил принцип к двум разным примерам. Позже проверь себя ещё раз в экзамене: там вопросы выбираются случайно.</p><button className="primary" onClick={onComplete}>{completeLabel} <ArrowRight size={17}/></button></section>;
  return <section className="quiz-card"><span className="eyebrow">СИТУАЦИЯ {index + 1} ИЗ {bank.length}</span><p className="footnote">Выбери действие и сверь объяснение. Для завершения урока нужно верно разобрать каждую ситуацию.</p><h2>{question.question}</h2><div className="quiz-options">{question.options.map((option, at) => <button key={option} disabled={checked} className={(choice === at ? 'chosen ' : '') + (checked && at === question.answer ? 'correct ' : '') + (checked && choice === at && !correct ? 'wrong' : '')} onClick={() => setChoice(at)}><span>{String.fromCharCode(65 + at)}</span>{option}{checked && at === question.answer && <Check size={18}/>}</button>)}</div>{!checked ? <button className="primary" disabled={choice === null} onClick={() => setChecked(true)}>Проверить ответ</button> : <div className={'quiz-feedback ' + (correct ? 'success' : 'retry')} role="status"><b>{correct ? 'Верно. Разберём почему.' : 'Есть важный нюанс.'}</b><p>{question.feedback}</p><button className={correct ? 'primary' : 'secondary'} onClick={correct ? next : retry}>{correct ? index === bank.length - 1 ? 'Завершить проверку' : 'Следующая ситуация' : 'Попробовать ещё раз'} <ArrowRight size={17}/></button></div>}</section>;
}
