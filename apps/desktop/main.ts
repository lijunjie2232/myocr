import { app, BrowserWindow, ipcMain } from 'electron';
const path = require('path');
const fs = require('fs');

// Import Database service from packages
import { DatabaseService } from '@myocr/database';

// Import AI services from packages
import { ocrService, summaryService } from '@myocr/ai-core';

let mainWindow;
let dbService: DatabaseService | null = null;

// Initialize Prisma database
async function initDatabase() {
  console.log('[Electron Main] Initializing database...');
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'myocr.db');
  console.log('[Electron Main] Database path:', dbPath);
  
  dbService = new DatabaseService(dbPath);
  await dbService.initialize();
  console.log('[Electron Main] Database initialized at:', dbPath);
}

// Database migration function - currently not used
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function runMigrations() {
  console.log('[Electron Main] Running database migrations...');
  
  try {
    // Check if tasks table has apiConfigId column
    const columns = dbService!.pragma("table_info('tasks')");
    const hasApiConfigId = columns.some((col: any) => col.name === 'apiConfigId');
    const hasSelectedModel = columns.some((col: any) => col.name === 'selectedModel');
    
    console.log('[Electron Main] Current tasks table columns:', columns.map((c: any) => c.name).join(', '));
    
    if (!hasApiConfigId) {
      console.log('[Electron Main] Adding apiConfigId column to tasks table...');
      try {
        dbService!.exec('ALTER TABLE tasks ADD COLUMN apiConfigId TEXT');
        console.log('[Electron Main] Successfully added apiConfigId column');
      } catch (error) {
        console.error('[Electron Main] Failed to add apiConfigId column:', error);
        // Continue even if this fails
      }
    }
    
    if (!hasSelectedModel) {
      console.log('[Electron Main] Adding selectedModel column to tasks table...');
      try {
        dbService!.exec('ALTER TABLE tasks ADD COLUMN selectedModel TEXT');
        console.log('[Electron Main] Successfully added selectedModel column');
      } catch (error) {
        console.error('[Electron Main] Failed to add selectedModel column:', error);
        // Continue even if this fails
      }
    }
    
    console.log('[Electron Main] Database migrations completed.');
  } catch (error) {
    console.error('[Electron Main] Migration failed:', error);
    throw error;
  }
}

function setupIpcHandlers() {
  // LLM Configs
  ipcMain.handle('db:getAllLLMConfigs', () => {
    return dbService!.getAllLLMConfigs();
  });
  
  ipcMain.handle('db:addLLMConfig', (_, config) => {
    dbService!.addLLMConfig(config);
  });
  
  ipcMain.handle('db:updateLLMConfig', (_, id, updates) => {
    dbService!.updateLLMConfig(id, updates);
  });
  
  ipcMain.handle('db:getLLMConfig', (_, id) => {
    return dbService!.getLLMConfig(id);
  });
  
  ipcMain.handle('db:deleteLLMConfig', (_, id) => {
    dbService!.deleteLLMConfig(id);
  });
  
  // Directories - Use DatabaseService methods
  ipcMain.handle('db:getAllDirectories', async () => {
    return await dbService!.getAllDirectories();
  });
  
  ipcMain.handle('db:addDirectory', async (_, directory) => {
    await dbService!.addDirectory(directory);
  });
  
  ipcMain.handle('db:updateDirectory', async (_, id, directory) => {
    await dbService!.updateDirectory(id, directory);
  });
  
  ipcMain.handle('db:getDirectory', async (_, id) => {
    return await dbService!.getDirectory(id);
  });
  
  // Get directory with its tasks loaded
  ipcMain.handle('db:getDirectoryWithTasks', async (_, directoryId) => {
    return await dbService!.getDirectoryWithTasks(directoryId);
  });
  
  ipcMain.handle('db:deleteDirectory', async (_, id) => {
    await dbService!.deleteDirectory(id);
  });
  
  // App State
  ipcMain.handle('db:getAppState', async () => {
    return await dbService!.getAppState();
  });
  
  ipcMain.handle('db:saveAppState', async (_, state) => {
    await dbService!.saveAppState(state);
  });
  
  ipcMain.handle('db:clearAllData', async () => {
    await dbService!.clearAllData();
  });
  
  // ==================== Task Operations ====================
  
  // Create OCR Task
  ipcMain.handle('db:createOcrTask', async (_, task) => {
    await dbService!.createOcrTask(task);
  });
  
  // Update OCR Task
  ipcMain.handle('db:updateOcrTask', async (_, id, updates) => {
    await dbService!.updateOcrTask(id, updates);
  });
  
  // Get OCR Tasks by Directory
  ipcMain.handle('db:getOcrTasksByDirectory', async (_, directoryId) => {
    return await dbService!.getOcrTasksByDirectory(directoryId);
  });
  
  // Delete OCR Task
  ipcMain.handle('db:deleteOcrTask', async (_, id) => {
    await dbService!.deleteOcrTask(id);
  });
  
  // Create Summary Task
  ipcMain.handle('db:createSummaryTask', async (_, task) => {
    await dbService!.createSummaryTask(task);
  });
  
  // Update Summary Task
  ipcMain.handle('db:updateSummaryTask', async (_, id, updates) => {
    await dbService!.updateSummaryTask(id, updates);
  });
  
  // Get Summary Tasks by Directory
  ipcMain.handle('db:getSummaryTasksByDirectory', async (_, directoryId) => {
    return await dbService!.getSummaryTasksByDirectory(directoryId);
  });
  
  // Delete Summary Task
  ipcMain.handle('db:deleteSummaryTask', async (_, id) => {
    await dbService!.deleteSummaryTask(id);
  });
  
  // Create Prompt Template
  ipcMain.handle('db:createPrompt', async (_, prompt) => {
    await dbService!.createPrompt(prompt);
  });
  
  // Get Prompts by Directory
  ipcMain.handle('db:getPromptsByDirectory', async (_, directoryId) => {
    return await dbService!.getPromptsByDirectory(directoryId);
  });
  
  // Update Prompt Template
  ipcMain.handle('db:updatePrompt', async (_, id, updates) => {
    await dbService!.updatePrompt(id, updates);
  });
  
  // Delete Prompt Template
  ipcMain.handle('db:deletePrompt', async (_, id) => {
    await dbService!.deletePrompt(id);
  });
  
  // OCR Service
  ipcMain.handle('ocr:processImage', async (_, request) => {
    try {
      console.log('[Electron Main] OCR request received:', {
        apiConfigId: request.apiConfigId,
        model: request.model,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        customPrompt: request.customPrompt ? 'set' : 'not set',
      });
      const result = await ocrService.processImage(request);
      return { success: true, data: result };
    } catch (error: any) {
      console.error('OCR processing failed:', error);
      return { success: false, error: error.message || 'OCR processing failed' };
    }
  });
  
  ipcMain.handle('ocr:setApiInstances', (_, configs) => {
    ocrService.setApiInstances(configs);
    return { success: true };
  });
  
  // Summary Service
  ipcMain.handle('summary:processSummary', async (_, request) => {
    try {
      const result = await summaryService.processSummary(request);
      return { success: true, data: result };
    } catch (error: any) {
      console.error('Summary processing failed:', error);
      return { success: false, error: error.message || 'Summary processing failed' };
    }
  });
  
  ipcMain.handle('summary:setApiInstances', (_, configs) => {
    summaryService.setApiInstances(configs);
    return { success: true };
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    icon: path.join(__dirname, '../../public/vite.svg'),
  });

  // Load the Vite dev server or built app
  // In development, we still use the dev server for hot reload
  // But we need to handle Node.js-only features differently
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    // Development: load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Production: load built files
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Wait for app to be ready
app.whenReady().then(() => {
  initDatabase();
  setupIpcHandlers();
  createWindow();
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
