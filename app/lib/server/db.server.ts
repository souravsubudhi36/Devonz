import { Pool } from 'pg';
import type { ChatHistoryItem, IChatMetadata, Snapshot } from '~/lib/persistence/types';
import type { ProjectVersion } from '~/lib/stores/versions';
import type { Message } from 'ai';

let pool: Pool | undefined;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not defined in environment variables');
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return pool;
}

// Ensure schema is created
export async function initializeSchema() {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      urlId TEXT UNIQUE,
      description TEXT,
      messages JSONB,
      timestamp TEXT,
      metadata JSONB
    );
    CREATE TABLE IF NOT EXISTS snapshots (
      chatId TEXT PRIMARY KEY,
      snapshot JSONB
    );
    CREATE TABLE IF NOT EXISTS versions (
       chatId TEXT PRIMARY KEY,
       versions JSONB
    );
  `);
}

class PostgresAdapter {
  private schemaInitPromise: Promise<void> | null = null;
  
  private async ensureSchema() {
    if (!this.schemaInitPromise) {
      this.schemaInitPromise = initializeSchema();
    }
    return this.schemaInitPromise;
  }

  private async query(text: string, params?: any[]) {
    await this.ensureSchema();
    const p = getPool();
    return p.query(text, params);
  }

  async getAll(): Promise<ChatHistoryItem[]> {
    const res = await this.query('SELECT * FROM chats');
    return res.rows.map(row => ({
      id: row.id,
      urlId: row.urlid,
      description: row.description,
      messages: row.messages as Message[],
      timestamp: row.timestamp,
      metadata: row.metadata as IChatMetadata
    }));
  }

  async getMessages(id: string): Promise<ChatHistoryItem> {
    const res = await this.query('SELECT * FROM chats WHERE id = $1 OR urlId = $1', [id]);
    if (res.rowCount === 0) throw new Error('Chat not found');
    const row = res.rows[0];
    return {
      id: row.id,
      urlId: row.urlid,
      description: row.description,
      messages: row.messages as Message[],
      timestamp: row.timestamp,
      metadata: row.metadata as IChatMetadata
    };
  }

  async setMessages(
    id: string,
    messages: Message[],
    urlId?: string,
    description?: string,
    timestamp?: string,
    metadata?: IChatMetadata,
  ): Promise<void> {
    await this.query(`
      INSERT INTO chats (id, urlId, description, messages, timestamp, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        urlId = EXCLUDED.urlId,
        description = EXCLUDED.description,
        messages = EXCLUDED.messages,
        timestamp = EXCLUDED.timestamp,
        metadata = EXCLUDED.metadata;
    `, [id, urlId, description, JSON.stringify(messages), timestamp ?? new Date().toISOString(), metadata ? JSON.stringify(metadata) : null]);
  }

  async deleteById(id: string): Promise<void> {
    await this.query('DELETE FROM chats WHERE id = $1', [id]);
    await this.query('DELETE FROM snapshots WHERE chatId = $1', [id]);
    await this.query('DELETE FROM versions WHERE chatId = $1', [id]);
  }

  async getNextId(): Promise<string> {
    const res = await this.query('SELECT id FROM chats');
    const ids = res.rows.map(r => r.id);
    const highestId = ids.reduce((cur, acc) => Math.max(+cur, +acc), 0);
    return String(+highestId + 1);
  }

  async getUrlId(id: string): Promise<string> {
    const res = await this.query('SELECT urlId FROM chats');
    const idList = res.rows.map(r => r.urlid).filter(Boolean);
    if (!idList.includes(id)) return id;
    
    let i = 2;
    while (idList.includes(`${id}-${i}`)) {
      i++;
    }
    return `${id}-${i}`;
  }

  async forkChat(chatId: string, messageId: string): Promise<string> {
    const chat = await this.getMessages(chatId);
    if (!chat) throw new Error('Chat not found');
    const messageIndex = chat.messages.findIndex((msg: any) => msg.id === messageId);
    if (messageIndex === -1) throw new Error('Message not found');
    const messages = chat.messages.slice(0, messageIndex + 1);
    return this.createChatFromMessages(chat.description ? `${chat.description} (fork)` : 'Forked chat', messages);
  }

  async duplicateChat(id: string): Promise<string> {
    const chat = await this.getMessages(id);
    if (!chat) throw new Error('Chat not found');
    return this.createChatFromMessages(`${chat.description || 'Chat'} (copy)`, chat.messages);
  }

  async createChatFromMessages(description: string, messages: Message[], metadata?: IChatMetadata): Promise<string> {
    const newId = await this.getNextId();
    const newUrlId = await this.getUrlId(newId);
    await this.setMessages(newId, messages, newUrlId, description, undefined, metadata);
    return newUrlId;
  }

  async updateChatDescription(id: string, description: string): Promise<void> {
    const chat = await this.getMessages(id);
    if (!chat) throw new Error('Chat not found');
    await this.setMessages(id, chat.messages, chat.urlId, description, chat.timestamp, chat.metadata);
  }

  async updateChatMetadata(id: string, metadata: IChatMetadata | undefined): Promise<void> {
    const chat = await this.getMessages(id);
    if (!chat) throw new Error('Chat not found');
    await this.setMessages(id, chat.messages, chat.urlId, chat.description, chat.timestamp, metadata);
  }

  async getSnapshot(chatId: string): Promise<Snapshot | undefined> {
    const res = await this.query('SELECT snapshot FROM snapshots WHERE chatId = $1', [chatId]);
    if (res.rowCount === 0) return undefined;
    return res.rows[0].snapshot as Snapshot;
  }

  async setSnapshot(chatId: string, snapshot: Snapshot): Promise<void> {
    await this.query(`
      INSERT INTO snapshots (chatId, snapshot)
      VALUES ($1, $2)
      ON CONFLICT (chatId) DO UPDATE SET snapshot = EXCLUDED.snapshot;
    `, [chatId, JSON.stringify(snapshot)]);
  }

  async deleteSnapshot(chatId: string): Promise<void> {
    await this.query('DELETE FROM snapshots WHERE chatId = $1', [chatId]);
  }

  async saveVersions(chatId: string, versions: ProjectVersion[]): Promise<void> {
    await this.query(`
      INSERT INTO versions (chatId, versions)
      VALUES ($1, $2)
      ON CONFLICT (chatId) DO UPDATE SET versions = EXCLUDED.versions;
    `, [chatId, JSON.stringify(versions)]);
  }

  async getVersionsByChatId(chatId: string): Promise<ProjectVersion[] | undefined> {
    const res = await this.query('SELECT versions FROM versions WHERE chatId = $1', [chatId]);
    if (res.rowCount === 0) return undefined;
    return res.rows[0].versions as ProjectVersion[];
  }
}

export const postgresAdapter = new PostgresAdapter();
