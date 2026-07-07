#!/usr/bin/env bash
# sign-dev.sh — dev ビルドの ad-hoc コードサイン (macOS のみ)
#
# 目的: tauri dev が前回コンパイルしたバイナリに署名を付与し、
#       macOS キーチェーンが同じアプリと認識することでダイアログ抑止を図る。
#
# 仕組み:
#   - tauri.conf.json の beforeDevCommand で npm run dev の前に呼ばれる
#   - 前回セッションのバイナリが残っていれば署名してから Vite を起動
#   - Rust ソースが変更された場合は tauri dev が再コンパイルし署名が外れる
#     (その起動時に 1 回だけキーチェーンダイアログが出る — 次回起動から抑止)
#
# Note: ad-hoc 署名 (--sign -) は CDHash がバイナリ内容に依存するため
#       リコンパイル後は再署名が必要。正規の配布には Apple Developer 証明書が必要。
set -e

BINARY="src-tauri/target/debug/chizai-pretool"

if [[ "$(uname)" != "Darwin" ]]; then
  exit 0
fi

if [[ ! -f "$BINARY" ]]; then
  echo "[sign-dev] no binary yet — first build, skipping"
  exit 0
fi

codesign --force --sign - "$BINARY" \
  && echo "[sign-dev] signed: $BINARY" \
  || echo "[sign-dev] codesign failed (non-fatal)"
