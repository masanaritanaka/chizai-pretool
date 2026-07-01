/**
 * PDF / DOCX / テキストファイルからテキストを抽出する。
 * pdfjs-dist (v6): PDF テキストレイヤー抽出
 * mammoth (v1):   DOCX → プレーンテキスト変換
 */

import * as pdfjsLib from 'pdfjs-dist';

// Vite の new URL() パターン: ビルド時に pdf.worker.min.mjs を成果物にコピーする
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href;

export interface ExtractionResult {
  text: string;
  /** true = テキスト抽出失敗 → コピペ案内フォールバック */
  fallback: boolean;
  reason?: string;
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

export async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = (content.items as Array<{ str?: string }>)
      .filter(item => typeof item.str === 'string')
      .map(item => item.str as string)
      .join(' ');
    pages.push(pageText);
  }

  return pages.join('\n\n').trim();
}

// ─── DOCX ────────────────────────────────────────────────────────────────────

type MammothModule = {
  extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
};

export async function extractDocxText(file: File): Promise<string> {
  // Vite は package.json の "browser" フィールドを尊重するため
  // mammoth のブラウザ互換ビルドが自動的に使われる
  const mammoth = (await import('mammoth')) as unknown as MammothModule;
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value.trim();
}

// ─── ファサード ───────────────────────────────────────────────────────────────

const MIN_EXTRACTED_LENGTH = 30;
const ACCEPTED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt', '.md', '.csv', '.text']);

export function isSupportedExtension(filename: string): boolean {
  const ext = '.' + (filename.split('.').pop()?.toLowerCase() ?? '');
  return ACCEPTED_EXTENSIONS.has(ext);
}

export async function extractTextFromFile(file: File): Promise<ExtractionResult> {
  const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');

  if (ext === '.pdf') {
    try {
      const text = await extractPdfText(file);
      if (text.length < MIN_EXTRACTED_LENGTH) {
        return {
          text: '',
          fallback: true,
          reason:
            'テキストレイヤーが見つかりませんでした（スキャンPDF等）。' +
            'ファイルを開いてテキストをコピー&ペーストしてください。',
        };
      }
      return { text, fallback: false };
    } catch (e) {
      return {
        text: '',
        fallback: true,
        reason: `PDF 読み込みエラー: ${String(e).slice(0, 120)}。テキストを直接貼り付けてください。`,
      };
    }
  }

  if (ext === '.docx') {
    try {
      const text = await extractDocxText(file);
      if (!text) {
        return {
          text: '',
          fallback: true,
          reason: '文書からテキストを抽出できませんでした。テキストを直接貼り付けてください。',
        };
      }
      return { text, fallback: false };
    } catch (e) {
      return {
        text: '',
        fallback: true,
        reason: `DOCX 読み込みエラー: ${String(e).slice(0, 120)}。テキストを直接貼り付けてください。`,
      };
    }
  }

  // .txt / .md / .csv 等プレーンテキスト
  try {
    const text = await file.text();
    return { text: text.trim(), fallback: false };
  } catch {
    return {
      text: '',
      fallback: true,
      reason: 'ファイルの読み込みに失敗しました。',
    };
  }
}
