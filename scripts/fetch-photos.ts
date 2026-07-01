/**
 * scripts/fetch-photos.ts
 *
 * ビルド前のワンタイム実行スクリプト。
 * Pexels API で各プリセットの写真を1枚ずつ取得し
 * src/assets/photos/{id:02d}.jpg として保存する。
 *
 * 実行方法:
 *   cp .env.example .env   # PEXELS_API_KEY を記入
 *   npm run fetch-photos
 *
 * 既にファイルが存在する場合はスキップ（再取得したい場合は手動削除）。
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { presets } from '../src/home/presets.ts';

const API_KEY = process.env.PEXELS_API_KEY;
if (!API_KEY) {
  console.error(
    '\n❌  PEXELS_API_KEY が設定されていません。\n' +
    '    cp .env.example .env を実行してキーを記入してください。\n' +
    '    取得手順は README.md の「Pexels API キーの設定」を参照。\n'
  );
  process.exit(1);
}

const OUT_DIR = path.resolve(import.meta.dirname, '../public/photos');
const CREDITS_PATH = path.join(OUT_DIR, 'CREDITS.md');

fs.mkdirSync(OUT_DIR, { recursive: true });

// ─── ユーティリティ ───────────────────────────────────────────────────────────

function httpsGet(url: string, headers: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        resolve(httpsGet(res.headers.location!, headers));
        return;
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const doGet = (u: string) => {
      https.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          doGet(res.headers.location!);
          return;
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
        file.on('error', (e) => { fs.unlink(dest, () => {}); reject(e); });
      }).on('error', reject);
    };
    doGet(url);
  });
}

// ─── Pexels 型 ───────────────────────────────────────────────────────────────

interface PexelsPhoto {
  id: number;
  photographer: string;
  photographer_url: string;
  src: { medium: string; large: string };
}

interface PexelsSearchResponse {
  photos: PexelsPhoto[];
}

async function searchPexels(query: string): Promise<PexelsPhoto | null> {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
  const raw = await httpsGet(url, { Authorization: API_KEY! });
  const data: PexelsSearchResponse = JSON.parse(raw);
  return data.photos?.[0] ?? null;
}

// ─── メイン ──────────────────────────────────────────────────────────────────

interface CreditEntry {
  file: string;
  pexelsId: number;
  photographer: string;
  photographerUrl: string;
  query: string;
}

const credits: CreditEntry[] = [];

// 既存の CREDITS.md をパースして再利用（スキップした写真のクレジットを保持）
const existingCredits: Record<string, CreditEntry> = {};
if (fs.existsSync(CREDITS_PATH)) {
  const raw = fs.readFileSync(CREDITS_PATH, 'utf-8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\|\s*`(\d+\.jpg)`\s*\|\s*(.+?)\s*\|\s*\[Pexels #(\d+)\]\((.+?)\)\s*\|\s*(.+?)\s*\|/);
    if (m) {
      existingCredits[m[1]] = {
        file: m[1],
        photographer: m[2],
        pexelsId: Number(m[3]),
        photographerUrl: m[4],
        query: m[5],
      };
    }
  }
}

const sortedPresets = [...presets].sort((a, b) => a.id - b.id);

for (const preset of sortedPresets) {
  const filename = `${String(preset.id).padStart(2, '0')}.jpg`;
  const dest = path.join(OUT_DIR, filename);

  if (fs.existsSync(dest)) {
    console.log(`  skip  ${filename}  (already exists)`);
    // 既存のクレジットがあれば引き継ぐ
    if (existingCredits[filename]) credits.push(existingCredits[filename]);
    continue;
  }

  process.stdout.write(`  fetch ${filename}  "${preset.photoKeyword}" ... `);

  try {
    const photo = await searchPexels(preset.photoKeyword);
    if (!photo) {
      console.log('no result — skipped');
      continue;
    }
    await downloadFile(photo.src.large, dest);
    credits.push({
      file: filename,
      pexelsId: photo.id,
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url,
      query: preset.photoKeyword,
    });
    console.log(`ok  (Pexels #${photo.id}, ${photo.photographer})`);
  } catch (err) {
    console.log(`error — ${(err as Error).message}`);
  }
}

// ─── CREDITS.md 書き出し ──────────────────────────────────────────────────────

credits.sort((a, b) => a.file.localeCompare(b.file));

const rows = credits.map(
  (c) =>
    `| \`${c.file}\` | ${c.photographer} | [Pexels #${c.pexelsId}](${c.photographerUrl}) | ${c.query} |`
);

const md = [
  '# Photo Credits',
  '',
  'Images sourced from [Pexels](https://www.pexels.com/) under the',
  '[Pexels License](https://www.pexels.com/license/).',
  '',
  '| File | Photographer | Pexels Page | Search query |',
  '|------|-------------|-------------|--------------|',
  ...rows,
  '',
].join('\n');

fs.writeFileSync(CREDITS_PATH, md, 'utf-8');
console.log(`\n✅  ${credits.length}枚取得完了。クレジット → ${CREDITS_PATH}`);
