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
  selected = false,
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
      className={`w-full rounded-xl p-4 text-left ring-inset transition-[box-shadow,background-color] duration-150 disabled:cursor-not-allowed disabled:bg-slate-25 disabled:opacity-60 ${
        selected
          ? 'bg-brand-50 ring-2 ring-brand-600'
          : 'bg-white ring-1 ring-slate-200 hover:ring-brand-400 disabled:hover:ring-slate-200'
      } ${className}`}
    >
      {children}
    </button>
  );
}
