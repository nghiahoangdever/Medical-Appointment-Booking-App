import type { ButtonHTMLAttributes, ComponentType, SVGProps } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

// primary = the one forward action per region; secondary = everything else;
// ghost = text-like; danger = only inside a confirm step.
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700',
  secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50',
  ghost: 'bg-transparent text-brand-700 hover:bg-brand-50',
  danger: 'bg-danger text-white hover:bg-danger-hover',
};
const SIZES: Record<Size, string> = {
  sm: 'gap-1.5 px-3 py-1.5 text-xs',
  md: 'gap-2 px-4 py-2 text-sm',
  lg: 'gap-2 px-5 py-3 text-base',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
  /** Icon-only square button — must also pass aria-label. */
  square?: boolean;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  block = false,
  square = false,
  icon: Icon,
  disabled,
  className = '',
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60 ${SIZES[size]} ${
        square ? 'px-2' : ''
      } ${block ? 'w-full' : ''} ${VARIANTS[variant]} ${className}`}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        Icon && <Icon aria-hidden="true" className="size-4" />
      )}
      {children}
    </button>
  );
}
