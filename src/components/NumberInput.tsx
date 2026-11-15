import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number;
  onCommit: (value: number) => boolean;
};

/** Let a user finish typing a number before validating the experiment. */
export default function NumberInput({ value, onCommit, ...props }: Props) {
  const [draft, setDraft] = useState(String(value));
  const cancelNextBlur = useRef(false);
  useEffect(() => setDraft(String(value)), [value]);

  function commit() {
    if (cancelNextBlur.current) {
      cancelNextBlur.current = false;
      return;
    }
    if (draft.trim() === '') {
      setDraft(String(value));
      return;
    }
    const next = Number(draft);
    if (next === value || !onCommit(next)) setDraft(String(value));
  }

  return (
    <input
      {...props}
      type="number"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === 'Escape') {
          cancelNextBlur.current = true;
          setDraft(String(value));
          event.currentTarget.blur();
        }
      }}
    />
  );
}
