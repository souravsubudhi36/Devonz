import type { Message } from 'ai';
import { createScopedLogger } from '~/utils/logger';
import type { ChatHistoryItem, IChatMetadata, Snapshot } from './types';
import type { ProjectVersion } from '~/lib/stores/versions';
import { chatPersistence } from './factory';

export type { IChatMetadata };
const logger = createScopedLogger('DatabaseFacade');

// Use this to check if persistence is available rather than real IDBDatabase
export async function openDatabase(): Promise<any | undefined> {
  if (chatPersistence && chatPersistence.isAvailable()) {
    return { _dummy: true };
  }
  return undefined;
}

export async function getAll(db: any): Promise<ChatHistoryItem[]> {
  if (!chatPersistence) return [];
  return chatPersistence.getAll();
}

export async function setMessages(
  db: any,
  id: string,
  messages: Message[],
  urlId?: string,
  description?: string,
  timestamp?: string,
  metadata?: IChatMetadata,
): Promise<void> {
  if (!chatPersistence) return;
  return chatPersistence.setMessages(id, messages, urlId, description, timestamp, metadata);
}

export async function getMessages(db: any, id: string): Promise<ChatHistoryItem> {
  if (!chatPersistence) throw new Error('Persistence not available');
  return chatPersistence.getMessages(id);
}

export async function deleteById(db: any, id: string): Promise<void> {
  if (!chatPersistence) return;
  return chatPersistence.deleteById(id);
}

export async function getNextId(db: any): Promise<string> {
  if (!chatPersistence) throw new Error('Persistence not available');
  return chatPersistence.getNextId();
}

export async function getUrlId(db: any, id: string): Promise<string> {
  if (!chatPersistence) throw new Error('Persistence not available');
  return chatPersistence.getUrlId(id);
}

export async function forkChat(db: any, chatId: string, messageId: string): Promise<string> {
  if (!chatPersistence) throw new Error('Persistence not available');
  return chatPersistence.forkChat(chatId, messageId);
}

export async function duplicateChat(db: any, id: string): Promise<string> {
  if (!chatPersistence) throw new Error('Persistence not available');
  return chatPersistence.duplicateChat(id);
}

export async function createChatFromMessages(
  db: any,
  description: string,
  messages: Message[],
  metadata?: IChatMetadata,
): Promise<string> {
  if (!chatPersistence) throw new Error('Persistence not available');
  return chatPersistence.createChatFromMessages(description, messages, metadata);
}

export async function updateChatDescription(db: any, id: string, description: string): Promise<void> {
  if (!chatPersistence) return;
  return chatPersistence.updateChatDescription(id, description);
}

export async function updateChatMetadata(
  db: any,
  id: string,
  metadata: IChatMetadata | undefined,
): Promise<void> {
  if (!chatPersistence) return;
  return chatPersistence.updateChatMetadata(id, metadata);
}

export async function getSnapshot(db: any, chatId: string): Promise<Snapshot | undefined> {
  if (!chatPersistence) return undefined;
  return chatPersistence.getSnapshot(chatId);
}

export async function setSnapshot(db: any, chatId: string, snapshot: Snapshot): Promise<void> {
  if (!chatPersistence) return;
  return chatPersistence.setSnapshot(chatId, snapshot);
}

export async function deleteSnapshot(db: any, chatId: string): Promise<void> {
  if (!chatPersistence) return;
  return chatPersistence.deleteSnapshot(chatId);
}

export async function saveVersions(db: any, chatId: string, versions: ProjectVersion[]): Promise<void> {
  if (!chatPersistence) return;
  return chatPersistence.saveVersions(chatId, versions);
}

export async function getVersionsByChatId(db: any, chatId: string): Promise<ProjectVersion[] | undefined> {
  if (!chatPersistence) return undefined;
  return chatPersistence.getVersionsByChatId(chatId);
}
