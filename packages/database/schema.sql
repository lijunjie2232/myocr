-- MyOCR SQLite Database Schema
-- Version: 2.0 (Complete Redesign)
-- Description: Brand new database schema without migration from old versions

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- ============================================================================
-- 1. LLM Server APIs Configuration Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS llm_server_apis (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,              -- 'openai', 'anthropic', 'ollama', 'custom'
  base_url TEXT,                       -- Custom API endpoint
  api_key TEXT,                        -- API key (consider encryption in production)
  model_list TEXT,                     -- JSON array of supported models
  is_active INTEGER DEFAULT 1,         -- Boolean: 0=inactive, 1=active
  sort_order INTEGER DEFAULT 0,        -- For UI ordering
  created_at TEXT NOT NULL,            -- ISO 8601 datetime string
  updated_at TEXT NOT NULL             -- ISO 8601 datetime string
);

-- ============================================================================
-- 2. OCR Directories Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS ocr_directories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT,                           -- File system path (optional)
  description TEXT,
  parent_id TEXT,                      -- For hierarchical structure
  sort_order INTEGER DEFAULT 0,
  metadata TEXT,                       -- JSON metadata
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES ocr_directories(id) ON DELETE SET NULL
);

-- ============================================================================
-- 3. OCR Tasks Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS ocr_tasks (
  id TEXT PRIMARY KEY,
  directory_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'
  image_data BLOB NOT NULL,                -- Image file data (stored directly in DB)
  image_mime_type TEXT,                    -- Image MIME type (e.g., image/png, image/jpeg)
  image_name TEXT,                         -- Original image filename
  ocr_result TEXT,                         -- OCR result text or JSON
  confidence_score REAL,                   -- Confidence level (0.0 - 1.0)
  language TEXT,                           -- Recognition language code
  api_config_id TEXT,                      -- Reference to LLM API config
  selected_model TEXT,                     -- Model name used
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  processing_time_ms INTEGER,              -- Execution time in milliseconds
  metadata TEXT,                           -- JSON metadata
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,                       -- Completion timestamp
  FOREIGN KEY (directory_id) REFERENCES ocr_directories(id) ON DELETE CASCADE,
  FOREIGN KEY (api_config_id) REFERENCES llm_server_apis(id) ON DELETE SET NULL
);

-- ============================================================================
-- 4. Summary Directories Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS summary_directories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT,
  description TEXT,
  parent_id TEXT,
  sort_order INTEGER DEFAULT 0,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES summary_directories(id) ON DELETE SET NULL
);

-- ============================================================================
-- 5. Summary Tasks Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS summary_tasks (
  id TEXT PRIMARY KEY,
  directory_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  input_text TEXT NOT NULL,                -- Source text content (stored directly)
  summary_result TEXT,                     -- Generated summary
  summary_length INTEGER,                  -- Length in characters
  compression_ratio REAL,                  -- Compression ratio
  api_config_id TEXT,
  selected_model TEXT,
  temperature REAL DEFAULT 0.7,            -- Temperature setting
  max_tokens INTEGER DEFAULT 2048,         -- Max tokens setting
  prompt_template TEXT,                    -- Prompt template used
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (directory_id) REFERENCES summary_directories(id) ON DELETE CASCADE,
  FOREIGN KEY (api_config_id) REFERENCES llm_server_apis(id) ON DELETE SET NULL
);

-- ============================================================================
-- 6. Prompt Directories Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS prompt_directories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  parent_id TEXT,
  sort_order INTEGER DEFAULT 0,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES prompt_directories(id) ON DELETE SET NULL
);

-- ============================================================================
-- 7. Prompts Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  directory_id TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,                   -- Prompt template content
  description TEXT,
  category TEXT,                           -- Category/tag for organization
  variables TEXT,                          -- JSON array of variable definitions
  output_format TEXT,                      -- Expected output format
  examples TEXT,                           -- JSON array of examples
  version TEXT DEFAULT '1.0.0',            -- Semantic versioning
  is_favorite INTEGER DEFAULT 0,           -- Boolean: favorited
  usage_count INTEGER DEFAULT 0,           -- Number of times used
  api_config_id TEXT,
  selected_model TEXT,
  temperature REAL DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 2048,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (directory_id) REFERENCES prompt_directories(id) ON DELETE CASCADE,
  FOREIGN KEY (api_config_id) REFERENCES llm_server_apis(id) ON DELETE SET NULL
);

-- ============================================================================
-- 8. App Settings Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,                     -- JSON encoded value
  description TEXT,
  updated_at TEXT NOT NULL
);

-- ============================================================================
-- 9. Task Execution Logs Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_execution_logs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  task_type TEXT NOT NULL,                 -- 'ocr', 'summary', 'prompt'
  action TEXT NOT NULL,                    -- 'create', 'start', 'progress', 'complete', 'fail', 'retry'
  message TEXT,
  details TEXT,                            -- JSON detailed information
  duration_ms INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES ocr_tasks(id) ON DELETE CASCADE
);

-- Note: You may want to add foreign keys for summary_tasks and prompts too
-- For simplicity, we're using a loose coupling here

-- ============================================================================
-- 10. File Attachments Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS file_attachments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  task_type TEXT NOT NULL,                 -- 'ocr', 'summary'
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,                       -- Size in bytes
  mime_type TEXT,                          -- MIME type
  file_hash TEXT,                          -- SHA256 hash for deduplication
  storage_type TEXT DEFAULT 'local',       -- 'local' or 'cloud'
  metadata TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES ocr_tasks(id) ON DELETE CASCADE
);

-- ============================================================================
-- Indexes for Performance Optimization
-- ============================================================================

-- LLM Server APIs
CREATE INDEX IF NOT EXISTS idx_llm_apis_provider ON llm_server_apis(provider);
CREATE INDEX IF NOT EXISTS idx_llm_apis_active ON llm_server_apis(is_active);

-- OCR Directories
CREATE INDEX IF NOT EXISTS idx_ocr_dirs_parent ON ocr_directories(parent_id);
CREATE INDEX IF NOT EXISTS idx_ocr_dirs_name ON ocr_directories(name);

-- OCR Tasks
CREATE INDEX IF NOT EXISTS idx_ocr_tasks_directory ON ocr_tasks(directory_id);
CREATE INDEX IF NOT EXISTS idx_ocr_tasks_status ON ocr_tasks(status);
CREATE INDEX IF NOT EXISTS idx_ocr_tasks_api ON ocr_tasks(api_config_id);
CREATE INDEX IF NOT EXISTS idx_ocr_tasks_created ON ocr_tasks(created_at);

-- Summary Directories
CREATE INDEX IF NOT EXISTS idx_summary_dirs_parent ON summary_directories(parent_id);
CREATE INDEX IF NOT EXISTS idx_summary_dirs_name ON summary_directories(name);

-- Summary Tasks
CREATE INDEX IF NOT EXISTS idx_summary_tasks_directory ON summary_tasks(directory_id);
CREATE INDEX IF NOT EXISTS idx_summary_tasks_status ON summary_tasks(status);
CREATE INDEX IF NOT EXISTS idx_summary_tasks_api ON summary_tasks(api_config_id);
CREATE INDEX IF NOT EXISTS idx_summary_tasks_created ON summary_tasks(created_at);

-- Prompt Directories
CREATE INDEX IF NOT EXISTS idx_prompt_dirs_parent ON prompt_directories(parent_id);
CREATE INDEX IF NOT EXISTS idx_prompt_dirs_name ON prompt_directories(name);

-- Prompts
CREATE INDEX IF NOT EXISTS idx_prompts_directory ON prompts(directory_id);
CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(category);
CREATE INDEX IF NOT EXISTS idx_prompts_favorite ON prompts(is_favorite);
CREATE INDEX IF NOT EXISTS idx_prompts_name ON prompts(name);

-- Task Execution Logs
CREATE INDEX IF NOT EXISTS idx_logs_task ON task_execution_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_logs_type ON task_execution_logs(task_type);
CREATE INDEX IF NOT EXISTS idx_logs_action ON task_execution_logs(action);
CREATE INDEX IF NOT EXISTS idx_logs_created ON task_execution_logs(created_at);

-- File Attachments
CREATE INDEX IF NOT EXISTS idx_attachments_task ON file_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_attachments_type ON file_attachments(task_type);

-- ============================================================================
-- Default Data
-- ============================================================================

-- Insert default app settings
INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES 
  ('active_llm_config_id', '{"value": null}', datetime('now')),
  ('app_theme', '{"value": "light"}', datetime('now')),
  ('language', '{"value": "zh-CN"}', datetime('now')),
  ('auto_save', '{"value": true}', datetime('now')),
  ('confirm_before_delete', '{"value": true}', datetime('now')),
  ('max_retry_count', '{"value": 3}', datetime('now'));

-- ============================================================================
-- Views for Common Queries (Optional but Recommended)
-- ============================================================================

-- View: OCR Tasks with Directory Info
CREATE VIEW IF NOT EXISTS v_ocr_tasks_with_dir AS
SELECT 
  t.*,
  d.name as directory_name,
  d.path as directory_path
FROM ocr_tasks t
LEFT JOIN ocr_directories d ON t.directory_id = d.id;

-- View: Summary Tasks with Directory Info
CREATE VIEW IF NOT EXISTS v_summary_tasks_with_dir AS
SELECT 
  t.*,
  d.name as directory_name,
  d.path as directory_path
FROM summary_tasks t
LEFT JOIN summary_directories d ON t.directory_id = d.id;

-- View: Prompts with Directory Info
CREATE VIEW IF NOT EXISTS v_prompts_with_dir AS
SELECT 
  p.*,
  d.name as directory_name
FROM prompts p
LEFT JOIN prompt_directories d ON p.directory_id = d.id;

-- View: Active LLM APIs
CREATE VIEW IF NOT EXISTS v_active_llm_apis AS
SELECT * FROM llm_server_apis
WHERE is_active = 1
ORDER BY sort_order, name;

-- View: Task Statistics
CREATE VIEW IF NOT EXISTS v_task_stats AS
SELECT 
  'ocr' as task_type,
  status,
  COUNT(*) as count
FROM ocr_tasks
GROUP BY status

UNION ALL

SELECT 
  'summary' as task_type,
  status,
  COUNT(*) as count
FROM summary_tasks
GROUP BY status;

-- ============================================================================
-- Triggers for Automatic Timestamp Updates
-- ============================================================================

-- Trigger: Update llm_server_apis timestamp
CREATE TRIGGER IF NOT EXISTS update_llm_apis_timestamp 
AFTER UPDATE ON llm_server_apis
BEGIN
  UPDATE llm_server_apis SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Trigger: Update ocr_directories timestamp
CREATE TRIGGER IF NOT EXISTS update_ocr_dirs_timestamp 
AFTER UPDATE ON ocr_directories
BEGIN
  UPDATE ocr_directories SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Trigger: Update ocr_tasks timestamp
CREATE TRIGGER IF NOT EXISTS update_ocr_tasks_timestamp 
AFTER UPDATE ON ocr_tasks
BEGIN
  UPDATE ocr_tasks SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Trigger: Update summary_directories timestamp
CREATE TRIGGER IF NOT EXISTS update_summary_dirs_timestamp 
AFTER UPDATE ON summary_directories
BEGIN
  UPDATE summary_directories SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Trigger: Update summary_tasks timestamp
CREATE TRIGGER IF NOT EXISTS update_summary_tasks_timestamp 
AFTER UPDATE ON summary_tasks
BEGIN
  UPDATE summary_tasks SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Trigger: Update prompt_directories timestamp
CREATE TRIGGER IF NOT EXISTS update_prompt_dirs_timestamp 
AFTER UPDATE ON prompt_directories
BEGIN
  UPDATE prompt_directories SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Trigger: Update prompts timestamp
CREATE TRIGGER IF NOT EXISTS update_prompts_timestamp 
AFTER UPDATE ON prompts
BEGIN
  UPDATE prompts SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================================================
-- End of Schema
-- ============================================================================
