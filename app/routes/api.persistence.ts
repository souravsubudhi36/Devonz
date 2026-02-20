import { json, type ActionFunctionArgs } from '@remix-run/node';
import { postgresAdapter } from '~/lib/server/db.server';
import { supabaseAdapter } from '~/lib/server/supabase.server';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  const provider = process.env.VITE_STORAGE_PROVIDER?.toLowerCase();
  
  if (provider !== 'postgres' && provider !== 'supabase') {
    return json({ error: 'Server persistence is not enabled' }, { status: 400 });
  }

  const payload = await request.json();
  const { action, ...args } = payload;
  
  try {
    const adapter = provider === 'postgres' ? postgresAdapter : supabaseAdapter;

    let result;
    switch (action) {
      case 'getAll':
        result = await adapter.getAll();
        break;
      case 'getMessages':
        if (!args.id) return json({ error: 'Missing id' }, { status: 400 });
        result = await adapter.getMessages(args.id);
        break;
      case 'setMessages':
        if (!args.id || !args.messages) return json({ error: 'Missing required fields' }, { status: 400 });
        await adapter.setMessages(args.id, args.messages, args.urlId, args.description, args.timestamp, args.metadata);
        result = { success: true };
        break;
      case 'deleteById':
        await adapter.deleteById(args.id);
        result = { success: true };
        break;
      case 'getNextId':
        result = await adapter.getNextId();
        break;
      case 'getUrlId':
        result = await adapter.getUrlId(args.id);
        break;
      case 'forkChat':
        result = await adapter.forkChat(args.chatId, args.messageId);
        break;
      case 'duplicateChat':
        result = await adapter.duplicateChat(args.id);
        break;
      case 'createChatFromMessages':
        result = await adapter.createChatFromMessages(args.description, args.messages, args.metadata);
        break;
      case 'updateChatDescription':
        await adapter.updateChatDescription(args.id, args.description);
        result = { success: true };
        break;
      case 'updateChatMetadata':
        await adapter.updateChatMetadata(args.id, args.metadata);
        result = { success: true };
        break;
      case 'getSnapshot':
        result = await adapter.getSnapshot(args.chatId);
        break;
      case 'setSnapshot':
        await adapter.setSnapshot(args.chatId, args.snapshot);
        result = { success: true };
        break;
      case 'deleteSnapshot':
        await adapter.deleteSnapshot(args.chatId);
        result = { success: true };
        break;
      case 'saveVersions':
        await adapter.saveVersions(args.chatId, args.versions);
        result = { success: true };
        break;
      case 'getVersionsByChatId':
        result = await adapter.getVersionsByChatId(args.chatId);
        break;
      default:
        return json({ error: 'Unknown action: ' + action }, { status: 400 });
    }

    return json({ data: result });
  } catch (error: any) {
    console.error(`[api.persistence] Error executing ${action}:`, error);
    return json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
