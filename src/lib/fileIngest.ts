/**
 * src/lib/fileIngest.ts
 *
 * Research エンジン全プリセット共通のファイル取り込み層。
 * テキスト系: txt / md / html / pdf / docx / xlsx → 文字列
 * 画像系:    jpg / png / gif / webp → base64（呼び出し元が vision/ocr を判断）
 *
 * PDF は unpdf（worker 不要）を使用。pdfjs-dist の workerSrc 未解決エラーを回避。
 * XLSX は xlsx(SheetJS)。ローカル限定アプリのため既知 CVE はリスク許容済み。
 */

import type { ImageMediaType } from './claude';

// ─── 公開型 ──────────────────────────────────────────────────────────────────

export interface TextResult {
  type: 'text';
  text: string;
  sourceFile: string;
}

export interface ImageResult {
  type: 'image';
  base64: string;
  mediaType: ImageMediaType;
  previewUrl: string;
  sourceFile: string;
}

export interface ErrorResult {
  type: 'error';
  reason: string;
  sourceFile: string;
}

export type IngestResult = TextResult | ImageResult | ErrorResult;

// ─── 定数 ────────────────────────────────────────────────────────────────────

export const VISION_ALLOWED_TYPES = new Set<ImageMediaType>([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
]);

const IMAGE_TYPES = VISION_ALLOWED_TYPES;

const MIME_ERROR_MSG = (displayType: string) =>
  `この画像形式（${displayType}）には対応していません。` +
  `JPEG・PNG・GIF・WebP のいずれかで保存し直してください。` +
  `スクリーンショット（PNG）での取り込みが確実です。`;

const EXT_MAP: Record<string, string> = {
  txt: 'text', md: 'text', csv: 'text', text: 'text',
  html: 'html', htm: 'html',
  pdf: 'pdf',
  docx: 'docx',
  xlsx: 'xlsx', xls: 'xlsx',
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image',
};

export const ACCEPT_ATTR = [
  '.txt,.md,.csv,.text',
  '.html,.htm',
  '.pdf',
  '.docx',
  '.xlsx,.xls',
  '.jpg,.jpeg,.png,.gif,.webp',
].join(',');

export function isAcceptedFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ext in EXT_MAP;
}

// ─── 抽出ロジック ────────────────────────────────────────────────────────────

async function extractHtmlText(file: File): Promise<string> {
  const raw = await file.text();
  const doc = new DOMParser().parseFromString(raw, 'text/html');
  // script / style タグを除去してテキストを返す
  doc.querySelectorAll('script,style,noscript').forEach(el => el.remove());
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

async function extractPdfText(file: File): Promise<string> {
  const { extractText } = await import('unpdf');
  const buffer = await file.arrayBuffer();
  const { text, totalPages } = await extractText(new Uint8Array(buffer));
  const joined = Array.isArray(text) ? (text as string[]).join('\n\n') : String(text);
  if (!joined.trim() || joined.trim().length < 30) {
    throw new Error(
      `テキストレイヤーが見つかりません（${totalPages}ページ）。本文をコピーして貼り付けるか、該当ページのスクリーンショットを画像として読み込んでください。`,
    );
  }
  return joined.trim();
}

async function extractDocxText(file: File): Promise<string> {
  type MammothMod = { extractRawText(i: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }> };
  const mammoth = (await import('mammoth')) as unknown as MammothMod;
  const buffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
  if (!value.trim()) throw new Error('DOCX からテキストを抽出できませんでした。');
  return value.trim();
}

async function extractXlsxText(file: File): Promise<string> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const parts: string[] = [];
  for (const name of wb.SheetNames) {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
    if (csv.trim()) parts.push(`## ${name}\n${csv.trim()}`);
  }
  if (parts.length === 0) throw new Error('シートにデータが見つかりませんでした。');
  return parts.join('\n\n');
}

async function readImageAsBase64(file: File): Promise<ImageResult | ErrorResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const [header, base64] = dataUrl.split(',');
      const detectedType = header.match(/:(.*?);/)?.[1] ?? '';
      if (!IMAGE_TYPES.has(detectedType as ImageMediaType)) {
        const display = detectedType || ('.' + (file.name.split('.').pop() ?? '?'));
        resolve({ type: 'error', reason: MIME_ERROR_MSG(display), sourceFile: file.name });
        return;
      }
      resolve({
        type: 'image',
        base64,
        mediaType: detectedType as ImageMediaType,
        previewUrl: dataUrl,
        sourceFile: file.name,
      });
    };
    reader.onerror = () =>
      resolve({ type: 'error', reason: '画像の読み込みに失敗しました。', sourceFile: file.name });
    reader.readAsDataURL(file);
  });
}

// ─── メイン ──────────────────────────────────────────────────────────────────

export async function ingestFile(file: File): Promise<IngestResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const kind = EXT_MAP[ext];

  if (!kind) {
    return {
      type: 'error',
      reason: `非対応形式です（.${ext}）。対応: txt / md / html / pdf / docx / xlsx / jpg / png / gif / webp`,
      sourceFile: file.name,
    };
  }

  try {
    switch (kind) {
      case 'text': {
        const text = await file.text();
        return { type: 'text', text: text.trim(), sourceFile: file.name };
      }
      case 'html': {
        const text = await extractHtmlText(file);
        return { type: 'text', text, sourceFile: file.name };
      }
      case 'pdf': {
        const text = await extractPdfText(file);
        return { type: 'text', text, sourceFile: file.name };
      }
      case 'docx': {
        const text = await extractDocxText(file);
        return { type: 'text', text, sourceFile: file.name };
      }
      case 'xlsx': {
        const text = await extractXlsxText(file);
        return { type: 'text', text, sourceFile: file.name };
      }
      case 'image': {
        const mimeType = file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        if (!IMAGE_TYPES.has(mimeType as ImageMediaType)) {
          return {
            type: 'error',
            reason: MIME_ERROR_MSG(file.type || ('.' + ext)),
            sourceFile: file.name,
          };
        }
        if (file.size > 5 * 1024 * 1024) {
          return {
            type: 'error',
            reason: `画像ファイルが 5 MB を超えています（${(file.size / 1024 / 1024).toFixed(1)} MB）。Claude API のペイロード制限のため 5 MB 以下の画像を使用してください。`,
            sourceFile: file.name,
          };
        }
        return readImageAsBase64(file);
      }
      default:
        return { type: 'error', reason: `処理方法が未定義です（kind: ${kind}）。`, sourceFile: file.name };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      type: 'error',
      reason: `${file.name} の読み込みエラー: ${msg.slice(0, 200)}`,
      sourceFile: file.name,
    };
  }
}
