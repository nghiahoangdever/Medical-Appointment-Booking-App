import type { ReactNode } from 'react';
import { Link } from 'react-router';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** "← label" link shown above the title. */
  back?: { to: string; label: string };
}

export function PageHeader({ title, subtitle, actions, back }: PageHeaderProps) {
  return (
    <div className="mb-6">
      {back && <BackLink to={back.to} label={back.label} />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="mb-3 inline-block text-sm text-brand-700">
      ← {label}
    </Link>
  );
}
