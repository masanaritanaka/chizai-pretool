# アーキテクチャ概要

## 目的

特許・実用新案・意匠・商標の初期調査を、非専門家が自分で進められるようにする「前処理ツール」。弁理士・知財部への相談前の論点整理に使う。法的判断や登録可能性の判定は行わない。

## 10プリセット → 3エンジン構成

入口は 10 個のプリセットボタンだが、実装は 3 エンジンに集約されている。

```
プリセット 01,02,03,04,05,09  →  Research エンジン（Claude Vision 含む）
プリセット 07,08              →  Watch エンジン（簡易版: 検索式生成のみ）
プリセット 06,10              →  Manage エンジン（SQLite CRUD、AI不使用）
```

プリセットのメタデータ（エンジン種別・法域・入力タイプ・出力テンプレ）は [`src/home/presets.ts`](./src/home/presets.ts) に一元管理されている。プリセット追加 = この配列に 1 エントリを追加するだけ。

## データフロー（Research エンジン）

```
ユーザー入力（テキスト / PDF / DOCX / 画像）
  → fileIngest.ts（テキスト抽出 / 画像 base64 化）
    → prompts.ts（プリセット別システムプロンプト生成）
      → claude.ts（Rust IPC 経由で Claude API 呼び出し）
        → 出力: 構造化 JSON（ResearchPage.tsx でレンダリング）
          → jplatpat.ts（J-PlatPat 検索式 + ディープリンク生成）
```

## J-PlatPat との連携方針

**アプリは検索を実行しない。** Claude が検索式を生成し、ユーザーが J-PlatPat 上で実行する。ディープリンクで遷移する設計。特許庁 API・スクレイピングは使用しない（[CLAUDE.md §4](./CLAUDE.md) 参照）。

## API キーの保管

Claude API キー（BYO）は Tauri の Rust コマンド経由で OS キーチェーンに保存される（macOS Keychain / Windows 資格情報マネージャー）。JavaScript 側にキーは渡らず、リポジトリにも残らない。

## 技術スタック

| 層 | 技術 |
|---|---|
| フロントエンド | Vite + React + TypeScript |
| デスクトップ | Tauri 2 (Rust + WKWebView) |
| ローカル DB | SQLite（tauri-plugin-sql） |
| AI | Claude API (`claude-sonnet-4-6`) |
| キーチェーン | keyring v3 (apple-native / windows-native) |

## 非目標

- 登録可能性・権利侵害の判定
- J-PlatPat の自動検索・スクレイピング
- 特許情報の自前 DB 構築
- 完全な知財管理 SaaS 化
- Apple 署名・公証（現状は ad-hoc 署名のみ）
