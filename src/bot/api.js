// Minimal Telegram Bot API client on top of fetch (no dependencies).

import { config } from '../config.js';

export async function tg(method, body = {}, token = config.telegram.token) {
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  const isForm = body instanceof FormData;
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: isForm ? undefined : { 'Content-Type': 'application/json' },
    body: isForm ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(method === 'getUpdates' ? 70000 : 60000),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description}`);
  return data.result;
}

export async function sendMessages(chatId, messages, extra = {}) {
  for (const [i, text] of messages.entries()) {
    const last = i === messages.length - 1;
    await tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...(last ? extra : {}) });
  }
}

export async function sendDocument(chatId, filename, content, caption = '', mime = 'text/html') {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  if (caption) form.append('caption', caption);
  form.append('document', new Blob([content], { type: mime }), filename);
  return tg('sendDocument', form);
}

export async function downloadFile(fileId) {
  const file = await tg('getFile', { file_id: fileId });
  const res = await fetch(`https://api.telegram.org/file/bot${config.telegram.token}/${file.file_path}`, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`Telegram file download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
