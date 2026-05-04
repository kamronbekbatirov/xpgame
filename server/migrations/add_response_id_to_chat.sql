-- Добавляем поле response_id для передачи chain of thought между турами
ALTER TABLE goal_chat_messages ADD COLUMN IF NOT EXISTS response_id VARCHAR(255);

-- Индекс для быстрого поиска последнего response_id
CREATE INDEX IF NOT EXISTS idx_goal_chat_messages_response_id ON goal_chat_messages(goal_id, user_id, created_at DESC) WHERE response_id IS NOT NULL;

COMMENT ON COLUMN goal_chat_messages.response_id IS 'OpenAI Response ID для передачи CoT между турами (только для assistant сообщений)';




