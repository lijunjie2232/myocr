import { contextBridge, ipcRenderer } from 'electron';
import type { LLMConfig, Directory, AppState } from '@myocr/types';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Database operations
  db: {
    // LLM Configs
    getAllLLMConfigs: () => ipcRenderer.invoke('db:getAllLLMConfigs'),
    addLLMConfig: (config: LLMConfig) => ipcRenderer.invoke('db:addLLMConfig', config),
    updateLLMConfig: (id: string, updates: Partial<LLMConfig>) => ipcRenderer.invoke('db:updateLLMConfig', id, updates),
    getLLMConfig: (id: string) => ipcRenderer.invoke('db:getLLMConfig', id),
    deleteLLMConfig: (id: string) => ipcRenderer.invoke('db:deleteLLMConfig', id),
    
    // Directories
    getAllDirectories: () => ipcRenderer.invoke('db:getAllDirectories'),
    addDirectory: (directory: Directory) => ipcRenderer.invoke('db:addDirectory', directory),
    updateDirectory: (id: string, directory: Directory) => ipcRenderer.invoke('db:updateDirectory', id, directory),
    getDirectory: (id: string) => ipcRenderer.invoke('db:getDirectory', id),
    getDirectoryWithTasks: (directoryId: string) => ipcRenderer.invoke('db:getDirectoryWithTasks', directoryId),
    deleteDirectory: (id: string) => ipcRenderer.invoke('db:deleteDirectory', id),
    
    // App State
    getAppState: () => ipcRenderer.invoke('db:getAppState'),
    saveAppState: (state: AppState) => ipcRenderer.invoke('db:saveAppState', state),
    
    // OCR Tasks
    createOcrTask: (task: any) => ipcRenderer.invoke('db:createOcrTask', task),
    updateOcrTask: (id: string, updates: any) => ipcRenderer.invoke('db:updateOcrTask', id, updates),
    getOcrTasksByDirectory: (directoryId: string) => ipcRenderer.invoke('db:getOcrTasksByDirectory', directoryId),
    deleteOcrTask: (id: string) => ipcRenderer.invoke('db:deleteOcrTask', id),
    
    // Summary Tasks
    createSummaryTask: (task: any) => ipcRenderer.invoke('db:createSummaryTask', task),
    updateSummaryTask: (id: string, updates: any) => ipcRenderer.invoke('db:updateSummaryTask', id, updates),
    getSummaryTasksByDirectory: (directoryId: string) => ipcRenderer.invoke('db:getSummaryTasksByDirectory', directoryId),
    deleteSummaryTask: (id: string) => ipcRenderer.invoke('db:deleteSummaryTask', id),
    
    // Prompt Templates
    createPrompt: (task: any) => ipcRenderer.invoke('db:createPrompt', task),
    getPromptsByDirectory: (directoryId: string) => ipcRenderer.invoke('db:getPromptsByDirectory', directoryId),
    deletePrompt: (id: string) => ipcRenderer.invoke('db:deletePrompt', id),
    updatePrompt: (id: string, updates: any) => ipcRenderer.invoke('db:updatePrompt', id, updates),
  },
  
  // OCR Service
  ocr: {
    processImage: (request: any) => ipcRenderer.invoke('ocr:processImage', request),
    setApiInstances: (configs: any[]) => ipcRenderer.invoke('ocr:setApiInstances', configs),
  },
  
  // Summary Service
  summary: {
    processSummary: (request: any) => ipcRenderer.invoke('summary:processSummary', request),
    setApiInstances: (configs: any[]) => ipcRenderer.invoke('summary:setApiInstances', configs),
  },
});
