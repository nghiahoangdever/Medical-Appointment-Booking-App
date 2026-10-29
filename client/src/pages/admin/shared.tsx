// Small building blocks shared by the admin management pages (desktop layout).

import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/20/solid';
import type { ReactNode } from 'react';
import { activeLabel } from '../../i18n/labels';

export function ActiveBadge({ isActive }: { isActive: boolean }) {
  const Icon = isActive ? CheckCircleIcon : XCircleIcon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full py-0.5 pr-2.5 pl-1.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${
        isActive
          ? 'bg-st-completed-bg text-st-completed-fg ring-st-completed-ring'
          : 'bg-st-cancelled-bg text-st-cancelled-fg ring-st-cancelled-ring'
      }`}
    >
      <Icon aria-hidden="true" className="size-3.5" />
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

/** Screen-reader caption naming a table. */
export function Caption({ children }: { children: ReactNode }) {
  return <caption className="sr-only">{children}</caption>;
}

export function Th({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`border-b border-slate-200 bg-slate-25 px-4 py-3 text-left text-xs font-semibold tracking-[0.05em] whitespace-nowrap text-slate-500 uppercase ${className}`}
    >
      {children ?? <span className="sr-only">Thao tác</span>}
    </th>
  );
}

export function Td({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <td className={`border-t border-slate-100 px-4 py-3 text-sm text-slate-900 ${className}`}>
      {children}
    </td>
  );
}

/** Background of the row being edited in the form. */
export const SELECTED_ROW = 'bg-brand-50';

/** Single table row shown when a list has nothing to display yet. */
export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-slate-500">
        {message}
      </td>
    </tr>
  );
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
      className={`rounded py-0.5 text-sm font-medium whitespace-nowrap hover:underline disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === 'danger' ? 'text-danger' : 'text-brand-700'
      }`}
    >
      {children}
    </button>
  );
}
