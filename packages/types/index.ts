// ============================================================================
// LLM Server API Configuration
// ============================================================================

export interface LLMServerAPI {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'ollama' | 'custom';
  baseUrl?: string;
  apiKey: string;
  models: string[];  // Array of available models
  isEnabled: boolean;
  sortOrder: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Legacy interface for backward compatibility (deprecated)
export interface LLMConfig {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'ollama' | 'custom';
  model?: string;  // Made optional (legacy field)
  baseUrl?: string;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
  models?: string[];  // Available models
  is_enabled?: boolean;  // Enabled status
  sort_order?: number;  // Sort order
  metadata?: Record<string, any>;  // Additional metadata
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Task Types
// ============================================================================

export type TaskType = 'ocr' | 'summary' | 'prompt';

// Legacy unified Task interface (deprecated, use specific task types instead)
export interface Task {
  id: string;
  name: string;
  type: TaskType;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  config?: any; // Store task configuration as JSON
  inputText?: string;
  result?: string;
  errorMessage?: string;
  imageUrl?: string; // Image URL for OCR tasks (legacy)
  apiConfigId?: string; // Selected API config ID
  selectedModel?: string; // Selected model ID
  temperature?: number; // Temperature setting
  maxTokens?: number; // Max tokens setting
  customPrompt?: string; // Custom prompt for the task
  memoryUsage?: 'none' | 'trimmed' | 'summarized'; // Memory usage for summary tasks
  memoryConfig?: { trigger: number; keep: number }; // Memory configuration
  textSplitConfig?: { chunkSize: number; chunkOverlap: number }; // Text split configuration
  resultFormat?: 'plaintext' | 'json' | 'jsonp' | 'yaml' | 'xml'; // Result format for summary tasks
  metadata?: Record<string, any>; // Metadata for storing processing details
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// OCR Module
// ============================================================================

export interface OCRDirectory {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface OCRTask {
  id: string;
  directoryId: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  
  // Image data (BLOB storage - no file path or URL)
  imageBlob: Uint8Array;  // Binary image data (Buffer in Node.js, Blob in browser)
  imageMimeType: string;  // e.g., 'image/png', 'image/jpeg'
  imageFilename?: string;  // Original filename
  
  // OCR result
  result?: string;
  errorMessage?: string;
  
  // API configuration
  apiConfigId?: string;
  selectedModel?: string;
  
  // Processing parameters
  temperature?: number;
  maxTokens?: number;
  customPrompt?: string;
  
  // Metadata
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Summary Module
// ============================================================================

export interface SummaryDirectory {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SummaryTask {
  id: string;
  directoryId: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  
  // Input text (long text storage - no file path)
  inputText: string;  // Can be very long text (thousands of characters)
  
  // Summary result
  result?: string;
  errorMessage?: string;
  
  // API configuration
  apiConfigId?: string;
  selectedModel?: string;
  
  // Processing parameters
  temperature?: number;
  maxTokens?: number;
  customPrompt?: string;
  resultFormat?: 'plaintext' | 'json' | 'jsonp' | 'yaml' | 'xml';
  
  // Metadata
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Prompt Module
// ============================================================================

export interface PromptDirectory {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Prompt {
  id: string;
  directoryId: string;
  name: string;
  content: string;  // Prompt template content
  type: 'custom' | 'system' | 'user';
  category?: string;
  variables: string[];  // Variable definitions
  description?: string;
  isPublic: boolean;
  usageCount: number;
  isFavorite: boolean;
  version: number;
  parentId?: string;  // For versioning/inheritance
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Directory (Legacy - for backward compatibility)
// ============================================================================

/**
 * @deprecated Use OCRDirectory, SummaryDirectory, or PromptDirectory instead
 */
export interface Directory {
  id: string;
  name: string;
  type: TaskType;
  description?: string;  // Added description
  metadata?: Record<string, any>;  // Added metadata
  tasks: Task[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Auxiliary Types
// ============================================================================

export interface AppSetting {
  key: string;
  value: string;  // JSON string
  description?: string;
  updatedAt: Date;
}

export interface TaskExecutionLog {
  id: string;
  taskId: string;
  taskType: 'ocr' | 'summary' | 'prompt';
  action: string;
  message?: string;
  details?: Record<string, any>;
  createdAt: Date;
}

export interface FileAttachment {
  id: string;
  taskId: string;
  taskType: 'ocr' | 'summary' | 'prompt';
  fileName: string;
  fileType: string;  // MIME type
  fileSize: number;  // Size in bytes
  fileHash?: string;  // SHA256 hash
  fileBlob: Uint8Array;  // File binary data
  metadata?: Record<string, any>;
  createdAt: Date;
}

// ============================================================================
// Application State
// ============================================================================

/**
 * @deprecated Use separate interfaces for each module instead
 */
export interface AppState {
  llmConfigs: LLMConfig[];
  activeConfigId?: string;
  directories: Directory[];
  activeDirectoryId?: string;  // For backward compatibility
}

export interface AppStateWithDirectoryId extends AppState {
  activeDirectoryId?: string;
}

// ============================================================================
// Electron IPC API Types (for Renderer Process)
// ============================================================================

export interface ElectronAPI {
  db: {
    // LLM Configs
    getAllLLMConfigs: () => Promise<LLMConfig[]>;
    addLLMConfig: (config: LLMConfig) => Promise<void>;
    updateLLMConfig: (id: string, updates: Partial<LLMConfig>) => Promise<void>;
    getLLMConfig: (id: string) => Promise<LLMConfig | undefined>;
    deleteLLMConfig: (id: string) => Promise<void>;
    
    // Directories
    getAllDirectories: () => Promise<Directory[]>;
    addDirectory: (directory: Directory) => Promise<void>;
    updateDirectory: (id: string, directory: Directory) => Promise<void>;
    getDirectory: (id: string) => Promise<Directory | undefined>;
    getDirectoryWithTasks: (directoryId: string) => Promise<Directory | null>;
    deleteDirectory: (id: string) => Promise<void>;
    
    // App State
    getAppState: () => Promise<AppState | null>;
    saveAppState: (state: AppState) => Promise<void>;
    
    // Tasks
    createOcrTask: (task: any) => Promise<void>;
    updateOcrTask: (id: string, updates: any) => Promise<void>;
    getOcrTasksByDirectory: (directoryId: string) => Promise<any[]>;
    deleteOcrTask: (id: string) => Promise<void>;
    
    // Prompt Templates
    createPrompt: (task: any) => Promise<void>;
    getPromptsByDirectory: (directoryId: string) => Promise<any[]>;
    updatePrompt: (id: string, updates: any) => Promise<void>;
    deletePrompt: (id: string) => Promise<void>;
    
    // Utility
    clearAllData: () => Promise<void>;
  };
  
  // OCR Service
  ocr: {
    processImage: (request: any) => Promise<{ success: boolean; data: any; error?: string }>;
    setApiInstances: (configs: any[]) => Promise<{ success: boolean }>;
  };
  
  // Summary Service
  summary: {
    processSummary: (request: any) => Promise<{ success: boolean; data: any; error?: string }>;
    setApiInstances: (configs: any[]) => Promise<{ success: boolean }>;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
