-- Добавляем флаг для управления автогенерацией задач
ALTER TABLE goals 
ADD COLUMN IF NOT EXISTS auto_generate_tasks BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN goals.auto_generate_tasks IS 'Автоматически генерировать задачи для этой цели (TRUE/FALSE)';

