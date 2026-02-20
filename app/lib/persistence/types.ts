import type { Message } from 'ai';
import type { FileMap } from '~/lib/stores/files';
import type { ProjectVersion } from '~/lib/stores/versions';

export interface Snapshot {
  chatIndex: string;
  files: FileMap;
  summary?: string;
}

export interface IChatMetadata {
  gitUrl: string;
  gitBranch?: string;
  netlifySiteId?: string;
}

export interface ChatHistoryItem {
  id: string;
  urlId?: string;
  description?: string;
  messages: Message[];
  timestamp: string;
  metadata?: IChatMetadata;
}

export interface PersistenceAdapter {
  isAvailable(): boolean;
  getAll(): Promise<ChatHistoryItem[]>;
  getMessages(id: string): Promise<ChatHistoryItem>;
  setMessages(
    id: string,
    messages: Message[],
    urlId?: string,
    description?: string,
    timestamp?: string,
    metadata?: IChatMetadata,
  ): Promise<void>;
  deleteById(id: string): Promise<void>;
  getNextId(): Promise<string>;
  getUrlId(id: string): Promise<string>;
  forkChat(chatId: string, messageId: string): Promise<string>;
  duplicateChat(id: string): Promise<string>;
  createChatFromMessages(description: string, messages: Message[], metadata?: IChatMetadata): Promise<string>;
  updateChatDescription(id: string, description: string): Promise<void>;
  updateChatMetadata(id: string, metadata: IChatMetadata | undefined): Promise<void>;
  getSnapshot(chatId: string): Promise<Snapshot | undefined>;
  setSnapshot(chatId: string, snapshot: Snapshot): Promise<void>;
  deleteSnapshot(chatId: string): Promise<void>;
  saveVersions(chatId: string, versions: ProjectVersion[]): Promise<void>;
  getVersionsByChatId(chatId: string): Promise<ProjectVersion[] | undefined>;
}
