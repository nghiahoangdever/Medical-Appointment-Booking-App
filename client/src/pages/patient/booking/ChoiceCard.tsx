import type { ReactNode } from 'react';

interface ChoiceCardProps {
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}

/** A large selectable tile used by the booking wizard steps. */
export function ChoiceCard({
  selected,
  disabled,
  onClick,
  children,
  className = '',
}: ChoiceCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`rounded-xl bg-white p-4 text-left ring-1 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 ${
        selected
          ? 'bg-brand-50 ring-2 ring-brand-600'
          : 'ring-slate-200 hover:ring-brand-400 disabled:hover:ring-slate-200'
      } ${className}`}
    >
      {children}
    </button>
  );
}
