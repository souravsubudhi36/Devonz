import type { Message } from 'ai';
import { createScopedLogger } from '~/utils/logger';
import type { ProjectVersion } from '~/lib/stores/versions';
import type { PersistenceAdapter, ChatHistoryItem, IChatMetadata, Snapshot } from './types';

const logger = createScopedLogger('Database');

export class IndexedDBAdapter implements PersistenceAdapter {
  private db: IDBDatabase | undefined;
  private initializing: Promise<IDBDatabase | undefined> | null = null;

  isAvailable(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    if (!this.initializing) {
      this.initializing = new Promise((resolve) => {
        if (!this.isAvailable()) {
          logger.error('indexedDB is not available in this environment.');
          resolve(undefined);
          return;
        }

        const request = indexedDB.open('boltHistory', 3);

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const oldVersion = event.oldVersion;

          if (oldVersion < 1) {
            if (!db.objectStoreNames.contains('chats')) {
              const store = db.createObjectStore('chats', { keyPath: 'id' });
              store.createIndex('id', 'id', { unique: true });
              store.createIndex('urlId', 'urlId', { unique: true });
            }
          }

          if (oldVersion < 2) {
            if (!db.objectStoreNames.contains('snapshots')) {
              db.createObjectStore('snapshots', { keyPath: 'chatId' });
            }
          }

          if (oldVersion < 3) {
            if (!db.objectStoreNames.contains('versions')) {
              db.createObjectStore('versions', { keyPath: 'chatId' });
            }
          }
        };

        request.onsuccess = (event: Event) => {
          this.db = (event.target as IDBOpenDBRequest).result;
          resolve(this.db);
        };

        request.onerror = (event: Event) => {
          resolve(undefined);
          logger.error((event.target as IDBOpenDBRequest).error);
        };
      });
    }

    const db = await this.initializing;
    if (!db) {
      throw new Error('IndexedDB initialization failed');
    }

    return db;
  }

  async getAll(): Promise<ChatHistoryItem[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('chats', 'readonly');
      const store = transaction.objectStore('chats');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as ChatHistoryItem[]);
      request.onerror = () => reject(request.error);
    });
  }

  async setMessages(
    id: string,
    messages: Message[],
    urlId?: string,
    description?: string,
    timestamp?: string,
    metadata?: IChatMetadata,
  ): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('chats', 'readwrite');
      const store = transaction.objectStore('chats');

      if (timestamp && isNaN(Date.parse(timestamp))) {
        reject(new Error('Invalid timestamp'));
        return;
      }

      const request = store.put({
        id,
        messages,
        urlId,
        description,
        timestamp: timestamp ?? new Date().toISOString(),
        metadata,
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMessages(id: string): Promise<ChatHistoryItem> {
    const db = await this.getDB();
    const byId = await this.getMessagesById(db, id);
    if (byId) return byId;
    return this.getMessagesByUrlId(db, id);
  }

  private async getMessagesByUrlId(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('chats', 'readonly');
      const store = transaction.objectStore('chats');
      const index = store.index('urlId');
      const request = index.get(id);

      request.onsuccess = () => resolve(request.result as ChatHistoryItem);
      request.onerror = () => reject(request.error);
    });
  }

  private async getMessagesById(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('chats', 'readonly');
      const store = transaction.objectStore('chats');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result as ChatHistoryItem);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteById(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['chats', 'snapshots', 'versions'], 'readwrite');

      transaction.objectStore('chats').delete(id);
      transaction.objectStore('snapshots').delete(id);
      transaction.objectStore('versions').delete(id);

      transaction.oncomplete = () => resolve(undefined);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getNextId(): Promise<string> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('chats', 'readonly');
      const store = transaction.objectStore('chats');
      const request = store.getAllKeys();

      request.onsuccess = () => {
        const highestId = request.result.reduce((cur, acc) => Math.max(+cur, +acc), 0);
        resolve(String(+highestId + 1));
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getUrlId(id: string): Promise<string> {
    const db = await this.getDB();
    const idList = await this.getUrlIds(db);

    if (!idList.includes(id)) {
      return id;
    } else {
      let i = 2;

      while (idList.includes(`${id}-${i}`)) {
        i++;
      }

      return `${id}-${i}`;
    }
  }

  private async getUrlIds(db: IDBDatabase): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('chats', 'readonly');
      const store = transaction.objectStore('chats');
      const idList: string[] = [];

      const request = store.openCursor();

      request.onsuccess = (event: Event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (cursor) {
          idList.push(cursor.value.urlId);
          cursor.continue();
        } else {
          resolve(idList);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async forkChat(chatId: string, messageId: string): Promise<string> {
    const chat = await this.getMessages(chatId);

    if (!chat) {
      throw new Error('Chat not found');
    }

    const messageIndex = chat.messages.findIndex((msg) => msg.id === messageId);

    if (messageIndex === -1) {
      throw new Error('Message not found');
    }

    const messages = chat.messages.slice(0, messageIndex + 1);

    return this.createChatFromMessages(chat.description ? `${chat.description} (fork)` : 'Forked chat', messages);
  }

  async duplicateChat(id: string): Promise<string> {
    const chat = await this.getMessages(id);

    if (!chat) {
      throw new Error('Chat not found');
    }

    return this.createChatFromMessages(`${chat.description || 'Chat'} (copy)`, chat.messages);
  }

  async createChatFromMessages(
    description: string,
    messages: Message[],
    metadata?: IChatMetadata,
  ): Promise<string> {
    const newId = await this.getNextId();
    const newUrlId = await this.getUrlId(newId);

    await this.setMessages(
      newId,
      messages,
      newUrlId,
      description,
      undefined,
      metadata,
    );

    return newUrlId;
  }

  async updateChatDescription(id: string, description: string): Promise<void> {
    const chat = await this.getMessages(id);

    if (!chat) {
      throw new Error('Chat not found');
    }

    if (!description.trim()) {
      throw new Error('Description cannot be empty');
    }

    await this.setMessages(id, chat.messages, chat.urlId, description, chat.timestamp, chat.metadata);
  }

  async updateChatMetadata(id: string, metadata: IChatMetadata | undefined): Promise<void> {
    const chat = await this.getMessages(id);

    if (!chat) {
      throw new Error('Chat not found');
    }

    await this.setMessages(id, chat.messages, chat.urlId, chat.description, chat.timestamp, metadata);
  }

  async getSnapshot(chatId: string): Promise<Snapshot | undefined> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('snapshots', 'readonly');
      const store = transaction.objectStore('snapshots');
      const request = store.get(chatId);

      request.onsuccess = () => resolve(request.result?.snapshot as Snapshot | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  async setSnapshot(chatId: string, snapshot: Snapshot): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('snapshots', 'readwrite');
      const store = transaction.objectStore('snapshots');
      const request = store.put({ chatId, snapshot });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteSnapshot(chatId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('snapshots', 'readwrite');
      const store = transaction.objectStore('snapshots');
      const request = store.delete(chatId);

      request.onsuccess = () => resolve();

      request.onerror = (event) => {
        if ((event.target as IDBRequest).error?.name === 'NotFoundError') {
          resolve();
        } else {
          reject(request.error);
        }
      };
    });
  }

  async saveVersions(chatId: string, versions: ProjectVersion[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('versions', 'readwrite');
      const store = transaction.objectStore('versions');
      const request = store.put({ chatId, versions });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getVersionsByChatId(chatId: string): Promise<ProjectVersion[] | undefined> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('versions', 'readonly');
      const store = transaction.objectStore('versions');
      const request = store.get(chatId);

      request.onsuccess = () => resolve(request.result?.versions as ProjectVersion[] | undefined);
      request.onerror = () => reject(request.error);
    });
  }
}
