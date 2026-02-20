import type { Message } from 'ai';
import { createScopedLogger } from '~/utils/logger';
import type { ProjectVersion } from '~/lib/stores/versions';
import type { PersistenceAdapter, ChatHistoryItem, IChatMetadata, Snapshot } from './types';

const logger = createScopedLogger('ServerAdapter');

export class ServerAdapter implements PersistenceAdapter {
  isAvailable(): boolean {
    return true; // Always available if backend is up
  }

  private async rpc<T>(action: string, payload: any = {}): Promise<T> {
    try {
      const response = await fetch('/api/persistence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });

      if (!response.ok) {
        throw new Error(`RPC ${action} failed with status: ${response.status}`);
      }

      const result = await response.json();
      return result.data as T;
    } catch (error) {
      logger.error(`Error in ServerAdapter RPC '${action}':`, error);
      throw error;
    }
  }

  async getAll(): Promise<ChatHistoryItem[]> {
    return this.rpc<ChatHistoryItem[]>('getAll');
  }

  async getMessages(id: string): Promise<ChatHistoryItem> {
    return this.rpc<ChatHistoryItem>('getMessages', { id });
  }

  async setMessages(
    id: string,
    messages: Message[],
    urlId?: string,
    description?: string,
    timestamp?: string,
    metadata?: IChatMetadata,
  ): Promise<void> {
    await this.rpc<void>('setMessages', { id, messages, urlId, description, timestamp, metadata });
  }

  async deleteById(id: string): Promise<void> {
    await this.rpc<void>('deleteById', { id });
  }

  async getNextId(): Promise<string> {
    return this.rpc<string>('getNextId');
  }

  async getUrlId(id: string): Promise<string> {
    return this.rpc<string>('getUrlId', { id });
  }

  async forkChat(chatId: string, messageId: string): Promise<string> {
    return this.rpc<string>('forkChat', { chatId, messageId });
  }

  async duplicateChat(id: string): Promise<string> {
    return this.rpc<string>('duplicateChat', { id });
  }

  async createChatFromMessages(description: string, messages: Message[], metadata?: IChatMetadata): Promise<string> {
    return this.rpc<string>('createChatFromMessages', { description, messages, metadata });
  }

  async updateChatDescription(id: string, description: string): Promise<void> {
    await this.rpc<void>('updateChatDescription', { id, description });
  }

  async updateChatMetadata(id: string, metadata: IChatMetadata | undefined): Promise<void> {
    await this.rpc<void>('updateChatMetadata', { id, metadata });
  }

  async getSnapshot(chatId: string): Promise<Snapshot | undefined> {
    return this.rpc<Snapshot | undefined>('getSnapshot', { chatId });
  }

  async setSnapshot(chatId: string, snapshot: Snapshot): Promise<void> {
    await this.rpc<void>('setSnapshot', { chatId, snapshot });
  }

  async deleteSnapshot(chatId: string): Promise<void> {
    await this.rpc<void>('deleteSnapshot', { chatId });
  }

  async saveVersions(chatId: string, versions: ProjectVersion[]): Promise<void> {
    await this.rpc<void>('saveVersions', { chatId, versions });
  }

  async getVersionsByChatId(chatId: string): Promise<ProjectVersion[] | undefined> {
    return this.rpc<ProjectVersion[] | undefined>('getVersionsByChatId', { chatId });
  }
}
