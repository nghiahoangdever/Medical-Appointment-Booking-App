import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="tabular text-5xl font-semibold text-brand-700">404</p>
      <p className="text-slate-600">Trang này không tồn tại.</p>
      <Link to="/" className="font-medium text-brand-700 hover:underline">
        Về trang chủ
      </Link>
    </div>
  );
}
