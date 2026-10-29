// NEW. The queue number (STT) is the signature element: a turmeric "ticket" with a darker folded
// lower-right corner (echoes the logo), "STT" eyebrow, bold tabular numerals. Muted once finished.
// Use: AppointmentCard summary (sm), DoctorQueue "next patient" (md), BookingSuccess (lg).

const SIZES = {
  sm: {
    box: 'min-w-12 h-11 rounded-lg',
    num: 'text-xl',
    label: 'text-[10px]',
    fold: 12,
    gap: 'mt-0.5',
  },
  md: {
    box: 'min-w-[72px] h-[68px] rounded-[10px]',
    num: 'text-[32px]',
    label: 'text-[11px]',
    fold: 19,
    gap: 'mt-0.5',
  },
  lg: {
    box: 'min-w-[152px] h-[136px] rounded-[14px]',
    num: 'text-[72px]',
    label: 'text-[13px]',
    fold: 38,
    gap: 'mt-1.5',
  },
} as const;

interface QueueNumberProps {
  value: number | string;
  size?: keyof typeof SIZES;
  label?: string;
  muted?: boolean;
}

export function QueueNumber({
  value,
  size = 'md',
  label = 'STT',
  muted = false,
}: QueueNumberProps) {
  const s = SIZES[size];
  return (
    <span
      aria-label={`Số thứ tự ${value}`}
      className={`relative inline-flex shrink-0 flex-col items-center justify-center overflow-hidden px-2 ${s.box} ${
        muted ? 'bg-slate-100 text-slate-500' : 'text-queue-fg'
      }`}
      style={
        muted
          ? undefined
          : {
              background: `linear-gradient(135deg, var(--color-queue) calc(100% - ${s.fold}px), var(--color-queue-edge) calc(100% - ${s.fold}px))`,
            }
      }
    >
      <span
        aria-hidden="true"
        className={`font-semibold uppercase leading-none tracking-[0.05em] opacity-80 ${s.label}`}
      >
        {label}
      </span>
      <span
        aria-hidden="true"
        className={`tabular font-bold leading-none tracking-[-0.02em] ${s.num} ${s.gap}`}
      >
        {value}
      </span>
    </span>
  );
}
