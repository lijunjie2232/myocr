-- CreateTable
CREATE TABLE "llm_server_apis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "base_url" TEXT,
    "api_key" TEXT NOT NULL,
    "models" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ocr_directories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ocr_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "directory_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "image_blob" BLOB NOT NULL,
    "image_mime_type" TEXT NOT NULL DEFAULT 'image/png',
    "image_filename" TEXT,
    "result" TEXT,
    "error_message" TEXT,
    "api_config_id" TEXT,
    "selected_model" TEXT,
    "temperature" REAL DEFAULT 0.6,
    "max_tokens" INTEGER DEFAULT 2000,
    "custom_prompt" TEXT,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ocr_tasks_directory_id_fkey" FOREIGN KEY ("directory_id") REFERENCES "ocr_directories" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ocr_tasks_api_config_id_fkey" FOREIGN KEY ("api_config_id") REFERENCES "llm_server_apis" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "summary_directories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "summary_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "directory_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "input_text" TEXT NOT NULL,
    "result" TEXT,
    "error_message" TEXT,
    "api_config_id" TEXT,
    "selected_model" TEXT,
    "temperature" REAL DEFAULT 0.6,
    "max_tokens" INTEGER DEFAULT 2000,
    "custom_prompt" TEXT,
    "result_format" TEXT DEFAULT 'plaintext',
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "summary_tasks_directory_id_fkey" FOREIGN KEY ("directory_id") REFERENCES "summary_directories" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "summary_tasks_api_config_id_fkey" FOREIGN KEY ("api_config_id") REFERENCES "llm_server_apis" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "prompt_directories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "prompts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "directory_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT DEFAULT 'custom',
    "category" TEXT,
    "variables" TEXT NOT NULL DEFAULT '[]',
    "description" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parent_id" TEXT,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "prompts_directory_id_fkey" FOREIGN KEY ("directory_id") REFERENCES "prompt_directories" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "prompts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "prompts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "task_execution_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "task_id" TEXT NOT NULL,
    "task_type" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "message" TEXT,
    "details" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_execution_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "ocr_tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "task_execution_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "summary_tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "task_execution_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "prompts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "file_attachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "task_id" TEXT NOT NULL,
    "task_type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_hash" TEXT,
    "file_blob" BLOB NOT NULL,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "file_attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "ocr_tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "file_attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "summary_tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "file_attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "prompts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "llm_server_apis_is_enabled_idx" ON "llm_server_apis"("is_enabled");

-- CreateIndex
CREATE INDEX "llm_server_apis_provider_idx" ON "llm_server_apis"("provider");

-- CreateIndex
CREATE INDEX "llm_server_apis_sort_order_idx" ON "llm_server_apis"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "ocr_directories_name_key" ON "ocr_directories"("name");

-- CreateIndex
CREATE INDEX "ocr_tasks_directory_id_idx" ON "ocr_tasks"("directory_id");

-- CreateIndex
CREATE INDEX "ocr_tasks_status_idx" ON "ocr_tasks"("status");

-- CreateIndex
CREATE INDEX "ocr_tasks_api_config_id_idx" ON "ocr_tasks"("api_config_id");

-- CreateIndex
CREATE INDEX "ocr_tasks_created_at_idx" ON "ocr_tasks"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "summary_directories_name_key" ON "summary_directories"("name");

-- CreateIndex
CREATE INDEX "summary_tasks_directory_id_idx" ON "summary_tasks"("directory_id");

-- CreateIndex
CREATE INDEX "summary_tasks_status_idx" ON "summary_tasks"("status");

-- CreateIndex
CREATE INDEX "summary_tasks_api_config_id_idx" ON "summary_tasks"("api_config_id");

-- CreateIndex
CREATE INDEX "summary_tasks_created_at_idx" ON "summary_tasks"("created_at");

-- CreateIndex
CREATE INDEX "summary_tasks_result_format_idx" ON "summary_tasks"("result_format");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_directories_name_key" ON "prompt_directories"("name");

-- CreateIndex
CREATE INDEX "prompts_directory_id_idx" ON "prompts"("directory_id");

-- CreateIndex
CREATE INDEX "prompts_type_idx" ON "prompts"("type");

-- CreateIndex
CREATE INDEX "prompts_category_idx" ON "prompts"("category");

-- CreateIndex
CREATE INDEX "prompts_is_public_idx" ON "prompts"("is_public");

-- CreateIndex
CREATE INDEX "prompts_is_favorite_idx" ON "prompts"("is_favorite");

-- CreateIndex
CREATE INDEX "prompts_parent_id_idx" ON "prompts"("parent_id");

-- CreateIndex
CREATE INDEX "task_execution_logs_task_id_idx" ON "task_execution_logs"("task_id");

-- CreateIndex
CREATE INDEX "task_execution_logs_task_type_idx" ON "task_execution_logs"("task_type");

-- CreateIndex
CREATE INDEX "task_execution_logs_action_idx" ON "task_execution_logs"("action");

-- CreateIndex
CREATE INDEX "task_execution_logs_created_at_idx" ON "task_execution_logs"("created_at");

-- CreateIndex
CREATE INDEX "file_attachments_task_id_idx" ON "file_attachments"("task_id");

-- CreateIndex
CREATE INDEX "file_attachments_task_type_idx" ON "file_attachments"("task_type");

-- CreateIndex
CREATE INDEX "file_attachments_file_hash_idx" ON "file_attachments"("file_hash");
