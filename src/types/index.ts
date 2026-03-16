export interface LLMConfig {
  id: string;
  name: string;
  serverUrl: string;
  apiType: 'openai' | 'anthropic' | 'ollama' | 'custom';
  apiKey: string;
  models: string[];
  selectedModel?: string;
}

export type TaskType = 'ocr' | 'summary' | 'prompt';

export interface Task {
  id: string;
  name: string;
  imageUrl: string;
  imageData?: string; // Base64 encoded image
  result?: string;
  error?: string;
  apiConfigId?: string; // Selected API config ID for this task
  selectedModel?: string; // Selected model for this task
  createdAt: Date;
  updatedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  type: TaskType; // Task type
  // Summary task specific configurations
  memoryUsage?: 'none' | 'trimmed' | 'summarized'; // Memory usage mode
  memoryConfig?: { // Memory configuration parameters
    trigger: number;
    keep: number;
  };
  textSplitConfig?: { // Text splitting configuration
    chunkSize: number;
    chunkOverlap: number;
  };
}

export interface Directory {
  id: string;
  name: string;
  type: TaskType; // Directory type
  tasks: Task[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AppState {
  llmConfigs: LLMConfig[];
  activeConfigId?: string;
  directories: Directory[];
  activeDirectoryId?: string;
}
