const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Database operations
  db: {
    // LLM Configs
    getAllLLMConfigs: () => ipcRenderer.invoke('db:getAllLLMConfigs'),
    addLLMConfig: (config) => ipcRenderer.invoke('db:addLLMConfig', config),
    updateLLMConfig: (id, updates) => ipcRenderer.invoke('db:updateLLMConfig', id, updates),
    getLLMConfig: (id) => ipcRenderer.invoke('db:getLLMConfig', id),
    deleteLLMConfig: (id) => ipcRenderer.invoke('db:deleteLLMConfig', id),
    
    // Directories
    getAllDirectories: () => ipcRenderer.invoke('db:getAllDirectories'),
    addDirectory: (directory) => ipcRenderer.invoke('db:addDirectory', directory),
    updateDirectory: (id, directory) => ipcRenderer.invoke('db:updateDirectory', id, directory),
    getDirectory: (id) => ipcRenderer.invoke('db:getDirectory', id),
    deleteDirectory: (id) => ipcRenderer.invoke('db:deleteDirectory', id),
    
    // App State
    getAppState: () => ipcRenderer.invoke('db:getAppState'),
    saveAppState: (state) => ipcRenderer.invoke('db:saveAppState', state),
    
    // OCR Tasks
    createOcrTask: (task) => ipcRenderer.invoke('db:createOcrTask', task),
    updateOcrTask: (id, updates) => ipcRenderer.invoke('db:updateOcrTask', id, updates),
    getOcrTasksByDirectory: (directoryId) => ipcRenderer.invoke('db:getOcrTasksByDirectory', directoryId),
    deleteOcrTask: (id) => ipcRenderer.invoke('db:deleteOcrTask', id),
    
    // Summary Tasks
    createSummaryTask: (task) => ipcRenderer.invoke('db:createSummaryTask', task),
    updateSummaryTask: (id, updates) => ipcRenderer.invoke('db:updateSummaryTask', id, updates),
    getSummaryTasksByDirectory: (directoryId) => ipcRenderer.invoke('db:getSummaryTasksByDirectory', directoryId),
    deleteSummaryTask: (id) => ipcRenderer.invoke('db:deleteSummaryTask', id),
    
    // Prompt Templates
    createPrompt: (task) => ipcRenderer.invoke('db:createPrompt', task),
    getPromptsByDirectory: (directoryId) => ipcRenderer.invoke('db:getPromptsByDirectory', directoryId),
    deletePrompt: (id) => ipcRenderer.invoke('db:deletePrompt', id),
    updatePrompt: (id, updates) => ipcRenderer.invoke('db:updatePrompt', id, updates),
    
    // Utility
    clearAllData: () => ipcRenderer.invoke('db:clearAllData'),
  },
  
  // OCR Service
  ocr: {
    processImage: (request) => ipcRenderer.invoke('ocr:processImage', request),
    setApiInstances: (configs) => ipcRenderer.invoke('ocr:setApiInstances', configs),
  },
  
  // Summary Service
  summary: {
    processSummary: (request) => ipcRenderer.invoke('summary:processSummary', request),
    setApiInstances: (configs) => ipcRenderer.invoke('summary:setApiInstances', configs),
  },
});
