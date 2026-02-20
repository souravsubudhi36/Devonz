import { IndexedDBAdapter } from './IndexedDBAdapter';
import { ServerAdapter } from './ServerAdapter';
import type { PersistenceAdapter } from './types';

// Accessing the Vite env var or defaulting to indexeddb
export const storageProvider = (import.meta.env?.VITE_STORAGE_PROVIDER || 'indexeddb').toLowerCase();
export const persistenceEnabled = !import.meta.env?.VITE_DISABLE_PERSISTENCE;

export const chatPersistence: PersistenceAdapter | undefined = persistenceEnabled
  ? storageProvider === 'postgres' || storageProvider === 'supabase'
    ? new ServerAdapter()
    : new IndexedDBAdapter()
  : undefined;
