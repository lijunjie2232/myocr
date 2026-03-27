/* eslint-disable @typescript-eslint/no-explicit-any */
// IPC Client Service for Renderer Process (React)
// This service calls Electron main process via IPC
import type { AppState, LLMConfig, Directory, ElectronAPI } from "@myocr/types";

class DatabaseIPCClient {
  /**
   * Electron 環境で実行されているかを確認
   */
  private isElectron(): boolean {
    return !!(window && (window as Window & typeof globalThis & { electronAPI?: ElectronAPI }).electronAPI);
  }

  // ==================== LLM Configs ====================

  async getAllLLMConfigs(): Promise<LLMConfig[]> {
    if (!this.isElectron()) {
      console.warn('Not running in Electron, database operations will fail');
      return [];
    }
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    return await win.electronAPI!.db.getAllLLMConfigs();
  }

  async addLLMConfig(config: LLMConfig): Promise<void> {
    if (!this.isElectron()) {
      console.warn('Not running in Electron, cannot add LLM config');
      return;
    }
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    await win.electronAPI!.db.addLLMConfig(config);
  }

  async updateLLMConfig(id: string, updates: Partial<LLMConfig>): Promise<void> {
    if (!this.isElectron()) {
      console.warn('Not running in Electron, cannot update LLM config');
      return;
    }
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    await win.electronAPI!.db.updateLLMConfig(id, updates);
  }

  async getLLMConfig(id: string): Promise<LLMConfig | undefined> {
    if (!this.isElectron()) {
      console.warn('Not running in Electron, cannot get LLM config');
      return undefined;
    }
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    return await win.electronAPI!.db.getLLMConfig(id);
  }

  async deleteLLMConfig(id: string): Promise<void> {
    if (!this.isElectron()) {
      console.warn('Not running in Electron, cannot delete LLM config');
      return;
    }
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    await win.electronAPI!.db.deleteLLMConfig(id);
  }

  // ==================== Directories ====================

  async getAllDirectories(): Promise<Directory[]> {
    if (!this.isElectron()) {
      console.warn('Not running in Electron, database operations will fail');
      return [];
    }
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    const dirs = await win.electronAPI!.db.getAllDirectories();
    
    // Convert dates back from ISO strings
    return dirs.map(d => ({
      ...d,
      createdAt: new Date(d.createdAt as unknown as string),
      updatedAt: new Date(d.updatedAt as unknown as string),
      tasks: d.tasks.map((t: any) => ({
        ...t,
        metadata: this.parseMetadata((t as any).metadata),
        createdAt: new Date((t as any).createdAt as unknown as string),
        updatedAt: new Date((t as any).updatedAt as unknown as string),
      })),
    }));
  }

  async addDirectory(directory: Directory): Promise<void> {
    if (!this.isElectron()) {
      console.warn('Not running in Electron, cannot add directory');
      return;
    }
    
    // Check if a directory with the same name and type already exists
    const existingDirs = await this.getAllDirectories();
    const exists = existingDirs.some(
      d => d.name === directory.name && d.type === directory.type
    );
    
    if (exists) {
      console.warn(`Directory "${directory.name}" (${directory.type}) already exists, skipping creation`);
      return;
    }
    
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    await win.electronAPI!.db.addDirectory(directory);
  }

  async updateDirectory(id: string, directory: Directory): Promise<void> {
    if (!this.isElectron()) {
      console.warn('Not running in Electron, cannot update directory');
      return;
    }
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    await win.electronAPI!.db.updateDirectory(id, directory);
  }

  async getDirectory(id: string): Promise<Directory | undefined> {
    if (!this.isElectron()) {
      console.warn('Not running in Electron, cannot get directory');
      return undefined;
    }
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    const dir = await win.electronAPI!.db.getDirectory(id);
    if (dir) {
      // Convert ISO date strings back to Date objects
      dir.createdAt = new Date(dir.createdAt as unknown as string);
      dir.updatedAt = new Date(dir.updatedAt as unknown as string);
      dir.tasks = dir.tasks.map((t: any) => ({
        ...t,
        metadata: this.parseMetadata((t as any).metadata),
        createdAt: new Date((t as any).createdAt as unknown as string),
        updatedAt: new Date((t as any).updatedAt as unknown as string),
      }));
    }
    return dir;
  }

  async getDirectoryWithTasks(directoryId: string): Promise<Directory | null> {
    if (!this.isElectron()) {
      console.warn('Not running in Electron, cannot get directory with tasks');
      return null;
    }
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    const directory = await win.electronAPI!.db.getDirectoryWithTasks(directoryId);
    
    if (!directory) return null;
    
    // Convert dates and metadata for tasks
    return {
      ...directory,
      tasks: directory.tasks.map((task: any) => ({
        ...task,
        metadata: this.parseMetadata((task as any).metadata),
        createdAt: new Date((task as any).createdAt as unknown as string),
        updatedAt: new Date((task as any).updatedAt as unknown as string),
      })),
    };
  }

  private parseMetadata(metadata: unknown): Record<string, unknown> | null {
    if (!metadata) return null;
    if (typeof metadata === 'string') {
      try {
        return JSON.parse(metadata);
      } catch {
        return null;
      }
    }
    // Ensure it's a proper Record<string, unknown>
    if (typeof metadata === 'object' && metadata !== null) {
      return metadata as Record<string, unknown>;
    }
    return null;
  }

  async deleteDirectory(id: string): Promise<void> {
    if (!this.isElectron()) {
      console.warn('Not running in Electron, cannot delete directory');
      return;
    }
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    await win.electronAPI!.db.deleteDirectory(id);
  }

  // ==================== App State ====================

  async getAppState(): Promise<AppState | null> {
    if (!this.isElectron()) {
      return null;
    }
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    const state = await win.electronAPI!.db.getAppState();
    
    if (state) {
      // Convert dates
      state.directories = state.directories.map((d) => ({
        ...d,
        id: d.id,
        name: d.name,
        type: d.type,
        createdAt: new Date(d.createdAt as unknown as string),
        updatedAt: new Date(d.updatedAt as unknown as string),
        tasks: (d.tasks || []).map((t) => ({
          ...t,
          id: t.id,
          name: t.name,
          type: t.type,
          status: t.status,
          createdAt: new Date(t.createdAt as unknown as string),
          updatedAt: new Date(t.updatedAt as unknown as string),
        })),
      }));
    }
    
    return state;
  }

  async saveAppState(state: AppState): Promise<void> {
    if (!this.isElectron()) {
      console.warn('Not running in Electron, cannot save app state');
      return;
    }
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    await win.electronAPI!.db.saveAppState(state);
  }

  // ==================== Tasks ====================

  async createOcrTask(task: any): Promise<void> {
    if (!this.isElectron()) {
      console.warn('Not running in Electron, cannot create OCR task');
      return;
    }
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    await win.electronAPI!.db.createOcrTask(task);
  }

  async createPrompt(task: any): Promise<void> {
    if (!this.isElectron()) {
      console.warn('Not running in Electron, cannot create prompt');
      return;
    }
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    await win.electronAPI!.db.createPrompt(task);
  }

  async getPromptsByDirectory(directoryId: string): Promise<any[]> {
    if (!this.isElectron()) {
      console.warn('Not running in Electron, cannot get prompts');
      return [];
    }
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    const rows = await win.electronAPI!.db.getPromptsByDirectory(directoryId);
    
    // Convert dates and metadata
    return rows.map((row: any) => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      createdAt: new Date(row.createdAt as any),
      updatedAt: new Date(row.updatedAt as any),
    }));
  }

  async updatePrompt(id: string, updates: any): Promise<void> {
    if (!this.isElectron()) {
      console.warn('Not running in Electron, cannot update prompt');
      return;
    }
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    await win.electronAPI!.db.updatePrompt(id, updates);
  }

  async deletePrompt(id: string): Promise<void> {
    if (!this.isElectron()) {
      console.warn('Not running in Electron, cannot delete prompt');
      return;
    }
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    await win.electronAPI!.db.deletePrompt(id);
  }

  async updateOcrTask(id: string, updates: any): Promise<void> {
    if (!this.isElectron()) {
      console.warn('Not running in Electron, cannot update OCR task');
      return;
    }
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    await win.electronAPI!.db.updateOcrTask(id, updates);
  }

  async getOcrTasksByDirectory(directoryId: string): Promise<any[]> {
    if (!this.isElectron()) {
      console.warn('Not running in Electron, cannot get OCR tasks');
      return [];
    }
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    const rows = await win.electronAPI!.db.getOcrTasksByDirectory(directoryId);
    
    // Convert dates and metadata
    return rows.map((row: any) => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      createdAt: new Date(row.createdAt as any),
      updatedAt: new Date(row.updatedAt as any),
    }));
  }

  async deleteOcrTask(id: string): Promise<void> {
    if (!this.isElectron()) {
      console.warn('Not running in Electron, cannot delete OCR task');
      return;
    }
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    await win.electronAPI!.db.deleteOcrTask(id);
  }

  // ==================== Summary Tasks ====================

  async createSummaryTask(task: any): Promise<void> {
    if (!this.isElectron()) {
      console.warn('Not running in Electron, cannot create summary task');
      return;
    }
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    await win.electronAPI!.db.createSummaryTask(task);
  }

  async updateSummaryTask(id: string, updates: any): Promise<void> {
    if (!this.isElectron()) {
      console.warn('Not running in Electron, cannot update summary task');
      return;
    }
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    await win.electronAPI!.db.updateSummaryTask(id, updates);
  }

  async getSummaryTasksByDirectory(directoryId: string): Promise<any[]> {
    if (!this.isElectron()) {
      console.warn('Not running in Electron, cannot get summary tasks');
      return [];
    }
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    const rows = await win.electronAPI!.db.getSummaryTasksByDirectory(directoryId);
    
    // Convert dates and metadata
    return rows.map((row: any) => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      createdAt: new Date(row.createdAt as any),
      updatedAt: new Date(row.updatedAt as any),
    }));
  }

  async deleteSummaryTask(id: string): Promise<void> {
    if (!this.isElectron()) {
      console.warn('Not running in Electron, cannot delete summary task');
      return;
    }
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    await win.electronAPI!.db.deleteSummaryTask(id);
  }

  async clearAllData(): Promise<void> {
    if (!this.isElectron()) {
      console.warn('Not running in Electron, cannot clear data');
      return;
    }
    const win = window as Window & typeof globalThis & { electronAPI?: ElectronAPI };
    await win.electronAPI!.db.clearAllData();
  }
}

export const dbService = new DatabaseIPCClient();
