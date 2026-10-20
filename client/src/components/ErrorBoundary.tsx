import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/Button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches rendering errors so a bug shows a Vietnamese message with a way out instead of a
 * blank page. Give it a `key` (e.g. the path) to reset it when the user navigates.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="mx-auto mt-16 max-w-md rounded-xl bg-white p-6 text-center ring-1 ring-slate-200">
        <p className="text-lg font-semibold text-slate-900">Đã có lỗi khi hiển thị trang này.</p>
        <p className="mt-2 text-sm text-slate-500">
          Vui lòng tải lại trang. Nếu lỗi vẫn tiếp diễn, hãy quay về trang chủ.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={() => window.location.reload()}>Tải lại trang</Button>
          <Button variant="secondary" onClick={() => window.location.assign('/')}>
            Về trang chủ
          </Button>
        </div>
      </div>
    );
  }
}
