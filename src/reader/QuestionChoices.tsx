import { useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import type { Option } from './model.ts';
import './choices.css';

type Props = {
  questionId: string;
  options: Option[];
  selected: string | null;
  onSelect: (id: string) => void;
  onConfirm: (id: string) => void;
  onReveal?: () => void;
  testIdPrefix?: string;
};

export default function QuestionChoices({ questionId, options, selected, onSelect, onConfirm, onReveal, testIdPrefix }: Props) {
  const fieldset = useRef<HTMLFieldSetElement>(null);
  const selection = options.findIndex(option => option.id === selected);
  return <>
    <fieldset ref={fieldset} className="question-choices" onKeyDown={event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      const index = ['1', '2', '3'].indexOf(event.key);
      if (index >= 0 && options[index]) {
        event.preventDefault();
        onSelect(options[index].id);
        const input = fieldset.current?.querySelectorAll<HTMLInputElement>('input')[index];
        input?.focus({ preventScroll: true });
        input?.closest('label')?.scrollIntoView({ block: 'start', behavior: 'instant' });
      } else if (event.key === 'Enter' && selection >= 0) {
        event.preventDefault();
        onConfirm(options[selection].id);
      }
    }}>
      <legend className="sr-only">选择一个追问</legend>
      {options.map((option, index) => <label className={`option ${selected === option.id ? 'selected' : ''}`} key={option.id}>
        <input type="radio" name={questionId} value={option.id} checked={selected === option.id} onChange={() => onSelect(option.id)} />
        <span className="option-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span><span>{option.text}</span>
      </label>)}
    </fieldset>
    <div className="question-actions choice-actions">
      <div className="choice-selection" role="status">{selection < 0 ? '先选一个问法' : `已选 ${String.fromCharCode(65 + selection)}，确认前可以修改`}<span className="choice-keyboard">选项内：1–3 选择，Enter 确认</span></div>
      <button className="primary" disabled={selection < 0} onClick={() => selection >= 0 && onConfirm(options[selection].id)} data-testid={testIdPrefix ? `${testIdPrefix}-confirm` : undefined}>确认选择 <ArrowRight size={17} /></button>
      {onReveal && <button className="text-button" onClick={onReveal} data-testid={testIdPrefix ? `${testIdPrefix}-reveal` : undefined}>直接看原文</button>}
    </div>
  </>;
}
