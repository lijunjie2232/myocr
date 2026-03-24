// Summary Service - Implementation with LangChain Agent
// Uses createAgent for ReAct agent with memory and structured output support

import { createAgent } from "langchain";
import { initChatModel } from "langchain/chat_models/universal";
import { toolStrategy } from "langchain";
import { summarizationMiddleware, createMiddleware } from "langchain";
import { MemorySaver, REMOVE_ALL_MESSAGES } from "@langchain/langgraph";
import { RemoveMessage } from "@langchain/core/messages";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import * as z from "zod";
import type { LLMConfig } from "@myocr/types";

export interface SummaryRequest {
  text: string;
  prompt?: string;
  apiConfigId?: string; // API config ID
  modelId?: string; // Model ID
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
  temperature?: number; // Model temperature
  maxTokens?: number; // Max tokens to generate
  resultFormat?: 'plaintext' | 'json' | 'jsonp' | 'yaml' | 'xml';
}

export interface SummaryResponse {
  summary: string;
  metadata?: unknown;
}

// Structured response schema for summary task
const SummaryResponseSchema = z.object({
  summary: z.string().describe("The concise summary of the provided text"),
  keyPoints: z.array(z.string()).describe("Key points extracted from the text (3-5 points)"),
  length: z.enum(["short", "medium", "long"]).describe("The approximate length of the original text"),
});

// Service Class - creates new LangChain instances per request
class SummaryServiceClass {
  private llmConfigs: Map<string, LLMConfig> = new Map();

  /**
   * Set LLM configurations from AppContext
   */
  setApiInstances(llmConfigs: LLMConfig[]) {
    this.llmConfigs.clear();
    llmConfigs.forEach(config => {
      this.llmConfigs.set(config.id, config);
    });
    console.log(`Summary Service: ${llmConfigs.length} LLM configs loaded`);
  }

  /**
   * Process text summary using LangChain Agent
   * Creates a new agent instance for each request based on task configuration
   */
  async processSummary(request: SummaryRequest): Promise<SummaryResponse> {
    if (!request.apiConfigId) {
      throw new Error('API config ID is required');
    }

    try {
      // Get LLM config
      const llmConfig = this.llmConfigs.get(request.apiConfigId);
      if (!llmConfig) {
        throw new Error(`LLM config not found for ID: ${request.apiConfigId}`);
      }

      console.log('[SummaryService] Processing summary:', {
        apiConfigId: request.apiConfigId,
        configModel: llmConfig.model,
        configProvider: llmConfig.provider,
        requestModelId: request.modelId,
        finalModel: request.modelId || llmConfig.model,
        memoryUsage: request.memoryUsage || 'none',
        resultFormat: request.resultFormat || 'plaintext',
      });

      // Create new LangChain agent for this request
      const agent = await this.createAgent(llmConfig, request);
      
      // Prepare input text with optional chunking
      const inputText = await this.prepareInputText(request.text, request.textSplitConfig);
      
      // Build the user message
      const customPrompt = request.prompt || 'Please provide a concise summary of the following text, highlighting the main points and key insights.';
      const userMessage = `${customPrompt}\n\nText to summarize:\n${inputText}`;
      
      // Use task ID as thread ID if provided, otherwise generate a temporary one
      const threadId = request.taskId || `summary-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Log complete agent configuration before invoke
      console.log('[SummaryService] === Agent Invoke Configuration ===', {
        timestamp: new Date().toISOString(),
        requestId: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        taskId: request.taskId || 'none',
        threadId: threadId,
        llmConfig: {
          provider: llmConfig.provider,
          model: request.modelId || llmConfig.model,
          baseUrl: llmConfig.baseUrl ? `${llmConfig.baseUrl.substring(0, 20)}...` : 'default',
          hasApiKey: !!llmConfig.apiKey,
        },
        modelParameters: {
          temperature: request.temperature ?? 0.7,
          maxTokens: request.maxTokens && request.maxTokens > 0 ? request.maxTokens : 'unlimited',
        },
        memoryConfig: {
          usage: request.memoryUsage || 'none',
          trigger: request.memoryConfig?.trigger,
          keep: request.memoryConfig?.keep,
        },
        inputConfig: {
          textLength: request.text.length,
          inputTextLength: inputText.length,
          textSplitConfig: request.textSplitConfig || 'auto',
        },
        outputConfig: {
          resultFormat: request.resultFormat || 'plaintext',
          useStructuredResponse: true,
        },
        prompt: {
          custom: !!request.prompt,
          preview: customPrompt.substring(0, 100) + (customPrompt.length > 100 ? '...' : ''),
        },
        invokeConfig: {
          messages: [{ role: 'user', contentLength: userMessage.length }],
          configurable: { thread_id: threadId },
        },
      });
      
      // Invoke agent with config containing thread_id
      const result = await agent.invoke(
        {
          messages: [{ role: "user" as const, content: userMessage }]
        },
        {
          configurable: {
            thread_id: threadId
          }
        }
      );
      
      // Extract response
      let summaryText: string;
      if (result.structuredResponse) {
        // Use structured response if available
        const structured = result.structuredResponse as { summary: string; keyPoints?: unknown[] };
        summaryText = this.formatStructuredResponse(structured, request.resultFormat);
      } else {
        // Fall back to last AI message
        const lastMessage = result.messages[result.messages.length - 1];
        summaryText = typeof lastMessage.content === 'string' 
          ? lastMessage.content 
          : JSON.stringify(lastMessage.content);
      }
      
      return {
        summary: summaryText,
        metadata: {
          model: request.modelId || llmConfig.model || 'auto',
          provider: llmConfig.provider,
          temperature: request.temperature ?? 0.7,
          maxTokens: request.maxTokens,
          memoryUsage: request.memoryUsage,
          resultFormat: request.resultFormat,
          inputLength: request.text.length,
          outputLength: summaryText.length,
        },
      };
    } catch (error) {
      console.error('Summary processing failed:', error);
      throw error;
    }
  }

  /**
   * Prepare input text with optional chunking
   */
  private async prepareInputText(text: string, splitConfig?: { chunkSize: number; chunkOverlap: number }): Promise<string> {
    // If text is short enough or no split config, return as-is
    if (!splitConfig || text.length <= splitConfig.chunkSize) {
      return text;
    }

    // Split text into chunks
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: splitConfig.chunkSize,
      chunkOverlap: splitConfig.chunkOverlap,
    });

    const chunks = await splitter.splitText(text);
    
    // For now, just concatenate chunks back (can be enhanced with smarter selection)
    // In future, could implement relevance-based chunk selection
    return chunks.join('\n\n---\n\n');
  }

  /**
   * Format structured response according to requested format
   */
  private formatStructuredResponse(obj: { summary: string; keyPoints?: unknown[] }, format: 'plaintext' | 'json' | 'jsonp' | 'yaml' | 'xml' = 'plaintext'): string {
    if (format === 'plaintext') {
      // Return summary as plain text with key points
      const points = Array.isArray(obj.keyPoints) ? obj.keyPoints : [];
      return `${obj.summary}\n\nKey Points:\n${points.map((p: unknown) => `- ${typeof p === 'string' ? p : String(p)}`).join('\n')}`;
    }

    const jsonStr = JSON.stringify(obj, null, 2);

    if (format === 'json') {
      return jsonStr;
    }

    if (format === 'jsonp') {
      return `callback(${jsonStr});`;
    }

    if (format === 'xml') {
      return this.toXml('response', obj);
    }

    if (format === 'yaml') {
      return this.toJsonYaml(obj);
    }

    return jsonStr;
  }

  /**
   * Simple JSON to XML converter
   */
  private toXml(key: string, value: unknown): string {
    if (value == null) return `<${key}/>`;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const esc = String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<${key}>${esc}</${key}>`;
    }
    if (Array.isArray(value)) {
      return value.map((v) => `<${key}>${this.toXml('item', v)}</${key}>`).join('\n');
    }
    // object
    const inner = Object.entries(value)
      .map(([k, v]) => this.toXml(k, v))
      .join('\n');
    return `<${key}>\n${inner}\n</${key}>`;
  }

  /**
   * Simple JSON to YAML converter
   */
  private toJsonYaml(value: unknown, indent = 0): string {
    const pad = '  '.repeat(indent);
    if (value == null) return `${pad}null\n`;
    if (typeof value === 'string') return `${pad}"${value.replace(/"/g, '\\"')}"\n`;
    if (typeof value === 'number' || typeof value === 'boolean') return `${pad}${value}\n`;
    if (Array.isArray(value)) {
      return value
        .map((v) => `${pad}- ${typeof v === 'object' ? '\n' + this.toJsonYaml(v, indent + 1) : v}`)
        .join('\n') + '\n';
    }
    // object
    return Object.entries(value)
      .map(([k, v]) => `${pad}${k}: ${typeof v === 'object' ? '\n' + this.toJsonYaml(v, indent + 1) : v}`)
      .join('\n') + '\n';
  }

  /**
   * Create a new LangChain agent for each task execution
   */
  private async createAgent(
    config: LLMConfig,
    request: SummaryRequest
  ) {
    const modelName = request.modelId || config.model;
    
    console.log('[SummaryService] Creating new LangChain agent:', {
      provider: config.provider,
      configModel: config.model,
      requestModelId: request.modelId,
      finalModelName: modelName,
      temperature: request.temperature ?? 0.7,
      maxTokens: request.maxTokens,
      memoryUsage: request.memoryUsage || 'none',
    });

    // Map provider to LangChain provider
    // let provider: string;
    // switch (config.provider) {
    //   case 'openai':
    //     provider = 'openai';
    //     break;
    //   case 'anthropic':
    //     provider = 'anthropic';
    //     break;
    //   case 'ollama':
    //     provider = 'ollama';
    //     break;
    //   case 'custom':
    //     provider = 'openai';
    //     break;
    //   default:
    //     provider = 'openai';
    // }
    const provider = config.provider;

    // Create LLM instance
    const llm = await initChatModel(
      modelName,
      {
        modelProvider: provider,
        temperature: request.temperature ?? 0.7,
        configuration: {
          baseURL: config.baseUrl,
          apiKey: config.apiKey,
        },
        ...(request.maxTokens && request.maxTokens > 0 ? { maxTokens: request.maxTokens } : {}),
      }
    );

    // Build middleware array
    const middleware: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any

    // Add system prompt if provided
    if (request.prompt) {
      middleware.push(createMiddleware({
        name: 'SystemPrompt',
        beforeModel: async () => {
          // Can add dynamic prompt here if needed
          return undefined;
        }
      }));
    }

    // Add memory middleware based on configuration
    const checkpointer = new MemorySaver();
    
    if (request.memoryUsage === 'summarized' && request.memoryConfig) {
      // Use summarization middleware
      middleware.push(
        summarizationMiddleware({
          model: llm,
          trigger: { tokens: request.memoryConfig.trigger * 1000 }, // Convert to tokens
          keep: { messages: request.memoryConfig.keep },
        })
      );
    } else if (request.memoryUsage === 'trimmed' && request.memoryConfig) {
      // Use trim messages middleware
      middleware.push(
        createMiddleware({
          name: 'TrimMessages',
          beforeModel: async (state) => {
            const messages = state.messages;
            const keep = request.memoryConfig?.keep || 10;
            
            if (messages.length <= keep) {
              return undefined;
            }

            // Keep first message and last N messages
            const firstMsg = messages[0];
            const recentMessages = messages.slice(-keep);
            const newMessages = [firstMsg, ...recentMessages];

            return {
              messages: [
                new RemoveMessage({ id: REMOVE_ALL_MESSAGES }),
                ...newMessages,
              ],
            };
          },
        })
      );
    }

    // Create agent with structured output
    const agent = createAgent({
      model: llm,
      tools: [],
      middleware,
      checkpointer,
      responseFormat: toolStrategy(SummaryResponseSchema),
    });

    console.log('[SummaryService] LangChain agent created successfully:', {
      model: modelName,
      provider: provider,
      memoryUsage: request.memoryUsage,
    });

    return agent;
  }
}

export const summaryService = new SummaryServiceClass();
