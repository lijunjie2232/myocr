# @myocr/utils クイックリファレンス

## 📦 インストール

モノレポでは、ユーティリティパッケージはワークスペースに含まれています。依存関係がインストールされていることを確認するために、以下を実行してください：

```bash
pnpm install -w
```

## 🚀 使用例

### 基本インポート

```typescript
import { 
  downloadTextFile, 
  copyToClipboard, 
  fileToDataUrl,
  generateId,
  formatDateTime,
  isImageFile
} from '@myocr/utils';
```

### 関数の説明

#### `downloadTextFile(content: string, filename: string)`

テキストコンテンツをファイルとしてダウンロードします。

```typescript
// TXT ファイルとしてエクスポート
const exportData = (data: string) => {
  downloadTextFile(data, 'export.txt');
};

// JSON をエクスポート
const exportJSON = (obj: object, filename: string) => {
  const json = JSON.stringify(obj, null, 2);
  downloadTextFile(json, filename);
};
```

#### `copyToClipboard(text: string): Promise<boolean>`

テキストをクリップボードにコピーします。

```typescript
// テキストをコピー
const handleCopy = async () => {
  const success = await copyToClipboard('Hello World');
  if (success) {
    console.log('コピー成功！');
  }
};

// OCR 結果をコピー
const copyOCRResult = async (result: string) => {
  await copyToClipboard(result);
};
```

#### `fileToDataUrl(file: File): Promise<string>`

File オブジェクトを Data URL（Base64）に変換します。

```typescript
// 画像アップロードを処理
const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (file) {
    const dataUrl = await fileToDataUrl(file);
    // dataUrl: "data:image/png;base64,iVBORw0KG..."
    console.log(dataUrl);
  }
};

// 画像をプレビュー
const PreviewImage = ({ file }: { file: File }) => {
  const [preview, setPreview] = useState('');
  
  useEffect(() => {
    fileToDataUrl(file).then(setPreview);
  }, [file]);
  
  return <img src={preview} alt="Preview" />;
};
```

#### `generateId(): string`

一意の ID を生成します。

```typescript
// タスク ID を作成
const taskId = generateId();
// 例："1710832800000-abc123def"

// 一時ファイル ID を作成
const tempFileId = generateId();
```

#### `formatDateTime(date: Date): string`

日付時刻をフォーマットします（中国語形式）。

```typescript
// 現在時刻をフォーマット
const now = formatDateTime(new Date());
// 出力："2024/03/19 10:30:45"

// タスク作成時間をフォーマット
const taskTime = formatDateTime(task.createdAt);
```

#### `isImageFile(file: File): boolean`

ファイルが画像かどうかを検証します。

```typescript
// ファイルアップロードを検証
const handleFileSelect = (file: File) => {
  if (!isImageFile(file)) {
    alert('画像ファイルを選択してください');
    return;
  }
  // 画像を処理し続ける
};

// 画像ファイルをフィルタリング
const imageFiles = files.filter(isImageFile);
```

## 💡 実際の使用シナリオ

### OCR 画像アップロード

```typescript
import { fileToDataUrl, generateId, downloadTextFile } from '@myocr/utils';

const handleImageUpload = async (file: File) => {
  // 1. 一意の ID を生成
  const taskId = generateId();
  
  // 2. Base64 に変換
  const imageData = await fileToDataUrl(file);
  
  // 3. タスクを作成
  await createTask({
    id: taskId,
    name: file.name,
    imageUrl: imageData,
    type: 'ocr',
  });
  
  // 4. OCR 完了後、結果をエクスポート
  const result = await performOCR(imageData);
  downloadTextFile(result.text, `${file.name}-ocr-result.txt`);
};
```

### バッチエクスポート

```typescript
import { downloadTextFile, formatDateTime } from '@myocr/utils';

const exportAllTasks = (tasks: Task[]) => {
  const content = tasks.map(task => {
    const timestamp = formatDateTime(task.createdAt);
    return `=== ${task.name} (${timestamp}) ===\n${task.result}\n`;
  }).join('\n\n');
  
  downloadTextFile(content, `batch-export-${Date.now()}.txt`);
};
```

### クリップボードにコピー

```typescript
import { copyToClipboard } from '@myocr/utils';

const ResultCard = ({ result }: { result: string }) => {
  const handleCopy = async () => {
    const success = await copyToClipboard(result);
    if (success) {
      // 成功メッセージを表示
      toast.success('クリップボードにコピーしました');
    }
  };
  
  return (
    <Box>
      <Typography>{result}</Typography>
      <Button onClick={handleCopy}>コピー</Button>
    </Box>
  );
};
```

## ⚠️ 注意事項

### ブラウザ環境の制限

以下の関数は**ブラウザ環境のみ**で利用可能です：

- `downloadTextFile()` - DOM API を使用
- `copyToClipboard()` - Clipboard API を使用
- `fileToDataUrl()` - FileReader API を使用

Node.js/Electron メインプロセスで使用する場合の注意：

```typescript
// ❌ エラー：Electron メインプロセスで使用
const { downloadTextFile } = await import('@myocr/utils');
downloadTextFile('test', 'test.txt'); // 失敗します

// ✅ 正解：レンダリングプロセスまたは React コンポーネントで使用
const handleDownload = () => {
  downloadTextFile('test', 'test.txt'); // 正常に動作します
};
```

### TypeScript タイプ

すべての関数には完全な TypeScript タイプ定義があり、追加の宣言は不要です。

```typescript
// ✅ 自動的にタイプを推論
const url = await fileToDataUrl(file); // string
const success = await copyToClipboard(text); // boolean
```

## 📊 パフォーマンスヒント

### 大ファイル処理

```typescript
// ✅ 推奨：複数のファイルを非同期で処理
const processMultipleFiles = async (files: File[]) => {
  const promises = files.map(file => fileToDataUrl(file));
  const results = await Promise.all(promises);
  return results;
};

// ❌ 非推奨：同期ループはパフォーマンスの問題を引き起こす可能性があります
const results = [];
for (const file of files) {
  results.push(await fileToDataUrl(file)); // 逐次処理、遅い
}
```

### メモリ管理

```typescript
// Object URLs をタイムリーにクリーンアップ
const previewUrl = URL.createObjectURL(file);
// ... 使用 previewUrl

// 不要になったらクリーンアップ
URL.revokeObjectURL(previewUrl);
```

## 🔗 相关资源

- [Package 文档](./UTILS_PACKAGE_REFACTOR.md)
- [TypeScript 配置](../../tsconfig.json)
- [Workspace 配置](../../pnpm-workspace.yaml)
