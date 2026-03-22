// Summary Service - Implementation left empty for now
// TODO: Implement summary service logic later

import type { LLMConfig } from "@myocr/types";

export interface SummaryRequest {
  text: string;
  prompt?: string;
  apiConfigId?: string; // API config ID
  modelId?: string; // Model ID
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
}

export interface SummaryResponse {
  summary: string;
  metadata?: any;
}

// Service Class - placeholder for future implementation
class SummaryServiceClass {
  /**
   * Set LLM configurations from AppContext
   */
  setApiInstances(_llmConfigs: LLMConfig[]) {
    console.log('Summary Service: API instances set (not yet implemented)');
  }

  /**
   * Process text summary - NOT YET IMPLEMENTED
   */
  async processSummary(_request: SummaryRequest): Promise<SummaryResponse> {
    throw new Error('Summary service not yet implemented');
  }
}

export const summaryService = new SummaryServiceClass();
