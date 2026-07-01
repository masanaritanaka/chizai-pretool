# 知財プリツール（chizai-pretool）

特許・実用新案・意匠・商標の初期調査と構造化を支援するデスクトップアプリです。弁理士・知財部へ相談する前の「前処理」を、非専門家でも自分で進められるようにします。

> 本ツールは登録可能性・権利侵害の有無を判定・保証するものではありません。初期調査と論点整理の補助を目的としています。最終判断は弁理士・知財部にご相談ください。

開発方針・仕様の全体像は [CLAUDE.md](./CLAUDE.md) を参照してください。

## クイックスタート（利用者向け）

1. [Releases](../../releases) から OS に合ったインストーラをダウンロードします。
   - Windows: `.msi` または `.exe`
   - macOS: `.dmg`（Universal、Intel/Apple Silicon 両対応）
2. インストール後にアプリを起動します。
3. 右上の「設定」から Claude API キー（[console.anthropic.com](https://console.anthropic.com/) で取得）を入力して保存します。
   - キーは OS のキーチェーン（macOS Keychain / Windows 資格情報マネージャー）に保存され、アプリやリポジトリに平文で残ることはありません。
4. Home 画面の「調べる／監視する／管理する」のプリセットから使いたい機能を選びます（Phase 1 以降、順次利用可能になります）。

macOS で「開発元を検証できません」と表示される場合は、Finder でアプリを右クリック →「開く」を選択してください（未署名ビルドのため）。

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

`v*` 形式のタグを push すると、GitHub Actions（[.github/workflows/release.yml](./.github/workflows/release.yml)）が Windows / macOS のインストーラをビルドし、ドラフトの GitHub Release に添付します。

```bash
git tag v0.1.0
git push origin v0.1.0
```

## ライセンス

[MIT License](./LICENSE)
