export function PageSpinner() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3" role="status">
      <span
        aria-hidden="true"
        className="size-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent"
      />
      <span className="text-sm text-slate-500">Đang tải…</span>
    </div>
  );
}
