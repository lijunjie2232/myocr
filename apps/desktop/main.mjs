import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ES Module compatibility fix for CommonJS output
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import Database
import Database from 'better-sqlite3';

// Import AI services from packages
import { ocrService, summaryService } from '../../packages/ai-core/src/index.ts';

let mainWindow;
let db = null;

// Initialize SQLite database
function initDatabase() {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'myocr.db');
  
  db = new Database(dbPath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS llm_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      baseUrl TEXT,
      apiKey TEXT,
      temperature REAL DEFAULT 0.7,
      maxTokens INTEGER DEFAULT 2048,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS directories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      directoryId TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      config TEXT,
      inputText TEXT,
      result TEXT,
      errorMessage TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (directoryId) REFERENCES directories(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  
  console.log('Database initialized at:', dbPath);
}

function setupIpcHandlers() {
  // LLM Configs
  ipcMain.handle('db:getAllLLMConfigs', () => {
    const stmt = db.prepare('SELECT * FROM llm_configs ORDER BY createdAt DESC');
    return stmt.all().map(row => ({
      ...row,
      config: row.config ? JSON.parse(row.config) : undefined,
    }));
  });
  
  ipcMain.handle('db:addLLMConfig', (_, config) => {
    const stmt = db.prepare(`
      INSERT INTO llm_configs (id, name, provider, model, baseUrl, apiKey, temperature, maxTokens, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      config.id,
      config.name,
      config.provider,
      config.model,
      config.baseUrl,
      config.apiKey,
      config.temperature,
      config.maxTokens,
      config.createdAt.toISOString(),
      config.updatedAt.toISOString()
    );
  });
  
  ipcMain.handle('db:updateLLMConfig', (_, id, updates) => {
    const fields = [];
    const values = [];
    
    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.provider !== undefined) { fields.push('provider = ?'); values.push(updates.provider); }
    if (updates.model !== undefined) { fields.push('model = ?'); values.push(updates.model); }
    if (updates.baseUrl !== undefined) { fields.push('baseUrl = ?'); values.push(updates.baseUrl); }
    if (updates.apiKey !== undefined) { fields.push('apiKey = ?'); values.push(updates.apiKey); }
    if (updates.temperature !== undefined) { fields.push('temperature = ?'); values.push(updates.temperature); }
    if (updates.maxTokens !== undefined) { fields.push('maxTokens = ?'); values.push(updates.maxTokens); }
    
    fields.push('updatedAt = ?');
    values.push(new Date().toISOString());
    values.push(id);
    
    const stmt = db.prepare(`UPDATE llm_configs SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  });
  
  ipcMain.handle('db:getLLMConfig', (_, id) => {
    const stmt = db.prepare('SELECT * FROM llm_configs WHERE id = ?');
    const row = stmt.get(id);
    return row ? { ...row, config: row.config ? JSON.parse(row.config) : undefined } : undefined;
  });
  
  ipcMain.handle('db:deleteLLMConfig', (_, id) => {
    const stmt = db.prepare('DELETE FROM llm_configs WHERE id = ?');
    stmt.run(id);
  });
  
  // Directories
  ipcMain.handle('db:getAllDirectories', () => {
    const dirsStmt = db.prepare('SELECT * FROM directories ORDER BY createdAt DESC');
    const dirs = dirsStmt.all();
    
    // Get tasks for each directory
    return dirs.map(dir => {
      const tasksStmt = db.prepare('SELECT * FROM tasks WHERE directoryId = ? ORDER BY createdAt DESC');
      const tasks = tasksStmt.all(dir.id).map(task => ({
        ...task,
        config: task.config ? JSON.parse(task.config) : undefined,
      }));
      
      return {
        ...dir,
        tasks,
      };
    });
  });
  
  ipcMain.handle('db:addDirectory', (_, directory) => {
    const stmt = db.prepare(`
      INSERT INTO directories (id, name, type, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      directory.id,
      directory.name,
      directory.type,
      directory.createdAt.toISOString(),
      directory.updatedAt.toISOString()
    );
    
    // Insert tasks
    if (directory.tasks && directory.tasks.length > 0) {
      const taskStmt = db.prepare(`
        INSERT INTO tasks (id, directoryId, name, type, status, config, inputText, result, errorMessage, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      directory.tasks.forEach(task => {
        taskStmt.run(
          task.id,
          directory.id,
          task.name,
          task.type,
          task.status,
          task.config ? JSON.stringify(task.config) : null,
          task.inputText || null,
          task.result || null,
          task.errorMessage || null,
          task.createdAt.toISOString(),
          task.updatedAt.toISOString()
        );
      });
    }
  });
  
  ipcMain.handle('db:updateDirectory', (_, id, directory) => {
    const stmt = db.prepare(`
      UPDATE directories SET name = ?, type = ?, updatedAt = ? WHERE id = ?
    `);
    stmt.run(directory.name, directory.type, new Date().toISOString(), id);
    
    // Update tasks (simplified - in real scenario you'd handle adds/updates/deletes)
    if (directory.tasks) {
      const deleteStmt = db.prepare('DELETE FROM tasks WHERE directoryId = ?');
      deleteStmt.run(id);
      
      const insertStmt = db.prepare(`
        INSERT INTO tasks (id, directoryId, name, type, status, config, inputText, result, errorMessage, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      directory.tasks.forEach(task => {
        insertStmt.run(
          task.id,
          id,
          task.name,
          task.type,
          task.status,
          task.config ? JSON.stringify(task.config) : null,
          task.inputText || null,
          task.result || null,
          task.errorMessage || null,
          task.createdAt.toISOString(),
          task.updatedAt.toISOString()
        );
      });
    }
  });
  
  ipcMain.handle('db:getDirectory', (_, id) => {
    const dirStmt = db.prepare('SELECT * FROM directories WHERE id = ?');
    const dir = dirStmt.get(id);
    
    if (!dir) return undefined;
    
    const tasksStmt = db.prepare('SELECT * FROM tasks WHERE directoryId = ? ORDER BY createdAt DESC');
    const tasks = tasksStmt.all(id).map(task => ({
      ...task,
      config: task.config ? JSON.parse(task.config) : undefined,
    }));
    
    return {
      ...dir,
      tasks,
    };
  });
  
  ipcMain.handle('db:deleteDirectory', (_, id) => {
    const stmt = db.prepare('DELETE FROM directories WHERE id = ?');
    stmt.run(id);
  });
  
  // App State
  ipcMain.handle('db:getAppState', () => {
    const stmt = db.prepare('SELECT value FROM app_state WHERE key = ?');
    const row = stmt.get('state');
    return row ? JSON.parse(row.value) : null;
  });
  
  ipcMain.handle('db:saveAppState', (_, state) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)
    `);
    stmt.run('state', JSON.stringify(state));
  });
  
  ipcMain.handle('db:clearAllData', () => {
    db.exec('DELETE FROM tasks');
    db.exec('DELETE FROM directories');
    db.exec('DELETE FROM llm_configs');
    db.exec('DELETE FROM app_state');
  });
  
  // OCR Service
  ipcMain.handle('ocr:processImage', async (_, request) => {
    try {
      const result = await ocrService.processImage(request);
      return { success: true, data: result };
    } catch (error) {
      console.error('OCR processing failed:', error);
      return { success: false, error: error.message };
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
    } catch (error) {
      console.error('Summary processing failed:', error);
      return { success: false, error: error.message };
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
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
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
