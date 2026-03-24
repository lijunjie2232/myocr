/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import type { LLMConfig, Directory, Prompt, Task } from '@myocr/types';

export class DatabaseService {
  private prisma: PrismaClient;

  constructor(dbPath: string) {
    // Initialize Prisma Client with SQLite database using better-sqlite3 adapter
    const connectionString = `file:${dbPath}`;
    const adapter = new PrismaBetterSqlite3({ url: connectionString });
    this.prisma = new PrismaClient({ adapter });
  }

  // Initialize database connection
  async initialize(): Promise<void> {
    await this.prisma.$connect();
  }

  // Close database connection
  async shutdown(): Promise<void> {
    await this.prisma.$disconnect();
  }

  // ==================== LLM Configs ====================

  async getAllLLMConfigs(): Promise<LLMConfig[]> {
    const configs = await this.prisma.llmServerApi.findMany({
      where: {
        isEnabled: true,
      },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });
    
    return configs.map(config => ({
      id: config.id,
      name: config.name,
      provider: config.provider as 'openai' | 'anthropic' | 'ollama' | 'custom',
      baseUrl: config.baseUrl ?? undefined,
      apiKey: config.apiKey,
      models: JSON.parse(config.models || '[]'),
      is_enabled: config.isEnabled,
      sort_order: config.sortOrder,
      metadata: config.metadata ? JSON.parse(config.metadata) : undefined,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }));
  }

  async addLLMConfig(config: LLMConfig): Promise<void> {
    const now = new Date();
    await this.prisma.llmServerApi.create({
      data: {
        id: config.id,
        name: config.name,
        provider: config.provider,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        models: JSON.stringify(config.models || []),
        isEnabled: true,
        sortOrder: 0,
        metadata: config.metadata ? JSON.stringify(config.metadata) : null,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  async updateLLMConfig(id: string, updates: Partial<LLMConfig>): Promise<void> {
    const updateData: { [key: string]: unknown } = {
      updatedAt: new Date(),
    };
    
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.provider !== undefined) updateData.provider = updates.provider;
    if (updates.baseUrl !== undefined) updateData.baseUrl = updates.baseUrl;
    if (updates.apiKey !== undefined) updateData.apiKey = updates.apiKey;
    if (updates.models !== undefined) updateData.models = JSON.stringify(updates.models);
    if (updates.is_enabled !== undefined) updateData.isEnabled = updates.is_enabled;
    if (updates.sort_order !== undefined) updateData.sortOrder = updates.sort_order;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata ? JSON.stringify(updates.metadata) : null;
    
    await this.prisma.llmServerApi.update({
      where: { id },
      data: updateData,
    });
  }

  async getLLMConfig(id: string): Promise<LLMConfig | undefined> {
    const config = await this.prisma.llmServerApi.findUnique({
      where: { id },
    });
    
    if (!config) return undefined;
    
    return {
      id: config.id,
      name: config.name,
      provider: config.provider as 'openai' | 'anthropic' | 'ollama' | 'custom',
      baseUrl: config.baseUrl ?? undefined,
      apiKey: config.apiKey,
      models: JSON.parse(config.models || '[]'),
      is_enabled: config.isEnabled,
      sort_order: config.sortOrder,
      metadata: config.metadata ? JSON.parse(config.metadata) : undefined,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  async deleteLLMConfig(id: string): Promise<void> {
    await this.prisma.llmServerApi.delete({
      where: { id },
    });
  }

  // ==================== Directories ====================

  async getAllDirectories(): Promise<Directory[]> {
    const [ocrDirs, summaryDirs, promptDirs] = await Promise.all([
      this.prisma.ocrDirectory.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.summaryDirectory.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.promptDirectory.findMany({ orderBy: { name: 'asc' } }),
    ]);
    
    // Combine and convert to unified format
    return [
      ...ocrDirs.map(d => ({
        id: d.id,
        name: d.name,
        type: 'ocr' as const,
        description: d.description ?? undefined,
        metadata: d.metadata ? JSON.parse(d.metadata) : undefined,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        tasks: [], // Tasks are loaded separately via getOcrTasksByDirectory
      })),
      ...summaryDirs.map(d => ({
        id: d.id,
        name: d.name,
        type: 'summary' as const,
        description: d.description ?? undefined,
        metadata: d.metadata ? JSON.parse(d.metadata) : undefined,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        tasks: [], // Tasks are loaded separately via getSummaryTasksByDirectory
      })),
      ...promptDirs.map(d => ({
        id: d.id,
        name: d.name,
        type: 'prompt' as const,
        description: d.description ?? undefined,
        metadata: d.metadata ? JSON.parse(d.metadata) : undefined,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        tasks: [], // Tasks are loaded separately via getPromptsByDirectory
      })),
    ];
  }

  // Load tasks for a specific directory and return the full directory object with tasks
  async getDirectoryWithTasks(directoryId: string): Promise<Directory | null> {
    // First get the directory
    const directory = await this.getDirectory(directoryId);
    
    if (!directory) return null;
    
    // Then load tasks based on directory type
    let tasks: Task[] = [];
    switch (directory.type) {
      case 'ocr':
        tasks = await this.getOcrTasksByDirectory(directoryId);
        break;
      case 'summary':
        tasks = await this.getSummaryTasksByDirectory(directoryId);
        break;
      case 'prompt':
        tasks = await this.getPromptsByDirectory(directoryId);
        break;
    }
    
    return {
      ...directory,
      tasks,
    };
  }

  async addDirectory(directory: Directory): Promise<void> {
    const now = new Date();
    
    switch (directory.type) {
      case 'ocr':
        await this.prisma.ocrDirectory.create({
          data: {
            id: directory.id,
            name: directory.name,
            description: directory.description ?? null,
            metadata: directory.metadata ? JSON.stringify(directory.metadata) : null,
            createdAt: now,
            updatedAt: now,
          },
        });
        break;
      case 'summary':
        await this.prisma.summaryDirectory.create({
          data: {
            id: directory.id,
            name: directory.name,
            description: directory.description ?? null,
            metadata: directory.metadata ? JSON.stringify(directory.metadata) : null,
            createdAt: now,
            updatedAt: now,
          },
        });
        break;
      case 'prompt':
        await this.prisma.promptDirectory.create({
          data: {
            id: directory.id,
            name: directory.name,
            description: directory.description ?? null,
            metadata: directory.metadata ? JSON.stringify(directory.metadata) : null,
            createdAt: now,
            updatedAt: now,
          },
        });
        break;
      default:
        throw new Error(`Invalid directory type: ${directory.type}`);
    }
  }

  async updateDirectory(id: string, directory: Directory): Promise<void> {
    const now = new Date();
    const updateData: { name: string; updatedAt: Date; description: string | null; metadata: string | null } = {
      name: directory.name,
      updatedAt: now,
      description: directory.description ?? null,
      metadata: directory.metadata ? JSON.stringify(directory.metadata) : null,
    };
    
    switch (directory.type) {
      case 'ocr':
        await this.prisma.ocrDirectory.update({
          where: { id },
          data: updateData,
        });
        break;
      case 'summary':
        await this.prisma.summaryDirectory.update({
          where: { id },
          data: updateData,
        });
        break;
      case 'prompt':
        await this.prisma.promptDirectory.update({
          where: { id },
          data: updateData,
        });
        break;
      default:
        throw new Error(`Invalid directory type: ${directory.type}`);
    }
  }

  async getDirectory(id: string): Promise<Directory | undefined> {
    // Try each directory type
    let dir = await this.prisma.ocrDirectory.findUnique({ where: { id } });
    if (dir) {
      return {
        id: dir.id,
        name: dir.name,
        type: 'ocr',
        description: dir.description ?? undefined,
        metadata: dir.metadata ? JSON.parse(dir.metadata) : undefined,
        createdAt: dir.createdAt,
        updatedAt: dir.updatedAt,
        tasks: [],
      };
    }
    
    dir = await this.prisma.summaryDirectory.findUnique({ where: { id } });
    if (dir) {
      return {
        id: dir.id,
        name: dir.name,
        type: 'summary',
        description: dir.description ?? undefined,
        metadata: dir.metadata ? JSON.parse(dir.metadata) : undefined,
        createdAt: dir.createdAt,
        updatedAt: dir.updatedAt,
        tasks: [],
      };
    }
    
    dir = await this.prisma.promptDirectory.findUnique({ where: { id } });
    if (dir) {
      return {
        id: dir.id,
        name: dir.name,
        type: 'prompt',
        description: dir.description ?? undefined,
        metadata: dir.metadata ? JSON.parse(dir.metadata) : undefined,
        createdAt: dir.createdAt,
        updatedAt: dir.updatedAt,
        tasks: [],
      };
    }
    
    return undefined;
  }

  async deleteDirectory(id: string): Promise<void> {
    // Delete from all directory types (only one will exist)
    await Promise.all([
      this.prisma.ocrDirectory.delete({ where: { id } }).catch(() => {}),
      this.prisma.summaryDirectory.delete({ where: { id } }).catch(() => {}),
      this.prisma.promptDirectory.delete({ where: { id } }).catch(() => {}),
    ]);
  }

  // ==================== Prompt Templates ====================

  async createPrompt(prompt: Prompt): Promise<void> {
    const now = new Date();
    await this.prisma.prompt.create({
      data: {
        id: prompt.id,
        directoryId: prompt.directoryId,
        name: prompt.name,
        content: prompt.content,
        type: prompt.type ?? 'custom',
        category: prompt.category ?? null,
        variables: JSON.stringify(prompt.variables || []),
        description: prompt.description ?? null,
        isPublic: prompt.isPublic,
        usageCount: prompt.usageCount ?? 0,
        isFavorite: prompt.isFavorite,
        version: prompt.version ?? 1,
        parentId: prompt.parentId ?? null,
        metadata: prompt.metadata ? JSON.stringify(prompt.metadata) : null,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  async getPromptsByDirectory(directoryId: string): Promise<Task[]> {
    const prompts = await this.prisma.prompt.findMany({
      where: { directoryId },
      orderBy: { createdAt: 'desc' },
    });
    
    return prompts.map((prompt) => ({
      id: prompt.id,
      name: prompt.name,
      status: 'completed' as const,
      result: prompt.content,
      type: 'prompt' as const,
      category: prompt.category ?? undefined,
      description: prompt.description ?? undefined,
      variables: JSON.parse(prompt.variables || '[]'),
      isFavorite: prompt.isFavorite,
      usageCount: prompt.usageCount,
      metadata: prompt.metadata ? JSON.parse(prompt.metadata) : undefined,
      createdAt: prompt.createdAt,
      updatedAt: prompt.updatedAt,
    })) as Task[];
  }

  async updatePrompt(id: string, updates: Partial<Prompt>): Promise<void> {
    const updateData: { updatedAt: Date; [key: string]: unknown } = {
      updatedAt: new Date(),
    };
    
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.variables !== undefined) updateData.variables = JSON.stringify(updates.variables);
    if (updates.isFavorite !== undefined) updateData.isFavorite = updates.isFavorite;
    if (updates.usageCount !== undefined) updateData.usageCount = updates.usageCount;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata ? JSON.stringify(updates.metadata) : null;
    
    try {
      await this.prisma.prompt.update({
        where: { id },
        data: updateData,
      });
    } catch (error: unknown) {
      // If record not found, just log warning and skip update
      if ((error as { code?: string }).code === 'P2025') {
        console.warn('[DatabaseService.updatePrompt] Prompt not found, skipping update:', id);
        return;
      }
      throw error;
    }
  }

  async deletePrompt(id: string): Promise<void> {
    try {
      await this.prisma.prompt.delete({
        where: { id },
      });
    } catch (error: unknown) {
      // If record not found, just log warning and skip delete
      if ((error as { code?: string }).code === 'P2025') {
        console.warn('[DatabaseService.deletePrompt] Prompt not found, skipping delete:', id);
        return;
      }
      throw error;
    }
  }

  // ==================== OCR Tasks ====================

  async createOcrTask(task: { id: string; directoryId: string; name: string; status: string; imageData?: string; imageMimeType?: string; imageName?: string; apiConfigId?: string; selectedModel?: string; temperature?: number; maxTokens?: number; customPrompt?: string; metadata?: unknown }): Promise<void> {
    const now = new Date();
    
    // Validate and log image data
    console.log('[DatabaseService] Creating OCR task with image data:', {
      hasImageData: !!task.imageData,
      imageDataLength: task.imageData?.length,
      imageDataPreview: task.imageData?.substring(0, 50) + '...',
      isDataURL: task.imageData?.startsWith('data:'),
      mimeType: task.imageMimeType,
    });
    
    // Ensure imageData is pure base64 (no data URL prefix)
    let pureBase64 = task.imageData;
    if (pureBase64 && typeof pureBase64 === 'string' && pureBase64.startsWith('data:')) {
      console.warn('[DatabaseService] Received data URL instead of pure base64, extracting...');
      const commaIndex = pureBase64.indexOf(',');
      pureBase64 = commaIndex > -1 ? pureBase64.substring(commaIndex + 1) : pureBase64;
    }
    
    await this.prisma.ocrTask.create({
      data: {
        id: task.id,
        directoryId: task.directoryId,
        name: task.name,
        status: task.status ?? 'pending',
        imageBlob: Buffer.from(pureBase64 || '', 'base64'),
        imageMimeType: task.imageMimeType ?? 'image/png',
        imageFilename: task.imageName ?? null,
        apiConfigId: task.apiConfigId ?? null,
        selectedModel: task.selectedModel ?? null,
        temperature: task.temperature ?? 0.6,
        maxTokens: task.maxTokens ?? 2000,
        customPrompt: task.customPrompt ?? null,
        metadata: task.metadata ? JSON.stringify(task.metadata) : null,
        createdAt: now,
        updatedAt: now,
      },
    });
    
    console.log('[DatabaseService] OCR task created successfully');
  }

  async updateOcrTask(id: string, updates: { [key: string]: unknown }): Promise<void> {
    const updateData: { [key: string]: unknown } = {
      updatedAt: new Date(),
    };
    
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.result !== undefined) updateData.result = updates.result;
    if (updates.errorMessage !== undefined) updateData.errorMessage = updates.errorMessage;
    if (updates.apiConfigId !== undefined) updateData.apiConfigId = updates.apiConfigId;
    if (updates.selectedModel !== undefined) updateData.selectedModel = updates.selectedModel;
    if (updates.temperature !== undefined) updateData.temperature = updates.temperature;
    if (updates.maxTokens !== undefined) updateData.maxTokens = updates.maxTokens;
    if (updates.customPrompt !== undefined) updateData.customPrompt = updates.customPrompt;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata ? JSON.stringify(updates.metadata) : null;
    
    try {
      await this.prisma.ocrTask.update({
        where: { id },
        data: updateData,
      });
    } catch (error: unknown) {
      // If record not found, just log warning and skip update
      if ((error as { code?: string }).code === 'P2025') {
        console.warn('[DatabaseService.updateOcrTask] OCR task not found, skipping update:', id);
        return;
      }
      throw error;
    }
  }

  async getOcrTasksByDirectory(directoryId: string): Promise<Task[]> {
    const tasks = await this.prisma.ocrTask.findMany({
      where: { directoryId },
      orderBy: { createdAt: 'desc' },
    });
    
    return tasks.map((task) => {
      // Convert blob (Uint8Array) to base64 string properly
      let base64Data = '';
      if (task.imageBlob) {
        // Handle both Buffer and Uint8Array
        if (Buffer.isBuffer(task.imageBlob)) {
          base64Data = task.imageBlob.toString('base64');
        } else if (task.imageBlob instanceof Uint8Array) {
          // Convert Uint8Array to base64
          base64Data = Buffer.from(task.imageBlob).toString('base64');
        }
      }
      
      // Remove any existing data URL prefix to avoid duplication
      if (base64Data.startsWith('data:')) {
        const commaIndex = base64Data.indexOf(',');
        base64Data = commaIndex > -1 ? base64Data.substring(commaIndex + 1) : base64Data;
      }
      
      return {
        id: task.id,
        name: task.name,
        type: 'ocr' as const,
        status: task.status,
        imageUrl: base64Data && task.imageMimeType 
          ? `data:${task.imageMimeType};base64,${base64Data}`
          : null,
        imageBlob: task.imageBlob,
        imageMimeType: task.imageMimeType,
        metadata: task.metadata ? JSON.parse(task.metadata) : undefined,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      };
    }) as Task[];
  }

  async deleteOcrTask(id: string): Promise<void> {
    try {
      await this.prisma.ocrTask.delete({
        where: { id },
      });
    } catch (error: unknown) {
      // If record not found, just log warning and skip delete
      if ((error as { code?: string }).code === 'P2025') {
        console.warn('[DatabaseService.deleteOcrTask] OCR task not found, skipping delete:', id);
        return;
      }
      throw error;
    }
  }

  // ==================== Summary Tasks ====================

  async createSummaryTask(task: { id: string; directoryId: string; name: string; status?: string; inputText: string; apiConfigId?: string | null; selectedModel?: string | null; temperature?: number; maxTokens?: number; customPrompt?: string | null; resultFormat?: string; metadata?: unknown }): Promise<void> {
    const now = new Date();
    await this.prisma.summaryTask.create({
      data: {
        id: task.id,
        directoryId: task.directoryId,
        name: task.name,
        status: task.status ?? 'pending',
        inputText: task.inputText,
        apiConfigId: task.apiConfigId ?? null,
        selectedModel: task.selectedModel ?? null,
        temperature: task.temperature ?? 0.6,
        maxTokens: task.maxTokens ?? 2000,
        customPrompt: task.customPrompt ?? null,
        resultFormat: task.resultFormat ?? 'plaintext',
        metadata: task.metadata ? JSON.stringify(task.metadata) : null,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  async updateSummaryTask(id: string, updates: any): Promise<void> {
    const updateData: any = {
      updatedAt: new Date(),
    };
    
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.result !== undefined) updateData.result = updates.result;
    if (updates.errorMessage !== undefined) updateData.errorMessage = updates.errorMessage;
    if (updates.apiConfigId !== undefined) updateData.apiConfigId = updates.apiConfigId;
    if (updates.selectedModel !== undefined) updateData.selectedModel = updates.selectedModel;
    if (updates.temperature !== undefined) updateData.temperature = updates.temperature;
    if (updates.maxTokens !== undefined) updateData.maxTokens = updates.maxTokens;
    if (updates.customPrompt !== undefined) updateData.customPrompt = updates.customPrompt;
    if (updates.resultFormat !== undefined) updateData.resultFormat = updates.resultFormat;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata ? JSON.stringify(updates.metadata) : null;
    
    try {
      await this.prisma.summaryTask.update({
        where: { id },
        data: updateData,
      });
    } catch (error: unknown) {
      // If record not found, just log warning and skip update
      if ((error as { code?: string }).code === 'P2025') {
        console.warn('[DatabaseService.updateSummaryTask] Summary task not found, skipping update:', id);
        return;
      }
      throw error;
    }
  }

  async getSummaryTasksByDirectory(directoryId: string): Promise<any[]> {
    const tasks = await this.prisma.summaryTask.findMany({
      where: { directoryId },
      orderBy: { createdAt: 'desc' },
    });
    
    return tasks.map((task: any) => ({
      ...task,
      type: 'summary' as const,
      metadata: task.metadata ? JSON.parse(task.metadata) : null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }));
  }

  async deleteSummaryTask(id: string): Promise<void> {
    try {
      await this.prisma.summaryTask.delete({
        where: { id },
      });
    } catch (error: unknown) {
      // If record not found, just log warning and skip delete
      if ((error as { code?: string }).code === 'P2025') {
        console.warn('[DatabaseService.deleteSummaryTask] Summary task not found, skipping delete:', id);
        return;
      }
      throw error;
    }
  }

  // ==================== App State ====================

  async getAppState(): Promise<any> {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key: 'app_state' },
    });
    return setting ? JSON.parse(setting.value) : null;
  }

  async saveAppState(state: any): Promise<void> {
    await this.prisma.appSetting.upsert({
      where: { key: 'app_state' },
      create: {
        key: 'app_state',
        value: JSON.stringify(state),
        updatedAt: new Date(),
      },
      update: {
        value: JSON.stringify(state),
        updatedAt: new Date(),
      },
    });
  }

  async clearAllData(): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.taskExecutionLog.deleteMany(),
      this.prisma.fileAttachment.deleteMany(),
      this.prisma.ocrTask.deleteMany(),
      this.prisma.summaryTask.deleteMany(),
      this.prisma.prompt.deleteMany(),
      this.prisma.ocrDirectory.deleteMany(),
      this.prisma.summaryDirectory.deleteMany(),
      this.prisma.promptDirectory.deleteMany(),
      this.prisma.llmServerApi.deleteMany(),
      this.prisma.appSetting.deleteMany(),
    ]);
  }

  // Close database connection (alias for shutdown)
  async close(): Promise<void> {
    await this.shutdown();
  }
}
