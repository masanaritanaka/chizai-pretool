# 知財プリツール（chizai-pretool）

**最新版: v0.6.4** — [Releases](../../releases) からインストーラをダウンロードできます（Windows `.msi`/`.exe` / macOS `.dmg` Universal）

特許・実用新案・意匠・商標の初期調査と構造化を支援するデスクトップアプリです。弁理士・知財部へ相談する前の「前処理」を、非専門家でも自分で進められるようにします。

> **免責**: 本ツールは登録可能性・権利侵害の有無を判定・保証するものではありません。初期調査と論点整理の補助を目的としています。最終判断は弁理士・知財部にご相談ください。

開発方針・仕様の全体像は [CLAUDE.md](./CLAUDE.md) を参照してください。

## 機能一覧（全 10 プリセット）

### 調べる（Research エンジン）

| # | 機能名 | 概要 |
|---|--------|------|
| 01 | 商標ネーミング危険度チェッカー | 商標候補の構成要素・類似語・危険度を構造化。J-PlatPat 商標検索式を生成 |
| 02 | 商標出願前チェックリスト | 識別力・区分・類似商標リスクを網羅的に整理し出願準備を支援 |
| 03 | 特許の素人向け翻訳 | 特許番号またはクレームテキストを平易な日本語で構造化 |
| 04 | 自社アイデアの先行技術メモ化 | アイデアを特許調査用メモに変換し IPC 候補と検索式を提示 |
| 05 | 意匠・UI 類似チェック（画像入力） | 画像を Claude Vision で分析し、意匠類似リスクを評価 |
| 09 | 契約・提案書の知財リスクチェッカー | テキストまたはファイル（PDF/DOCX 等）の知財リスク条項を抽出 |

### 監視する（Watch エンジン）

| # | 機能名 | 概要 |
|---|--------|------|
| 07 | 競合知財ウォッチャー | 企業名を入力し J-PlatPat 出願人検索式を生成・保存。最終確認日を記録 |
| 08 | 特許マップ自動生成 | 技術分野を入力し大分類→小分類の観点マップと IPC/検索式を生成 |

### 管理する（Manage エンジン）

| # | 機能名 | 概要 |
|---|--------|------|
| 06 | 知財期限・ステータス管理 | 出願日・審査請求期限・年金更新期限などを SQLite で管理。期限接近を通知 |
| 10 | 防衛公開メモ | アイデアをタイムスタンプ付きでローカル記録し、公開/非公開・特許候補を管理 |

> **データソース方針**: 特許庁 API・各庁 API・スクレイピングは一切使用しません。Claude API（BYO キー）のみに依存し、検索は J-PlatPat のディープリンクでユーザーが実行します（[CLAUDE.md §4](./CLAUDE.md) 参照）。

## クイックスタート（利用者向け）

1. [Releases](../../releases) から OS に合ったインストーラをダウンロードします。
   - Windows: `.msi` または `.exe`
   - macOS: `.dmg`（Universal、Intel/Apple Silicon 両対応）
2. インストール後にアプリを起動します。
3. 右上の「設定」から Claude API キー（[console.anthropic.com](https://console.anthropic.com/) で取得）を入力して保存します。
   - キーは OS のキーチェーン（macOS Keychain / Windows 資格情報マネージャー）に保存され、アプリやリポジトリに平文で残ることはありません。
4. Home 画面の「調べる／監視する／管理する」のプリセットから使いたい機能を選びます。

macOS で「開発元を検証できません」と表示される場合は、Finder でアプリを右クリック →「開く」を選択してください（未署名ビルドのため、Apple の署名・公証は行っていません）。

### preset 05（意匠・UI類似チェック）の画像形式

対応形式: **JPEG / PNG / GIF / WebP** のみ。  
非対応: AVIF / HEIC / TIFF 等は取り込み時にエラーになります。Canva や他の Web サービスからドラッグした画像が AVIF 形式で保存されている場合、**PNG 形式でスクリーンショットを撮り直す**のが最も確実な回避策です。

## 開発者向けセットアップ

### 前提

- [Node.js](https://nodejs.org/) 18 以上
- [Rust](https://www.rust-lang.org/tools/install)（`rustup` 経由を推奨）
- Tauri 2 のシステム要件（[公式ドキュメント](https://v2.tauri.app/start/prerequisites/)を参照。macOS は Xcode Command Line Tools、Windows は WebView2 + MSVC ツールチェーンが必要です）

### セットアップと起動

```bash
npm install
npm run tauri dev
```

### Pexels API キーの設定（プリセットカード写真の取得）

各プリセットカードの背景写真は [Pexels](https://www.pexels.com/) から取得します。  
写真の取得はビルド前の**ワンタイム実行**で、アプリ実行時には API を叩きません（オフライン動作を維持）。

1. [https://www.pexels.com/api/](https://www.pexels.com/api/) にアクセスし、無料の API キーを取得します。
2. リポジトリ直下に `.env` ファイルを作成します:
   ```bash
   cp .env.example .env
   ```
3. `.env` を開き `PEXELS_API_KEY=` の後にキーを貼り付けます。
4. 写真を取得します（`src/assets/photos/` に保存されます）:
   ```bash
   npm run fetch-photos
   ```
5. 取得した写真と撮影者クレジット（`public/photos/CREDITS.md`）をコミットします:
   ```bash
   git add public/photos/
   git commit -m "chore: add preset card photos"
   ```

> `.env` ファイルは `.gitignore` に含まれているためリポジトリには含まれません。  
> 写真ファイル（`.jpg`）はコミット対象です。再取得したい場合は対象ファイルを削除してから再実行してください。

### プロダクションビルド

```bash
npm run tauri build
```

`src-tauri/target/release/bundle/` 配下にインストーラが生成されます。

## プリセット・法域・テンプレートの追加方法

このアプリは「10個のプリセットボタン」に見えますが、実装は3つのエンジン（Research / Watch / Manage）に集約されています。プリセットの追加・変更は [src/home/presets.ts](./src/home/presets.ts) の配列にエントリを1つ追加するだけで完結する構造になっています。

新しい法域・出力テンプレートを追加する場合の手順:

1. `src/home/presets.ts` の `Preset` 型に必要なフィールドを追記し、配列に新しいプリセットを追加する。
2. 対象エンジン（`src/engines/research` など）側で、その `lawDomains` / `outputTemplate` を受け取れるよう分岐・テンプレートを追加する。
3. Research 系プリセットの場合、出力に J-PlatPat 検索式とディープリンク（`src/lib/jplatpat.ts`）が必ず含まれることを確認する。
4. 免責表示（`src/components/DisclaimerBanner.tsx`）が出力画面にも表示されることを確認する。

データソース方針（特許庁API・スクレイピング禁止、Claude API のみに依存する理由）は [CLAUDE.md §4](./CLAUDE.md#4-データソース方針実装前に必読厳守) を参照してください。

## リリース

`v*` 形式のタグを push すると、GitHub Actions（[.github/workflows/release.yml](./.github/workflows/release.yml)）が Windows / macOS のインストーラをビルドし、GitHub Release として自動公開します。

```bash
git tag v0.6.4
git push origin main v0.6.4
```

## セキュリティに関する注記

### xlsx / SheetJS の既知脆弱性について

本アプリは XLSX ファイルの読み取りに `xlsx`（SheetJS Community Edition）を使用しています。
このライブラリには以下の未修正の既知脆弱性が報告されています。

- **GHSA-4r6h-8v6p-xvw6**（Prototype Pollution）
- **GHSA-5pgg-2g8v-p4x9**（ReDoS）

SheetJS 側から公式の修正バージョンは提供されていません。

本アプリがこれを許容する理由: **本アプリはローカルデスクトップ専用であり、処理するファイルはユーザー自身が選択・ドロップしたファイルのみです。** 外部から XLSX ファイルを自動取得・受信する経路は存在せず、攻撃者が悪意ある XLSX ファイルをユーザーに処理させるには物理的なアクセスまたはソーシャルエンジニアリングが必要です。このリスクプロフィールはローカルファイルマネージャーと同等と判断し、現時点では許容しています。より安全な代替ライブラリ（ExcelJS 等）への移行は今後の課題として検討します。

## ライセンス

[MIT License](./LICENSE)
