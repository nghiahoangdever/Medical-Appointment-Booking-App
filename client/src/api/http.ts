import { tokenStorage } from '../auth/tokenStorage';

export interface FieldError {
  path: string;
  code: string;
}

/**
 * Error thrown for any non-2xx response. `code` (and each detail's `code`) is what the UI
 * translates (see i18n/errors.ts); `message` is the server's English text, for debugging only.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: FieldError[];

  constructor(status: number, code: string, message: string, details: FieldError[] = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type UnauthorizedHandler = (code: string) => void;
let onUnauthorized: UnauthorizedHandler | null = null;

/**
 * Called when a logged-in request gets 401 (token expired/invalid) or ACCOUNT_DISABLED
 * (deactivated), with the error code.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = tokenStorage.get();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server');
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error;
    // The session is over: token expired/invalid, or the account was deactivated meanwhile.
    if (token && (res.status === 401 || err?.code === 'ACCOUNT_DISABLED')) {
      onUnauthorized?.(err?.code ?? 'INVALID_TOKEN');
    }
    throw new ApiError(
      res.status,
      err?.code ?? (res.status >= 500 ? 'INTERNAL_ERROR' : 'UNKNOWN_ERROR'),
      err?.message ?? `Request failed (${res.status})`,
      err?.details ?? [],
    );
  }
  return data as T;
}

export const http = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
