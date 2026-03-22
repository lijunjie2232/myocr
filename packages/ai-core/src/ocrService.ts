import { initChatModel } from "langchain";
import { HumanMessage } from "@langchain/core/messages";
import type { LLMConfig } from "@myocr/types";

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

      console.log('[OCRService] LLM config loaded:', {
        apiConfigId: request.apiConfigId,
        configModel: llmConfig.model,
        configProvider: llmConfig.provider,
        requestModelId: request.modelId,
        finalModel: request.modelId || llmConfig.model,
      });

      // Create new LangChain LLM instance for this request
      // Each task run creates a fresh LLM instance with task-specific parameters
      const llm = await this.createLLM(llmConfig, request.modelId, request.temperature, request.maxTokens);
      
      // Build the message content with image and prompt
      const defaultPrompt = 'Please extract all text from this image. Return only the text content.';
      const userPrompt = request.prompt || defaultPrompt;

      // Extract MIME type and base64 data from data URL
      let mimeType = 'image/png';
      let base64Data = imageData;
      
      console.log('[OCRService] Processing image:', {
        imageDataPreview: imageData.substring(0, 50) + '...',
        imageDataLength: imageData.length,
        startsWithData: imageData.startsWith('data:')
      });
      
      if (imageData.startsWith('data:')) {
        // More robust regex to match data URL format
        const matches = imageData.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (matches) {
          mimeType = `image/${matches[1]}`;
          base64Data = matches[2];
          console.log('[OCRService] Successfully parsed image:', { mimeType, base64Length: base64Data.length });
        } else {
          // Try to extract the actual MIME type for debugging
          const mimeMatch = imageData.match(/^data:([^;]+);base64,/);
          const detectedMime = mimeMatch ? mimeMatch[1] : 'unknown';
          console.error('[OCRService] Invalid image data URL format. Detected MIME type:', detectedMime);
          console.error('[OCRService] Full data URL preview:', imageData.substring(0, 100) + '...');
          throw new Error(`Invalid image data URL format. Expected image/* but got ${detectedMime}`);
        }
      }

      console.log('[OCRService] Image processed:', { mimeType, base64Length: base64Data.length });

      // Create message content blocks with text and image
      const humanMessage = new HumanMessage({
        contentBlocks: [
          { type: 'text', text: userPrompt },
          { type: 'image', mimeType, data: base64Data },
        ],
      });

      // Invoke the LLM with HumanMessage
      const response = await llm.invoke([humanMessage]);
      
      return {
        text: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
        confidence: 1.0, // LLM doesn't provide confidence
        metadata: {
          model: request.modelId || llmConfig.model || 'auto',
          provider: llmConfig.provider,
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
    const modelName = modelId || config.model;
    
    console.log('[OCRService] Creating new LangChain LLM instance for task:', {
      provider: config.provider,
      configModel: config.model,
      requestModelId: modelId,
      finalModelName: modelName,
      temperature: temperature ?? 0.6,
      maxTokens: maxTokens ?? -1,
      baseURL: config.baseUrl,
    });

    // Map provider to LangChain provider
    // Support: openai / anthropic / ollama / custom
    let provider: string;
    switch (config.provider) {
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

    console.log('[OCRService] Mapped provider:', {
      originalProvider: config.provider,
      mappedProvider: provider,
      isCustomProvider: config.provider === 'custom',
    });

    // Create new LLM instance using initChatModel
    // This ensures each task gets a fresh instance with its own parameters
    const llm = await initChatModel(
      modelName,
      {
        modelProvider: provider as any,
        temperature: temperature ?? 0.6,
        configuration: {
          baseURL: config.baseUrl,
          apiKey: config.apiKey,
        },
        // Only pass maxTokens if it exists and is not -1
        ...(maxTokens && maxTokens > 0 ? { maxTokens } : {}),
      }
    );

    console.log('[OCRService] LangChain LLM created successfully:', {
      model: modelName,
      provider: provider,
    });

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
