import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/20/solid';
import type { ReactNode } from 'react';

const TONES = {
  error: {
    cls: 'bg-tone-error-bg text-tone-error-fg ring-tone-error-ring',
    Icon: ExclamationTriangleIcon,
  },
  info: {
    cls: 'bg-tone-info-bg text-tone-info-fg ring-tone-info-ring',
    Icon: InformationCircleIcon,
  },
  success: {
    cls: 'bg-tone-success-bg text-tone-success-fg ring-tone-success-ring',
    Icon: CheckCircleIcon,
  },
  warning: {
    cls: 'bg-tone-warning-bg text-tone-warning-fg ring-tone-warning-ring',
    Icon: ExclamationTriangleIcon,
  },
};

export function Alert({
  tone = 'error',
  children,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
}) {
  const { cls, Icon } = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2 rounded-lg px-4 py-3 text-sm ring-1 ring-inset ${cls}`}
    >
      <Icon aria-hidden="true" className="size-5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
