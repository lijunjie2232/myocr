import type { LLMConfig } from '@myocr/types';
import { dbService } from '@myocr/ipc-client';

export const llmConfigService = {
  async getAllConfigs(): Promise<LLMConfig[]> {
    try {
      return await dbService.getAllLLMConfigs();
    } catch (error) {
      console.error('Failed to load LLM configs:', error);
      return [];
    }
  },

  async addConfig(config: LLMConfig): Promise<void> {
    try {
      await dbService.addLLMConfig(config);
    } catch (error) {
      console.error('Failed to add LLM config:', error);
    }
  },

  async updateConfig(id: string, updates: Partial<LLMConfig>): Promise<void> {
    try {
      await dbService.updateLLMConfig(id, updates);
    } catch (error) {
      console.error('Failed to update LLM config:', error);
    }
  },

  async deleteConfig(id: string): Promise<void> {
    try {
      await dbService.deleteLLMConfig(id);
    } catch (error) {
      console.error('Failed to delete LLM config:', error);
    }
  },

  async fetchModels(config: LLMConfig): Promise<string[]> {
    try {
      // This will be implemented based on the API type
      const response = await fetch(`${config.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }
      
      const data = await response.json();
      // Adjust based on actual API response format
      return data.data?.map((m: unknown) => (m as { id: string }).id) || data.models || [];
    } catch (error) {
      console.error('Failed to fetch models:', error);
      return [];
    }
  },

  /**
   * LLM API 接続をテスト
   */
  async testConnection(config: LLMConfig): Promise<{ success: boolean; message: string; models?: string[] }> {
    try {
      const url = `${config.baseUrl?.replace(/\/$/, '') || ''}`;
      
      // Different test based on provider
      switch (config.provider) {
        case 'openai':
          return await this.testOpenAI(url, config.apiKey);
        case 'anthropic':
          return await this.testAnthropic(url, config.apiKey);
        case 'ollama':
          return await this.testOllama(url, config.apiKey);
        case 'custom':
          return await this.testCustom(url, config.apiKey);
        default:
          return { success: false, message: `Unsupported provider: ${config.provider}` };
      }
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${(error as Error).message}`,
      };
    }
  },

  /**
   * Ollama API をテスト
   */
  async testOllama(url: string, _apiKey: string): Promise<{ success: boolean; message: string; models?: string[] }> { // eslint-disable-line @typescript-eslint/no-unused-vars
    try {
      const response = await fetch(`${url}/api/tags`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const models = data.models?.map((m: unknown) => (m as { name: string }).name) || [];
      
      return {
        success: true,
        message: `Connection successful! Found ${models.length} models.`,
        models,
      };
    } catch (error) {
      console.error('Ollama connection test failed:', error);
      throw error;
    }
  },

  /**
   * OpenAI 互換 API をテスト
   */
  async testOpenAI(url: string, apiKey: string): Promise<{ success: boolean; message: string; models?: string[] }> {
    // Test by fetching models
    try {
      const response = await fetch(`${url}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      const models = data.data?.map((m: unknown) => (m as { id: string }).id) || [];
      
      return {
        success: true,
        message: `Connection successful! Found ${models.length} models.`,
        models,
      };
    } catch (error) {
      console.error('OpenAI connection test failed:', error);
      throw error;
    }
  },

  /**
   * Anthropic API をテスト
   */
  async testAnthropic(url: string, apiKey: string): Promise<{ success: boolean; message: string; models?: string[] }> {
    // Anthropic doesn't have a models endpoint, so we'll use a simple request
    try {
      // Try to get models from a common endpoint or just test authentication
      const testUrl = `${url}/v1/models`;
      const response = await fetch(testUrl, {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        return {
          success: true,
          message: 'Connection successful! API is responding.',
        };
      } else if (response.status === 404) {
        // Models endpoint not available, but auth might work
        return {
          success: true,
          message: 'Connection successful! API is responding.',
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorData)}`);
      }
    } catch (error) {
      console.error('Anthropic connection test failed:', error);
      throw error;
    }
  },

  /**
   * カスタム API をテスト
   */
  async testCustom(url: string, apiKey: string): Promise<{ success: boolean; message: string; models?: string[] }> {
    // Try common endpoints
    const endpointsToTry = [
      '/models',
      '/api/models',
      '/v1/models',
      '/health',
      '/status',
    ];

    for (const endpoint of endpointsToTry) {
      try {
        const response = await fetch(`${url}${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          return {
            success: true,
            message: `Connection successful via ${endpoint}! Server is responding.`,
          };
        }
      } catch (err) {
        console.error(`Custom endpoint test failed for ${endpoint}:`, err);
        // Try next endpoint
        continue;
      }
    }

    // If no endpoints work, try a simple POST test
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ test: true }),
      });

      if (response.ok || response.status === 400 || response.status === 422) {
        // 400/422 means server is responding (bad request but connection works)
        return {
          success: true,
          message: 'Connection successful! Server is responding.',
        };
      } else {
        throw new Error(`Server responded with HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Custom connection test failed:', error);
      throw new Error(`All test methods failed: ${(error as Error).message}`);
    }
  },
};
