import { ArrowPathIcon } from '@heroicons/react/20/solid';
import { Button } from './ui/Button';

export function RefreshButton({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  // Not Button's `loading`: the arrow itself spins, so the label stays put while refreshing.
  return (
    <Button variant="secondary" size="sm" onClick={onClick} disabled={loading} aria-busy={loading}>
      <ArrowPathIcon aria-hidden="true" className={`size-4 ${loading ? 'animate-spin' : ''}`} />
      Làm mới
    </Button>
  );
}
