// Small building blocks shared by the admin management pages (desktop layout).

import type { ReactNode } from 'react';
import { activeLabel } from '../../i18n/labels';

export function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
        isActive
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
          : 'bg-slate-100 text-slate-500 ring-slate-200'
      }`}
    >
      {activeLabel(isActive)}
    </span>
  );
}

/** Table on the left, create/edit form on the right. */
export function ListWithForm({ list, form }: { list: ReactNode; form: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_380px] items-start gap-6">
      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">{list}</div>
      <div className="sticky top-4 rounded-xl bg-white p-5 ring-1 ring-slate-200">{form}</div>
    </div>
  );
}

export function Th({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={`bg-slate-50 px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm text-slate-800 ${className}`}>{children}</td>;
}

/** Text-style button for row actions. */
export function RowAction({
  onClick,
  children,
  tone = 'default',
  disabled,
}: {
  onClick: () => void;
  children: ReactNode;
  tone?: 'default' | 'danger';
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-sm font-medium hover:underline disabled:opacity-50 ${
        tone === 'danger' ? 'text-rose-700' : 'text-teal-700'
      }`}
    >
      {children}
    </button>
  );
}
