import { useState, useEffect } from 'react';

interface VersionInfo {
  local: { hash: string };
  remote: { hash: string; date: string; message: string };
  updateAvailable: boolean;
}

/**
 * Checks for updates against the GitHub repo on mount.
 * Re-checks every 30 minutes while the tab is active.
 */
export function useVersionCheck() {
  const [data, setData] = useState<VersionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/version-check');

        if (res.ok) {
          const json = (await res.json()) as VersionInfo;
          setData(json);
        }
      } catch {
        // Network error — silently ignore
      }
    };

    // Initial check after 10s (don't block startup)
    const initial = setTimeout(check, 10_000);

    // Re-check every 30 minutes
    const interval = setInterval(check, 30 * 60 * 1000);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  return {
    updateAvailable: data?.updateAvailable && !dismissed,
    localHash: data?.local.hash ?? '',
    remoteHash: data?.remote.hash ?? '',
    remoteMessage: data?.remote.message ?? '',
    remoteDate: data?.remote.date ?? '',
    dismiss: () => setDismissed(true),
  };
}
