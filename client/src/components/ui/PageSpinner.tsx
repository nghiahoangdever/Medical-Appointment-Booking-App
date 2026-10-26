export function PageSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status">
      <span className="size-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      <span className="sr-only">Đang tải…</span>
    </div>
  );
}
