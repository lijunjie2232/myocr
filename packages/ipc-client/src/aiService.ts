// AI Services for React Renderer Process
// These services call Electron main process via IPC
// DO NOT import @myocr/ai-core directly in renderer process

import type { ElectronAPI } from '@myocr/types';

export interface OCRRequest {
  image: string | Blob;
  prompt?: string;
  apiConfigId?: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface OCRResponse {
  text: string;
  confidence?: number;
  metadata?: any;
}

export interface SummaryRequest {
  text: string;
  prompt?: string;
  apiConfigId?: string;
  modelId?: string;
  taskId?: string; // Optional task ID for memory tracking
  memoryUsage?: 'none' | 'trimmed' | 'summarized';
  memoryConfig?: {
    trigger: number;
    keep: number;
  };
  textSplitConfig?: {
    chunkSize: number;
    chunkOverlap: number;
  };
  temperature?: number;
  maxTokens?: number;
  resultFormat?: 'plaintext' | 'json' | 'jsonp' | 'yaml' | 'xml';
}

export interface SummaryResponse {
  summary: string;
  metadata?: any;
}

/**
 * Check if running in Electron environment
 */
function isElectron(): boolean {
  return !!(window && (window as Window & typeof globalThis & { electronAPI?: ElectronAPI }).electronAPI);
}

/**
 * OCR Service - calls Electron main process via IPC
 */
export const ocrService = {
  /**
   * Set API instances (configs)
   * This should be called when LLM configs change
   */
  setApiInstances(configs: any[]) {
    if (!isElectron()) {
      console.warn('Not running in Electron, cannot set API instances');
      return;
    }
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    return win.electronAPI!.ocr.setApiInstances(configs);
  },

  /**
   * Process image with OCR
   * Calls Electron main process which uses @myocr/ai-core
   */
  async processImage(request: OCRRequest): Promise<OCRResponse> {
    if (!isElectron()) {
      throw new Error('OCR service only works in Electron environment');
    }

    // Convert Blob to base64 if needed
    let imageData: string;
    if (request.image instanceof Blob) {
      imageData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(request.image as Blob);
      });
    } else {
      imageData = request.image as string;
    }

    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    const result = await win.electronAPI!.ocr.processImage({
      image: imageData,
      apiConfigId: request.apiConfigId || '',
      modelId: request.modelId,  // Fixed: use modelId to match ai-core interface
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      customPrompt: request.prompt,
    });

    if (!result.success) {
      throw new Error(result.error || 'OCR processing failed');
    }

    return result.data;
  },
};

/**
 * Summary Service - calls Electron main process via IPC
 */
export const summaryService = {
  /**
   * Set API instances (configs)
   * This should be called when LLM configs change
   */
  setApiInstances(configs: any[]) {
    if (!isElectron()) {
      console.warn('Not running in Electron, cannot set API instances');
      return;
    }
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    return win.electronAPI!.summary.setApiInstances(configs);
  },

  /**
   * Process text summary
   * Calls Electron main process which uses @myocr/ai-core
   */
  async processSummary(request: SummaryRequest): Promise<SummaryResponse> {
    if (!isElectron()) {
      throw new Error('Summary service only works in Electron environment');
    }

    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    const result = await win.electronAPI!.summary.processSummary({
      ...request,
      inputText: request.text, // Map text to inputText for backward compatibility
      apiConfigId: request.apiConfigId || '',
    });

    if (!result.success) {
      throw new Error(result.error || 'Summary processing failed');
    }

    return result.data;
  },
};
