import { useCallback, useState } from 'react';

/**
 * Runs one mutation at a time and remembers its error. `run` resolves to the result, or to
 * undefined if the call failed (the error is then in `error`).
 */
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const run = useCallback(async <T>(call: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await call();
    } catch (err) {
      setError(err);
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);

  return { run, busy, error, setError };
}
