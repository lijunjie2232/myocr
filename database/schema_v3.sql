-- SQLite Database Schema v3.0
-- MyOCR Application - Complete Database Redesign
-- Created: 2026-03-18

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- ============================================================================
-- CORE BUSINESS TABLES
-- ============================================================================

-- 1. LLM Server APIs Configuration
CREATE TABLE IF NOT EXISTS llm_server_apis (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'ollama', 'custom')),
  base_url TEXT,
  api_key TEXT NOT NULL,
  models TEXT NOT NULL DEFAULT '[]',  -- JSON array of model names
  is_enabled INTEGER NOT NULL DEFAULT 1,  -- BOOLEAN: 1=enabled, 0=disabled
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata TEXT,  -- JSON field for extensibility
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_llm_apis_enabled ON llm_server_apis(is_enabled);
CREATE INDEX IF NOT EXISTS idx_llm_apis_provider ON llm_server_apis(provider);
CREATE INDEX IF NOT EXISTS idx_llm_apis_sort ON llm_server_apis(sort_order);

-- Trigger to update timestamp
DROP TRIGGER IF EXISTS update_llm_api_timestamp;
CREATE TRIGGER update_llm_api_timestamp 
UPDATE OF name, provider, base_url, api_key, models, is_enabled, sort_order, metadata ON llm_server_apis
BEGIN
  UPDATE llm_server_apis SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ----------------------------------------------------------------------------

-- 2. OCR Directories
CREATE TABLE IF NOT EXISTS ocr_directories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  metadata TEXT,  -- JSON field for extensibility
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Trigger to update timestamp
DROP TRIGGER IF EXISTS update_ocr_directory_timestamp;
CREATE TRIGGER update_ocr_directory_timestamp 
UPDATE OF name, description, metadata ON ocr_directories
BEGIN
  UPDATE ocr_directories SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ----------------------------------------------------------------------------

-- 3. OCR Tasks (with BLOB image storage)
CREATE TABLE IF NOT EXISTS ocr_tasks (
  id TEXT PRIMARY KEY,
  directory_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  
  -- Image storage: BLOB format
  image_blob BLOB NOT NULL,  -- Image binary data
  image_mime_type TEXT NOT NULL DEFAULT 'image/png',  -- MIME type: image/png, image/jpeg, etc.
  image_filename TEXT,  -- Original filename
  
  -- OCR result
  result TEXT,  -- OCR recognition result
  error_message TEXT,
  
  -- API configuration
  api_config_id TEXT REFERENCES llm_server_apis(id) ON DELETE SET NULL,
  selected_model TEXT,
  
  -- Processing parameters
  temperature REAL DEFAULT 0.6,
  max_tokens INTEGER DEFAULT 2000,
  custom_prompt TEXT,
  
  -- Metadata
  metadata TEXT,  -- JSON field for additional data
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (directory_id) REFERENCES ocr_directories(id) ON DELETE CASCADE
);

CREATE INDEX idx_ocr_tasks_directory ON ocr_tasks(directory_id);
CREATE INDEX idx_ocr_tasks_status ON ocr_tasks(status);
CREATE INDEX idx_ocr_tasks_api_config ON ocr_tasks(api_config_id);
CREATE INDEX idx_ocr_tasks_created ON ocr_tasks(created_at DESC);

CREATE TRIGGER update_ocr_task_timestamp 
UPDATE OF name, status, image_blob, result, error_message, api_config_id, selected_model, temperature, max_tokens, custom_prompt, metadata ON ocr_tasks
BEGIN
  UPDATE ocr_tasks SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ----------------------------------------------------------------------------

-- 4. Summary Directories
CREATE TABLE IF NOT EXISTS summary_directories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  metadata TEXT,  -- JSON field for extensibility
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER update_summary_directory_timestamp 
UPDATE OF name, description, metadata ON summary_directories
BEGIN
  UPDATE summary_directories SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ----------------------------------------------------------------------------

-- 5. Summary Tasks (with long text storage)
CREATE TABLE IF NOT EXISTS summary_tasks (
  id TEXT PRIMARY KEY,
  directory_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  
  -- Input content: Long text storage
  input_text TEXT NOT NULL,  -- Input long text content
  
  -- Summary result
  result TEXT,  -- Summary result
  error_message TEXT,
  
  -- API configuration
  api_config_id TEXT REFERENCES llm_server_apis(id) ON DELETE SET NULL,
  selected_model TEXT,
  
  -- Processing parameters
  temperature REAL DEFAULT 0.6,
  max_tokens INTEGER DEFAULT 2000,
  custom_prompt TEXT,  -- Custom prompt
  result_format TEXT DEFAULT 'plaintext' CHECK (result_format IN ('plaintext', 'json', 'jsonp', 'yaml', 'xml')),
  
  -- Metadata
  metadata TEXT,  -- JSON field for additional data
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (directory_id) REFERENCES summary_directories(id) ON DELETE CASCADE
);

CREATE INDEX idx_summary_tasks_directory ON summary_tasks(directory_id);
CREATE INDEX idx_summary_tasks_status ON summary_tasks(status);
CREATE INDEX idx_summary_tasks_api_config ON summary_tasks(api_config_id);
CREATE INDEX idx_summary_tasks_created ON summary_tasks(created_at DESC);
CREATE INDEX idx_summary_tasks_result_format ON summary_tasks(result_format);

CREATE TRIGGER update_summary_task_timestamp 
UPDATE OF name, status, input_text, result, error_message, api_config_id, selected_model, temperature, max_tokens, custom_prompt, result_format, metadata ON summary_tasks
BEGIN
  UPDATE summary_tasks SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ----------------------------------------------------------------------------

-- 6. Prompt Directories
CREATE TABLE IF NOT EXISTS prompt_directories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  metadata TEXT,  -- JSON field for extensibility
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER update_prompt_directory_timestamp 
UPDATE OF name, description, metadata ON prompt_directories
BEGIN
  UPDATE prompt_directories SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ----------------------------------------------------------------------------

-- 7. Prompts (Template Management)
CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  directory_id TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,  -- Prompt template content
  type TEXT DEFAULT 'custom' CHECK (type IN ('custom', 'system', 'user')),
  category TEXT,
  variables TEXT DEFAULT '[]',  -- JSON array of variable definitions
  description TEXT,
  is_public INTEGER DEFAULT 0,  -- BOOLEAN: 1=public, 0=private
  usage_count INTEGER DEFAULT 0,
  is_favorite INTEGER DEFAULT 0,  -- BOOLEAN: 1=favorite, 0=not favorite
  version INTEGER DEFAULT 1,
  parent_id TEXT REFERENCES prompts(id) ON DELETE SET NULL,  -- For versioning
  
  metadata TEXT,  -- JSON field for additional data
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (directory_id) REFERENCES prompt_directories(id) ON DELETE CASCADE
);

CREATE INDEX idx_prompts_directory ON prompts(directory_id);
CREATE INDEX idx_prompts_type ON prompts(type);
CREATE INDEX idx_prompts_category ON prompts(category);
CREATE INDEX idx_prompts_public ON prompts(is_public);
CREATE INDEX idx_prompts_favorite ON prompts(is_favorite);
CREATE INDEX idx_prompts_parent ON prompts(parent_id);

CREATE TRIGGER update_prompt_timestamp 
UPDATE OF name, content, type, category, variables, description, is_public, usage_count, is_favorite, version, parent_id, metadata ON prompts
BEGIN
  UPDATE prompts SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================================================
-- AUXILIARY TABLES
-- ============================================================================

-- 8. App Settings
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,  -- JSON string
  description TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert default settings
INSERT INTO app_settings (key, value, description) VALUES 
  ('active_llm_api_id', 'null', '現在アクティブな LLM API ID'),
  ('active_directory_id', 'null', '現在アクティブなディレクトリ ID'),
  ('active_directory_type', 'null', '現在のディレクトリタイプ：ocr/summary/prompt'),
  ('app_version', '"1.0.0"', 'アプリケーションバージョン');

-- ----------------------------------------------------------------------------

-- 9. Task Execution Logs
CREATE TABLE IF NOT EXISTS task_execution_logs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('ocr', 'summary', 'prompt')),
  action TEXT NOT NULL,  -- e.g., 'started', 'completed', 'failed', 'api_call'
  message TEXT,  -- Log message
  details TEXT,  -- JSON field for additional details
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (task_id) REFERENCES ocr_tasks(id) ON DELETE CASCADE
  -- Note: Can reference summary_tasks or prompts via polymorphic relation
);

CREATE INDEX idx_logs_task ON task_execution_logs(task_id);
CREATE INDEX idx_logs_type ON task_execution_logs(task_type);
CREATE INDEX idx_logs_action ON task_execution_logs(action);
CREATE INDEX idx_logs_created ON task_execution_logs(created_at DESC);

-- ----------------------------------------------------------------------------

-- 10. File Attachments (Optional Extension)
CREATE TABLE IF NOT EXISTS file_attachments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('ocr', 'summary', 'prompt')),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,  -- MIME type
  file_size INTEGER NOT NULL,  -- Size in bytes
  file_hash TEXT,  -- SHA256 hash for deduplication
  file_blob BLOB NOT NULL,  -- File binary data
  
  metadata TEXT,  -- JSON field for additional data
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (task_id) REFERENCES ocr_tasks(id) ON DELETE CASCADE
  -- Note: Can reference other task tables via polymorphic relation
);

CREATE INDEX idx_attachments_task ON file_attachments(task_id);
CREATE INDEX idx_attachments_type ON file_attachments(task_type);
CREATE INDEX idx_attachments_hash ON file_attachments(file_hash);

-- ============================================================================
-- VIEWS FOR STATISTICS
-- ============================================================================

-- 1. OCR Task Statistics View
CREATE VIEW v_ocr_task_stats AS
SELECT 
  d.id AS directory_id,
  d.name AS directory_name,
  COUNT(t.id) AS total_tasks,
  SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
  SUM(CASE WHEN t.status = 'processing' THEN 1 ELSE 0 END) AS processing_count,
  SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
  SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
  MAX(t.created_at) AS last_task_date
FROM ocr_directories d
LEFT JOIN ocr_tasks t ON d.id = t.directory_id
GROUP BY d.id, d.name;

-- ----------------------------------------------------------------------------

-- 2. Summary Task Statistics View
CREATE VIEW v_summary_task_stats AS
SELECT 
  d.id AS directory_id,
  d.name AS directory_name,
  COUNT(t.id) AS total_tasks,
  SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
  SUM(CASE WHEN t.status = 'processing' THEN 1 ELSE 0 END) AS processing_count,
  SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
  SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
  MAX(t.created_at) AS last_task_date
FROM summary_directories d
LEFT JOIN summary_tasks t ON d.id = t.directory_id
GROUP BY d.id, d.name;

-- ----------------------------------------------------------------------------

-- 3. Prompt Statistics View
CREATE VIEW v_prompt_stats AS
SELECT 
  d.id AS directory_id,
  d.name AS directory_name,
  COUNT(p.id) AS total_prompts,
  SUM(p.usage_count) AS total_usage_count,
  SUM(p.is_favorite) AS favorite_count,
  SUM(p.is_public) AS public_count,
  MAX(p.created_at) AS last_prompt_date
FROM prompt_directories d
LEFT JOIN prompts p ON d.id = p.directory_id
GROUP BY d.id, d.name;

-- ============================================================================
-- DEFAULT DATA (Optional)
-- ============================================================================

-- Insert a sample LLM API configuration (for testing)
-- Uncomment if needed:
/*
INSERT INTO llm_server_apis (id, name, provider, base_url, api_key, models, is_enabled, sort_order) 
VALUES (
  'sample-openai',
  'OpenAI GPT',
  'openai',
  'https://api.openai.com/v1',
  'sk-your-api-key-here',
  '["gpt-4", "gpt-3.5-turbo"]',
  1,
  1
);
*/

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
