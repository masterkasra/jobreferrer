// One entry point for every interface (CLI, Telegram, web): bytes in, resume text out.
// Files with a text layer are parsed locally; images and scanned PDFs are
// transcribed by Claude when an API key is configured.

import { extractText, detectType, IMAGE_TYPES, ResumeFormatError } from './extract.js';
import { transcribeResume } from '../llm/claude.js';
import { hasClaude } from '../config.js';

export const MIN_TEXT = 80;

const MESSAGES = {
  'needs-ai': {
    fa: 'این فایل تصویر یا PDF اسکن‌شده است و متن قابل‌خواندن ندارد. برای خواندن آن کلید ANTHROPIC_API_KEY لازم است؛ یا نسخه Word/PDF متنی رزومه را بفرستید.',
    en: 'This is an image or a scanned PDF with no text layer. Reading it needs ANTHROPIC_API_KEY; otherwise send a Word or text-based PDF version.',
  },
  empty: {
    fa: 'متن کافی در فایل پیدا نشد. فایل رزومه کامل (PDF، Word، ODT، RTF یا متن) را بفرستید.',
    en: 'Not enough text found in the file. Send the full resume as PDF, Word, ODT, RTF or text.',
  },
  unsupported: {
    fa: 'این نوع فایل پشتیبانی نمی‌شود. PDF، Word (DOCX/DOC)، ODT، RTF، TXT، HTML یا عکس رزومه را بفرستید.',
    en: 'Unsupported file type. Send PDF, Word (DOCX/DOC), ODT, RTF, TXT, HTML or a photo of the resume.',
  },
  'ocr-failed': {
    fa: 'خواندن تصویر رزومه ناموفق بود. لطفاً نسخه PDF یا Word بفرستید.',
    en: 'Could not read the resume image. Please send a PDF or Word version.',
  },
};

export function resumeErrorMessage(err, lang = 'fa') {
  const m = MESSAGES[err?.code];
  return m ? m[lang] ?? m.en : err?.message ?? String(err);
}

/**
 * @param {Buffer} buffer
 * @param {string} filename
 * @param {{ useAI?: boolean }} [opts]
 * @returns {Promise<{ text: string, type: string, pdf?: Buffer, via: 'text'|'ocr' }>}
 */
export async function loadResume(buffer, filename = '', { useAI = hasClaude() } = {}) {
  const type = detectType(filename, buffer);
  const image = IMAGE_TYPES[type];
  let text;
  try {
    text = await extractText(buffer, filename);
  } catch (err) {
    // Corrupt or mislabelled files (e.g. a broken PDF, a spreadsheet renamed .docx).
    if (err instanceof ResumeFormatError) throw err;
    throw new ResumeFormatError('unsupported', `Could not read the file: ${err.message}`);
  }
  const pdf = type === '.pdf' ? buffer : undefined;
  if (text.length >= MIN_TEXT) return { text, type, pdf, via: 'text' };

  if (image || type === '.pdf') {
    if (!useAI) throw new ResumeFormatError('needs-ai', MESSAGES['needs-ai'].en);
    const ocr = await transcribeResume(image ? { image: { data: buffer, mediaType: image } } : { pdf: buffer });
    if (!ocr || ocr.length < MIN_TEXT) throw new ResumeFormatError('ocr-failed', MESSAGES['ocr-failed'].en);
    return { text: ocr, type, pdf, via: 'ocr' };
  }
  throw new ResumeFormatError('empty', MESSAGES.empty.en);
}

export { ResumeFormatError };
