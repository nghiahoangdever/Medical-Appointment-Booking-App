import { ArrowPathIcon } from '@heroicons/react/20/solid';
import { errorMessage } from '../i18n/errors';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';

/** A failed load: the translated error plus a "Thử lại" button when the caller can retry. */
export function LoadError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Alert>
      <div className="flex items-center justify-between gap-4">
        <span>{errorMessage(error)}</span>
        {onRetry && (
          <Button variant="secondary" size="sm" icon={ArrowPathIcon} onClick={onRetry}>
            Thử lại
          </Button>
        )}
      </div>
    </Alert>
  );
}
