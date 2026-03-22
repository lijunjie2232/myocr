# @myocr/utils 快速参考

## 📦 安装

在 monorepo 中，工具包已经包含在 workspace 中。运行以下命令确保依赖已安装：

```bash
pnpm install -w
```

## 🚀 使用示例

### 基础导入

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

### 函数说明

#### `downloadTextFile(content: string, filename: string)`

下载文本内容为文件。

```typescript
// 导出为 TXT 文件
const exportData = (data: string) => {
  downloadTextFile(data, 'export.txt');
};

// 导出 JSON
const exportJSON = (obj: object, filename: string) => {
  const json = JSON.stringify(obj, null, 2);
  downloadTextFile(json, filename);
};
```

#### `copyToClipboard(text: string): Promise<boolean>`

复制文本到剪贴板。

```typescript
// 复制文本
const handleCopy = async () => {
  const success = await copyToClipboard('Hello World');
  if (success) {
    console.log('复制成功！');
  }
};

// 复制 OCR 结果
const copyOCRResult = async (result: string) => {
  await copyToClipboard(result);
};
```

#### `fileToDataUrl(file: File): Promise<string>`

将 File 对象转换为 Data URL（Base64）。

```typescript
// 处理图片上传
const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (file) {
    const dataUrl = await fileToDataUrl(file);
    // dataUrl: "data:image/png;base64,iVBORw0KG..."
    console.log(dataUrl);
  }
};

// 预览图片
const PreviewImage = ({ file }: { file: File }) => {
  const [preview, setPreview] = useState('');
  
  useEffect(() => {
    fileToDataUrl(file).then(setPreview);
  }, [file]);
  
  return <img src={preview} alt="Preview" />;
};
```

#### `generateId(): string`

生成唯一的 ID。

```typescript
// 创建任务 ID
const taskId = generateId();
// 示例输出："1710832800000-abc123def"

// 创建临时文件 ID
const tempFileId = generateId();
```

#### `formatDateTime(date: Date): string`

格式化日期时间（中文格式）。

```typescript
// 格式化当前时间
const now = formatDateTime(new Date());
// 输出："2024/03/19 10:30:45"

// 格式化任务创建时间
const taskTime = formatDateTime(task.createdAt);
```

#### `isImageFile(file: File): boolean`

验证文件是否为图片。

```typescript
// 文件上传验证
const handleFileSelect = (file: File) => {
  if (!isImageFile(file)) {
    alert('请选择图片文件');
    return;
  }
  // 继续处理图片
};

// 过滤图片文件
const imageFiles = files.filter(isImageFile);
```

## 💡 实际应用场景

### OCR 图片上传

```typescript
import { fileToDataUrl, generateId, downloadTextFile } from '@myocr/utils';

const handleImageUpload = async (file: File) => {
  // 1. 生成唯一 ID
  const taskId = generateId();
  
  // 2. 转换为 Base64
  const imageData = await fileToDataUrl(file);
  
  // 3. 创建任务
  await createTask({
    id: taskId,
    name: file.name,
    imageUrl: imageData,
    type: 'ocr',
  });
  
  // 4. OCR 完成后导出结果
  const result = await performOCR(imageData);
  downloadTextFile(result.text, `${file.name}-ocr-result.txt`);
};
```

### 批量导出

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

### 复制到剪贴板

```typescript
import { copyToClipboard } from '@myocr/utils';

const ResultCard = ({ result }: { result: string }) => {
  const handleCopy = async () => {
    const success = await copyToClipboard(result);
    if (success) {
      // 显示成功提示
      toast.success('已复制到剪贴板');
    }
  };
  
  return (
    <Box>
      <Typography>{result}</Typography>
      <Button onClick={handleCopy}>复制</Button>
    </Box>
  );
};
```

## ⚠️ 注意事项

### 浏览器环境限制

以下函数**仅在浏览器环境**中可用：

- `downloadTextFile()` - 使用 DOM API
- `copyToClipboard()` - 使用 Clipboard API
- `fileToDataUrl()` - 使用 FileReader API

在 Node.js/Electron 主进程中使用时需要特别注意：

```typescript
// ❌ 错误：在 Electron 主进程中使用
const { downloadTextFile } = await import('@myocr/utils');
downloadTextFile('test', 'test.txt'); // 会失败

// ✅ 正确：在渲染进程或 React 组件中使用
const handleDownload = () => {
  downloadTextFile('test', 'test.txt'); // 正常工作
};
```

### TypeScript 类型

所有函数都有完整的 TypeScript 类型定义，无需额外声明类型。

```typescript
// ✅ 自动推断类型
const url = await fileToDataUrl(file); // string
const success = await copyToClipboard(text); // boolean
```

## 📊 性能提示

### 大文件处理

```typescript
// ✅ 推荐：使用异步方式处理多个文件
const processMultipleFiles = async (files: File[]) => {
  const promises = files.map(file => fileToDataUrl(file));
  const results = await Promise.all(promises);
  return results;
};

// ❌ 不推荐：同步循环会导致性能问题
const results = [];
for (const file of files) {
  results.push(await fileToDataUrl(file)); // 串行处理，慢
}
```

### 内存管理

```typescript
// 及时清理 Object URLs
const previewUrl = URL.createObjectURL(file);
// ... 使用 previewUrl

// 不再需要时清理
URL.revokeObjectURL(previewUrl);
```

## 🔗 相关资源

- [Package 文档](./UTILS_PACKAGE_REFACTOR.md)
- [TypeScript 配置](../../tsconfig.json)
- [Workspace 配置](../../pnpm-workspace.yaml)
