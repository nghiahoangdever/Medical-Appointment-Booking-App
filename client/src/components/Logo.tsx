// Replaces the old medical-cross Logo. "Queue Fold" mark + two-tone wordmark.
// Primary identity = palette-adaptive (follows data-theme). variant="original" = supplied navy/blue artwork.

const BODY =
  'M45 14 C40 14 36 18 36 23 L36 29 L33 29 C19 29 14 39 14 52 L14 100 C14 111 23 118 33 118 L93 118 C104 118 113 109 113 98 L113 51 C113 38 103 29 92 29 L89 29 L89 23 C89 18 85 14 81 14 C76 14 73 18 73 23 L73 29 L52 29 L52 23 C52 18 49 14 45 14 Z';
const M =
  'M30 98 L30 59 C30 46 39 44 48 44 C54 44 59 49 64 54 L67 57 L70 54 C75 48 79 44 86 44 C96 44 100 51 100 61 L100 96 L83 96 L83 65 C83 62 81 60 78 60 C76 60 74 61 71 64 L67 68 L63 64 C60 61 58 60 56 60 C52 60 50 62 50 67 L50 98 Z';
const NOTCH = 'M58 72 C61 66 64 65 67 65 C70 65 73 66 76 72 L76 111 L58 111 Z';
const FOLD = 'M69 79 C87 79 98 83 106 91 C111 96 113 104 113 118 L69 118 Z';

type Variant = 'adaptive' | 'original';

function colors(variant: Variant, inverted: boolean) {
  if (variant === 'original') return { body: '#173D7A', m: '#FFFFFF', fold: '#4B8CFF' };
  return inverted
    ? { body: '#FFFFFF', m: 'var(--color-brand-800)', fold: 'var(--color-queue)' }
    : { body: 'var(--color-brand-800)', m: '#FFFFFF', fold: 'var(--color-queue)' };
}

export function LogoMark({
  size = 28,
  variant = 'adaptive',
  inverted = false,
}: {
  size?: number;
  variant?: Variant;
  inverted?: boolean;
}) {
  const c = colors(variant, inverted);
  const tile = variant === 'original' && inverted;
  const inner = tile ? Math.round(size * 0.8) : size;
  const svg = (
    <svg
      viewBox="0 0 128 128"
      width={inner}
      height={inner}
      aria-hidden="true"
      className="block shrink-0"
    >
      <path d={BODY} fill={c.body} />
      <path d={M} fill={c.m} />
      <path d={NOTCH} fill={c.body} />
      <path d={FOLD} fill={c.fold} />
    </svg>
  );
  if (!tile) return svg;
  return (
    <span
      className="inline-grid shrink-0 place-items-center bg-white"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.24) }}
    >
      {svg}
    </span>
  );
}

const SIZE = {
  sm: { mark: 22, text: 'text-[15px]' },
  md: { mark: 28, text: 'text-[17px]' },
  lg: { mark: 40, text: 'text-2xl' },
};

interface LogoProps {
  size?: keyof typeof SIZE;
  variant?: Variant;
  inverted?: boolean;
  tagline?: boolean;
}

export function Logo({
  size = 'md',
  variant = 'adaptive',
  inverted = false,
  tagline = false,
}: LogoProps) {
  const s = SIZE[size];
  const orig = variant === 'original';
  const a = inverted ? 'text-white' : orig ? 'text-[#173D7A]' : 'text-brand-800';
  const b = inverted
    ? orig
      ? 'text-[#9CC0FF]'
      : 'text-brand-200'
    : orig
      ? 'text-[#4B8CFF]'
      : 'text-brand-500';
  return (
    <span role="img" aria-label="MediSchedule" className="inline-flex items-center gap-2">
      <LogoMark size={s.mark} variant={variant} inverted={inverted} />
      <span aria-hidden="true" className="flex flex-col">
        <span className={`whitespace-nowrap font-bold leading-[1.1] tracking-[-0.015em] ${s.text}`}>
          <span className={a}>Medi</span>
          <span className={b}>Schedule</span>
        </span>
        {tagline && (
          <span className={`mt-0.5 text-xs ${inverted ? 'text-white/80' : 'text-slate-500'}`}>
            Đặt lịch nhẹ nhàng, khám đúng lượt.
          </span>
        )}
      </span>
    </span>
  );
}
