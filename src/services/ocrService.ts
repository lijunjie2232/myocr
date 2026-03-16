import { initChatModel } from "langchain";
import type { LLMConfig, Task } from '../types';

export interface OCRRequest {
  image: string | File;
  prompt?: string;
  apiConfigId?: string; // API config ID
  modelId?: string; // Model ID
  temperature?: number;
  maxTokens?: number;
}

export interface OCRResponse {
  text: string;
  confidence?: number;
  metadata?: any;
}

// Service Class - creates new LangChain instances per request
class OCRServiceClass {
  private llmConfigs: Map<string, LLMConfig> = new Map();

  /**
   * Set LLM configurations from AppContext
   */
  setApiInstances(llmConfigs: LLMConfig[]) {
    this.llmConfigs.clear();
    llmConfigs.forEach(config => {
      this.llmConfigs.set(config.id, config);
    });
    console.log(`OCR Service: ${llmConfigs.length} LLM configs loaded`);
  }

  /**
   * Process image with OCR using LangChain
   * Creates a new LLM instance for each request based on task configuration
   */
  async processImage(request: OCRRequest): Promise<OCRResponse> {
    if (!request.apiConfigId) {
      throw new Error('API config ID is required');
    }

    try {
      // Convert image to base64 if it's a File
      let imageData: string;
      if (request.image instanceof File) {
        imageData = await this.fileToBase64(request.image);
      } else {
        imageData = request.image;
      }

      // Get LLM config
      const llmConfig = this.llmConfigs.get(request.apiConfigId);
      if (!llmConfig) {
        throw new Error(`LLM config not found for ID: ${request.apiConfigId}`);
      }

      // Create new LangChain LLM instance for this request
      // Each task run creates a fresh LLM instance with task-specific parameters
      const llm = await this.createLLM(llmConfig, request.modelId, request.temperature, request.maxTokens);
      
      // Build the message content with image and prompt
      const defaultPrompt = 'Please extract all text from this image. Return only the text content.';
      const userPrompt = request.prompt || defaultPrompt;

      // Create message content array with image and text
      const messageContent = [
        {
          type: 'text',
          text: userPrompt,
        },
        {
          type: 'image_url',
          image_url: {
            url: imageData,
          },
        },
      ];

      // Invoke the LLM
      const response = await llm.invoke(messageContent);
      
      return {
        text: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
        confidence: 1.0, // LLM doesn't provide confidence
        metadata: {
          model: request.modelId || llmConfig.selectedModel || 'auto',
          provider: llmConfig.apiType,
          temperature: request.temperature ?? 0.6,
          maxTokens: request.maxTokens,
        },
      };
    } catch (error) {
      console.error('OCR processing failed:', error);
      throw error;
    }
  }

  /**
   * Create a new LangChain LLM instance for each task execution
   * Supports OpenAI, Anthropic, Ollama, and custom providers
   */
  private async createLLM(
    config: LLMConfig,
    modelId?: string,
    temperature?: number,
    maxTokens?: number
  ) {
    const modelName = modelId || config.selectedModel || config.models[0];
    
    console.log('[OCRService] Creating new LangChain LLM instance for task:', {
      provider: config.apiType,
      model: modelName,
      temperature: temperature ?? 0.6,
      maxTokens: maxTokens ?? -1,
      baseURL: config.serverUrl,
    });

    // Map apiType to LangChain provider
    // Support: openai / anthropic / ollama / custom
    let provider: string;
    switch (config.apiType) {
      case 'openai':
        provider = 'openai';
        break;
      case 'anthropic':
        provider = 'anthropic';
        break;
      case 'ollama':
        provider = 'ollama';
        break;
      case 'custom':
        // For custom providers, use openai-compatible API
        provider = 'openai';
        break;
      default:
        provider = 'openai';
    }

    // Create new LLM instance using initChatModel
    // This ensures each task gets a fresh instance with its own parameters
    const llm = await initChatModel(
      modelName,
      {
        modelProvider: provider as any,
        temperature: temperature ?? 0.6,
        configuration: {
          baseURL: config.serverUrl,
          apiKey: config.apiKey,
        },
        // Only pass maxTokens if it exists and is not -1
        ...(maxTokens && maxTokens > 0 ? { maxTokens } : {}),
      }
    );

    return llm;
  }

  /**
   * Convert File to base64
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

export const ocrService = new OCRServiceClass();
