# MyOCR - OCR・要約・プロンプト管理アプリケーション

MyOCR は、Electron + React + TypeScript を使用した、強力な OCR（光学式文字認識）およびテキスト要約アプリケーションです。

## ✨ 主な機能

- 📸 **OCR 処理**: 画像からテキストを抽出
- 📝 **テキスト要約**: 長いテキストを簡潔に要約
- 💾 **プロンプト管理**: カスタムプロンプトテンプレートの作成と保存
- 🔌 **LLM 統合**: OpenAI、Anthropic、Ollama など複数の LLM プロバイダーをサポート
- 📊 **データ管理**: SQLite データベースによる効率的なタスク管理

## 🛠️ 技術スタック

### フロントエンド
- **React 19** - UI ライブラリ
- **TypeScript 5** - 型安全な開発
- **Vite** - 高速ビルドツール
- **Material-UI (MUI)** - コンポーネントライブラリ

### バックエンド
- **Electron** - デスクトップアプリケーションフレームワーク
- **Prisma** - データベース ORM
- **SQLite** - ローカルデータベース
- **LangChain** - LLM 統合フレームワーク

### パッケージ構成（Monorepo）
```
packages/
├── ai-core/          # OCR・要約サービス
├── database/         # データベースサービス
├── ipc-client/       # Electron IPC クライアント
├── types/            # 共通タイプ定義
├── ui-components/    # UI コンポーネント
└── utils/            # ユーティリティ関数
```

## 🚀 クイックスタート

### 前提条件
- Node.js 18+ 
- pnpm 9+

### インストール

```bash
# 依存関係のインストール
pnpm install

# 開発サーバーの起動
pnpm dev
```

### ビルド

```bash
# アプリケーションのビルド
pnpm build

# Electron パッケージの作成
pnpm electron:build
```

## 📖 使用方法

### OCR タスクの実行

1. **LLM 設定**: 設定画面で LLM API 設定を追加
2. **画像アップロード**: OCR タスクリストから画像を選択
3. **テキスト抽出**: 「開始」ボタンをクリックして OCR 処理を実行
4. **結果確認**: 抽出されたテキストを確認・編集

### テキスト要約タスク

1. **テキスト入力**: 要約したいテキストを入力または貼り付け
2. **設定カスタマイズ**: チャンクサイズやメモリ使用量などを調整
3. **要約実行**: 「開始」ボタンをクリック
4. **結果確認**: 生成された要約を確認

### プロンプトテンプレート

1. **テンプレート作成**: カスタムプロンプトテンプレートを作成
2. **インポート**: 既存のテンプレートをインポート可能
3. **適用**: タスク実行時にテンプレートを適用

## ⚙️ 設定

### LLM プロバイダー

MyOCR は以下の LLM プロバイダーをサポートしています：

- **OpenAI**: GPT-4、GPT-3.5-turbo など
- **Anthropic**: Claude シリーズ
- **Ollama**: ローカル LLM
- **Custom**: OpenAI 互換 API

### API 接続テスト

設定画面で各 LLM 設定の接続テストを実行できます。これにより、API キーとベース URL が正しいか確認できます。

## 📊 データベーススキーマ

主要なエンティティ：

- **LLMConfig**: LLM API 設定
- **Directory**: ディレクトリ構造（OCR/要約/プロンプト）
- **OCRTask**: OCR タスク
- **SummaryTask**: 要約タスク
- **Prompt**: プロンプトテンプレート
- **AppState**: アプリケーション状態

## 🔧 開発者向け情報

### コード構造

```
apps/
├── desktop/          # Electron メインアプリ
└── mobile/           # モバイルアプリ（計画中）

packages/
├── ai-core/          # LangChain を使用した AI サービス
│   ├── ocrService.ts
│   └── summaryService.ts
├── database/         # Prisma データベースサービス
├── ipc-client/       # レンダラーからメインプロセスへの IPC
├── types/            # TypeScript タイプ定義
├── ui-components/    # React UI コンポーネント
└── utils/            # 共通ユーティリティ
```

### IPC 通信

Electron のレンダラープロセスとメインプロセス間の通信は、IPC を介して行われます：

```typescript
// レンダラープロセスでの使用例
import { dbService } from '@myocr/ipc-client';

const tasks = await dbService.getAllDirectories();
```

### LangChain 統合

OCR および要約サービスは LangChain を使用して LLM と対話します：

```typescript
import { ocrService } from '@myocr/ai-core';

const result = await ocrService.processImage({
  image: file,
  apiConfigId: 'your-api-id',
  prompt: 'Extract all text from this image',
});
```

## 📝 結果フォーマット

MyOCR は複数の結果フォーマットをサポートしています：

- **PlainText**: 通常のテキスト形式
- **JSON**: 構造化 JSON データ
- **JSONP**: コールバック付き JSON
- **YAML**: YAML 形式
- **XML**: XML 形式

## 🐛 トラブルシューティング

### よくある問題

#### OCR が失敗する

1. API キーが正しいか確認
2. 画像形式がサポートされているか確認（PNG、JPEG など）
3. 画像が大きすぎる場合はリサイズを検討

#### 要約タスクが完了しない

1. テキスト長を確認
2. チャンクサイズ設定を調整
3. LLM の max_tokens 設定を確認

#### データベースエラー

```bash
# Prisma マイグレーションのリセット
pnpm db:migrate:reset

# データベースの再生成
pnpm db:generate
```

## 📦 パッケージ管理

### ワークスペースコマンド

```bash
# すべてのパッケージをインストール
pnpm install -w

# 特定のパッケージをビルド
pnpm --filter @myocr/utils build

# すべてのパッケージをテスト
pnpm test -r
```

## 🤝 コントリビューション

バグ報告や機能提案は大歓迎です！Issue を作成するか、プルリクエストを送ってください。

## 📄 ライセンス

MIT ライセンスの下で公開されています。

## 🔗 関連リンク

- [Utils パッケージドキュメント](./packages/utils/README.md)
- [データベーススキーマ](./database/schema_v3.sql)
- [LangChain ドキュメント](https://js.langchain.com/)
- [Electron ドキュメント](https://www.electronjs.org/docs)

---

**MyOCR** - あなたの OCR・テキスト要約パートナー 🎯
