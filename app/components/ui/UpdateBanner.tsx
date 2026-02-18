import { useVersionCheck } from '~/lib/hooks/useVersionCheck';

/**
 * Non-intrusive banner that appears when a newer commit exists on main.
 * Shows update instructions for both Git Clone and Docker users.
 */
export function UpdateBanner() {
  const { updateAvailable, localHash, remoteHash, remoteMessage, dismiss } = useVersionCheck();

  if (!updateAvailable) {
    return null;
  }

  return (
    <div
      className="flex items-center justify-between px-4 py-2 text-xs border-b"
      style={{ backgroundColor: '#1a2332', borderColor: '#2a3a4a' }}
    >
      <div className="flex items-center gap-2 text-blue-300">
        <span className="i-ph:arrow-circle-up text-base text-blue-400" />
        <span>
          <strong>Update available</strong>
          <span className="text-blue-400/70 ml-2">
            {localHash} → {remoteHash}
          </span>
          {remoteMessage && <span className="text-blue-400/50 ml-2">— {remoteMessage}</span>}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-blue-400/60">
          Git: <code className="bg-blue-900/30 px-1 rounded">pnpm run update</code> | Docker:{' '}
          <code className="bg-blue-900/30 px-1 rounded">docker compose pull && docker compose up -d</code>
        </span>
        <button
          onClick={dismiss}
          className="text-blue-400/60 hover:text-blue-300 transition-colors"
          aria-label="Dismiss update notification"
        >
          <span className="i-ph:x text-sm" />
        </button>
      </div>
    </div>
  );
}
