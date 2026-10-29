import {
  ArrowRightEndOnRectangleIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  PlayCircleIcon,
  UserMinusIcon,
  XCircleIcon,
} from '@heroicons/react/20/solid';
import type { ComponentType, SVGProps } from 'react';
import { STATUS_LABEL } from '../i18n/labels';
import type { AppointmentStatus } from '../types';

// Status = tint + icon + label. Never colour alone. IN_EXAMINATION is the only filled badge ("now").
const META: Record<
  AppointmentStatus,
  { cls: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }
> = {
  BOOKED: { cls: 'bg-st-booked-bg text-st-booked-fg ring-st-booked-ring', Icon: CalendarDaysIcon },
  CHECKED_IN: {
    cls: 'bg-st-checkedin-bg text-st-checkedin-fg ring-st-checkedin-ring',
    Icon: ArrowRightEndOnRectangleIcon,
  },
  IN_EXAMINATION: {
    cls: 'bg-st-inexam-bg text-st-inexam-fg ring-st-inexam-ring',
    Icon: PlayCircleIcon,
  },
  COMPLETED: {
    cls: 'bg-st-completed-bg text-st-completed-fg ring-st-completed-ring',
    Icon: CheckCircleIcon,
  },
  CANCELLED: {
    cls: 'bg-st-cancelled-bg text-st-cancelled-fg ring-st-cancelled-ring',
    Icon: XCircleIcon,
  },
  NO_SHOW: { cls: 'bg-st-noshow-bg text-st-noshow-fg ring-st-noshow-ring', Icon: UserMinusIcon },
};

export function StatusBadge({
  status,
  size = 'md',
}: {
  status: AppointmentStatus;
  size?: 'sm' | 'md';
}) {
  const { cls, Icon } = META[status];
  const sm = size === 'sm';
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-medium ring-1 ring-inset ${
        sm ? 'py-px pr-2 pl-1.5 text-[11px] leading-4' : 'py-0.5 pr-2.5 pl-1.5 text-xs'
      } ${cls}`}
    >
      <Icon aria-hidden="true" className={sm ? 'size-3' : 'size-3.5'} />
      {STATUS_LABEL[status]}
    </span>
  );
}
