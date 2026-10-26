interface LogoProps {
  className?: string;
  /** Light text and a sky mark, for use on the dark navy header. */
  inverted?: boolean;
}

export function Logo({ className = '', inverted = false }: LogoProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-semibold ${inverted ? 'text-white' : 'text-slate-900'} ${className}`}
    >
      <span
        className={`grid size-7 place-items-center rounded-md text-white ${inverted ? 'bg-accent' : 'bg-brand-600'}`}
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
          <path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" />
        </svg>
      </span>
      MediSchedule
    </span>
  );
}
