import type { AppState, LLMConfig, Directory } from '../types';

const DB_NAME = 'MyOCR_DB';
const DB_VERSION = 1;

// Store names
const STORES = {
  LLM_CONFIGS: 'llm_configs',
  DIRECTORIES: 'directories',
  APP_STATE: 'app_state',
};

class DatabaseService {
  private db: IDBDatabase | null = null;

  /**
   * 打开数据库连接
   */
  async open(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains(STORES.LLM_CONFIGS)) {
          const configStore = db.createObjectStore(STORES.LLM_CONFIGS, { keyPath: 'id' });
          configStore.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.DIRECTORIES)) {
          const dirStore = db.createObjectStore(STORES.DIRECTORIES, { keyPath: 'id' });
          dirStore.createIndex('name', 'name', { unique: false });
          dirStore.createIndex('type', 'type', { unique: false });
          dirStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.APP_STATE)) {
          db.createObjectStore(STORES.APP_STATE, { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * 执行通用的 get 操作
   */
  async get<T>(storeName: string, key: string): Promise<T | undefined> {
    const db = await this.open();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 执行通用的 getAll 操作
   */
  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.open();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 执行通用的 add 操作
   */
  async add<T>(storeName: string, item: T): Promise<void> {
    const db = await this.open();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 执行通用的 put 操作
   */
  async put<T>(storeName: string, item: T): Promise<void> {
    const db = await this.open();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 执行通用的 delete 操作
   */
  async delete(storeName: string, key: string): Promise<void> {
    const db = await this.open();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== LLM Configs ====================

  async getAllLLMConfigs(): Promise<LLMConfig[]> {
    return await this.getAll<LLMConfig>(STORES.LLM_CONFIGS);
  }

  async addLLMConfig(config: LLMConfig): Promise<void> {
    await this.add<LLMConfig>(STORES.LLM_CONFIGS, config);
  }

  async updateLLMConfig(id: string, updates: Partial<LLMConfig>): Promise<void> {
    const config = await this.getLLMConfig(id);
    if (!config) {
      throw new Error(`LLM config ${id} not found`);
    }
    
    const updatedConfig = { ...config, ...updates };
    return this.put<LLMConfig>(STORES.LLM_CONFIGS, updatedConfig);
  }

  async getLLMConfig(id: string): Promise<LLMConfig | undefined> {
    return await this.get<LLMConfig>(STORES.LLM_CONFIGS, id);
  }

  async deleteLLMConfig(id: string): Promise<void> {
    await this.delete(STORES.LLM_CONFIGS, id);
  }

  // ==================== Directories ====================

  async getAllDirectories(): Promise<Directory[]> {
    const dirs = await this.getAll<Directory>(STORES.DIRECTORIES);
    
    // Debug: Log raw data from DB
    console.log('=== Raw Directories from DB ===', {
      count: dirs.length,
      directories: dirs.map(d => ({
        id: d.id,
        name: d.name,
        taskCount: d.tasks.length,
        tasks: d.tasks.map(t => ({
          id: t.id,
          name: t.name,
          status: t.status,
          hasResult: !!t.result,
          resultType: typeof t.result,
          resultLength: t.result?.length,
          hasInputText: !!t.inputText,
          inputTextLength: t.inputText?.length,
        })),
      })),
    });
    
    // Convert dates back from ISO strings
    return dirs.map(d => ({
      ...d,
      createdAt: new Date(d.createdAt),
      updatedAt: new Date(d.updatedAt),
      tasks: d.tasks.map((t: any) => ({
        ...t,
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt),
      })),
    }));
  }

  async addDirectory(directory: Directory): Promise<void> {
    await this.add<Directory>(STORES.DIRECTORIES, directory);
  }

  async updateDirectory(_id: string, directory: Directory): Promise<void> {
    await this.put<Directory>(STORES.DIRECTORIES, directory);
  }

  async getDirectory(id: string): Promise<Directory | undefined> {
    const dir = await this.get<Directory>(STORES.DIRECTORIES, id);
    if (dir) {
      // Convert ISO date strings back to Date objects
      dir.createdAt = new Date(dir.createdAt as any);
      dir.updatedAt = new Date(dir.updatedAt as any);
      dir.tasks = dir.tasks.map((t: any) => ({
        ...t,
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt),
      }));
    }
    return dir;
  }

  async deleteDirectory(id: string): Promise<void> {
    await this.delete(STORES.DIRECTORIES, id);
  }

  // ==================== App State ====================

  async getAppState(): Promise<AppState | null> {
    const result = await this.get<{ value: AppState }>(STORES.APP_STATE, 'state');
    const state = result?.value || null;
    
    if (state) {
      console.log('=== Raw AppState from DB ===', {
        directoryCount: state.directories.length,
        directories: state.directories.map(d => ({
          id: d.id,
          name: d.name,
          taskCount: d.tasks.length,
          tasks: d.tasks.map(t => ({
            id: t.id,
            name: t.name,
            status: t.status,
            hasResult: !!t.result,
            resultType: typeof t.result,
            resultLength: t.result?.length,
            hasInputText: !!t.inputText,
            inputTextLength: t.inputText?.length,
          })),
        })),
      });
      
      // Convert dates
      state.directories = state.directories.map((d: any) => ({
        ...d,
        createdAt: new Date(d.createdAt),
        updatedAt: new Date(d.updatedAt),
        tasks: d.tasks.map((t: any) => ({
          ...t,
          createdAt: new Date(t.createdAt),
          updatedAt: new Date(t.updatedAt),
        })),
      }));
    }
    
    return state;
  }

  async saveAppState(state: AppState): Promise<void> {
    await this.put<{ key: string; value: AppState }>(STORES.APP_STATE, { key: 'state', value: state });
  }

  async clearAllData(): Promise<void> {
    const db = await this.open();
    
    const clearStore = (storeName: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    };
    
    await Promise.all([
      clearStore(STORES.LLM_CONFIGS),
      clearStore(STORES.DIRECTORIES),
      clearStore(STORES.APP_STATE),
    ]);
  }

  /**
   * 导出所有数据（用于备份）
   */
  async exportAllData(): Promise<string> {
    const configs = await this.getAllLLMConfigs();
    const directories = await this.getAllDirectories();
    const appState = await this.getAppState();

    const data = {
      version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      llmConfigs: configs,
      directories,
      appState,
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * 导入数据（用于恢复）
   */
  async importAllData(jsonString: string): Promise<void> {
    try {
      const data = JSON.parse(jsonString);
      
      // Clear existing data
      await this.clearAllData();
      
      // Import LLM configs
      if (data.llmConfigs) {
        for (const config of data.llmConfigs) {
          await this.addLLMConfig(config);
        }
      }
      
      // Import directories
      if (data.directories) {
        for (const directory of data.directories) {
          await this.addDirectory(directory);
        }
      }
      
      // Import app state
      if (data.appState) {
        await this.saveAppState(data.appState);
      }
    } catch (error) {
      console.error('Failed to import data:', error);
      throw new Error('Invalid data format');
    }
  }
}

export const dbService = new DatabaseService();
export default dbService;
