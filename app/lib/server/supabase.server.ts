import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { ChatHistoryItem, IChatMetadata, Snapshot } from '~/lib/persistence/types';
import type { ProjectVersion } from '~/lib/stores/versions';
import type { Message } from 'ai';

let supabaseClient: SupabaseClient | undefined;

function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined. We need the service_role key to bypass RLS for server-side persistence.');
      // Fallback to anon key if service role is missing, but it might fail RLS
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
      if (!process.env.SUPABASE_URL || !key) {
         throw new Error('Supabase credentials missing.');
      }
      supabaseClient = createClient(process.env.SUPABASE_URL, key);
    } else {
      supabaseClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    }
  }
  return supabaseClient;
}

class SupabaseAdapter {
  private get client() {
    return getSupabase();
  }

  async getAll(): Promise<ChatHistoryItem[]> {
    const { data, error } = await this.client.from('chats').select('*');
    if (error) throw error;
    return (data || []).map(row => ({
      id: row.id,
      urlId: row.urlId, // Make sure Supabase column names match casing or adjust accordingly
      description: row.description,
      messages: typeof row.messages === 'string' ? JSON.parse(row.messages) : row.messages,
      timestamp: row.timestamp,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
    }));
  }

  async getMessages(id: string): Promise<ChatHistoryItem> {
    const { data, error } = await this.client.from('chats').select('*').or(`id.eq.${id},urlId.eq.${id}`).single();
    if (error || !data) throw new Error('Chat not found');
    return {
      id: data.id,
      urlId: data.urlId,
      description: data.description,
      messages: typeof data.messages === 'string' ? JSON.parse(data.messages) : data.messages,
      timestamp: data.timestamp,
      metadata: typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata
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
    const ts = timestamp ?? new Date().toISOString();
    const { error } = await this.client.from('chats').upsert({
      id,
      urlId,
      description,
      messages, // automatically converted to JSONB
      timestamp: ts,
      metadata
    });
    if (error) throw error;
  }

  async deleteById(id: string): Promise<void> {
    await Promise.all([
      this.client.from('chats').delete().eq('id', id),
      this.client.from('snapshots').delete().eq('chatId', id),
      this.client.from('versions').delete().eq('chatId', id),
    ]);
  }

  async getNextId(): Promise<string> {
    const { data, error } = await this.client.from('chats').select('id');
    if (error) throw error;
    const ids = (data || []).map(r => r.id);
    const highestId = ids.reduce((cur, acc) => Math.max(+cur, +acc), 0);
    return String(+highestId + 1);
  }

  async getUrlId(id: string): Promise<string> {
    const { data, error } = await this.client.from('chats').select('urlId');
    if (error) throw error;
    const idList = (data || []).map(r => r.urlId).filter(Boolean);
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
    const { data, error } = await this.client.from('snapshots').select('snapshot').eq('chatId', chatId).single();
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is no rows
    if (!data) return undefined;
    return typeof data.snapshot === 'string' ? JSON.parse(data.snapshot) : data.snapshot;
  }

  async setSnapshot(chatId: string, snapshot: Snapshot): Promise<void> {
    const { error } = await this.client.from('snapshots').upsert({
      chatId,
      snapshot
    });
    if (error) throw error;
  }

  async deleteSnapshot(chatId: string): Promise<void> {
    const { error } = await this.client.from('snapshots').delete().eq('chatId', chatId);
    if (error) throw error;
  }

  async saveVersions(chatId: string, versions: ProjectVersion[]): Promise<void> {
    const { error } = await this.client.from('versions').upsert({
      chatId,
      versions
    });
    if (error) throw error;
  }

  async getVersionsByChatId(chatId: string): Promise<ProjectVersion[] | undefined> {
    const { data, error } = await this.client.from('versions').select('versions').eq('chatId', chatId).single();
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return undefined;
    return typeof data.versions === 'string' ? JSON.parse(data.versions) : data.versions;
  }
}

export const supabaseAdapter = new SupabaseAdapter();
