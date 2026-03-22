# @myocr/ipc-client

IPC Client Services for Electron Renderer Process.

## Overview

This package provides IPC (Inter-Process Communication) client services that allow the React renderer process to communicate with the Electron main process.

## Architecture

```
┌─────────────────────────────────────┐
│   Renderer Process (React)          │
│   ┌─────────────────────────────┐   │
│   │  @myocr/ipc-client          │   │
│   │  - dbService                │   │
│   │  - ocrService               │   │
│   │  - summaryService           │   │
│   └─────────────────────────────┘   │
└─────────────────────────────────────┘
                 ↕ IPC
┌─────────────────────────────────────┐
│   Electron Main Process             │
│   ┌─────────────────────────────┐   │
│   │  Database Service (SQLite)  │   │
│   │  AI Service (@myocr/ai-core)│   │
│   └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

## Services

### Database Service

Provides database operations through IPC:

```typescript
import { dbService } from '@myocr/ipc-client/database';

// Get all LLM configs
const configs = await dbService.getAllLLMConfigs();

// Add a new LLM config
await dbService.addLLMConfig(config);

// Update an existing config
await dbService.updateLLMConfig(id, updates);

// Get app state
const state = await dbService.getAppState();
```

### OCR Service

Provides OCR processing through IPC:

```typescript
import { ocrService } from '@myocr/ipc-client/ai';

// Set API instances
ocrService.setApiInstances(configs);

// Process image
const result = await ocrService.processImage({
  image: fileOrBase64,
  apiConfigId: 'config-id',
  modelId: 'model-id',
});
```

### Summary Service

Provides text summarization through IPC:

```typescript
import { summaryService } from '@myocr/ipc-client/ai';

// Set API instances
summaryService.setApiInstances(configs);

// Process summary
const result = await summaryService.processSummary({
  text: 'Your text here',
  apiConfigId: 'config-id',
  memoryUsage: 'summarized',
});
```

## Environment Detection

All services include environment detection to ensure they're running in an Electron environment:

```typescript
function isElectron(): boolean {
  return !!(window && window.electronAPI);
}
```

If not running in Electron, the services will log warnings and return safe defaults or throw errors.

## Future Extensions

This package is designed to support multiple platforms:

- **Electron Web**: Current implementation (window.electronAPI)
- **React Native**: Future implementation (ReactNativeBridge)
- **Tauri**: Future implementation (window.__TAURI__)

Each platform would have its own IPC bridge implementation while maintaining the same service interface.

## Dependencies

- `@myocr/types`: Shared type definitions
- Electron preload script with `electronAPI` exposed

## Usage in UI Components

```typescript
import { useAppContext } from '@myocr/ui-components';

function MyComponent() {
  const { createTask, updateTask } = useAppContext();
  
  // These methods internally use @myocr/ipc-client services
  const handleCreate = async () => {
    const taskId = await createTask(directoryId, taskData);
  };
  
  return <div>...</div>;
}
```
