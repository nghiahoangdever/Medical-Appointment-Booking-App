import type { ReactNode } from 'react';
import { Logo } from '../../components/Logo';

/** Centered card used by the login and register pages. */
export function AuthCard({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Logo size="lg" tagline />
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="mb-5 text-xl font-semibold text-slate-900">{title}</h1>
          {children}
        </div>
        {footer && <div className="mt-4 text-center text-sm text-slate-700">{footer}</div>}
      </div>
    </main>
  );
}
