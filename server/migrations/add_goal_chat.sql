-- Таблица для хранения контекста и плана для каждой цели
CREATE TABLE IF NOT EXISTS goal_context (
    id SERIAL PRIMARY KEY,
    goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- План развития (roadmap)
    roadmap JSONB DEFAULT '[]'::jsonb,
    -- Формат: [{"stage": "Этап 1", "title": "Подготовка", "tasks": ["task1", "task2"], "completed": false}]
    
    -- Текущий этап
    current_stage INTEGER DEFAULT 0,
    
    -- Предпочтения пользователя
    preferences JSONB DEFAULT '{}'::jsonb,
    -- Формат: {"pace": "medium", "style": "structured", "focus_areas": []}
    
    -- Дополнительные заметки от AI
    ai_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(goal_id, user_id)
);

-- Таблица для истории чата
CREATE TABLE IF NOT EXISTS goal_chat_messages (
    id SERIAL PRIMARY KEY,
    goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Роль отправителя
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    
    -- Содержимое сообщения
    content TEXT NOT NULL,
    
    -- Метаданные (например, какие действия выполнил AI)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_goal_context_goal_id ON goal_context(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_context_user_id ON goal_context(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_chat_messages_goal_id ON goal_chat_messages(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_chat_messages_user_id ON goal_chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_chat_messages_created_at ON goal_chat_messages(created_at);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_goal_context_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_goal_context_updated_at
    BEFORE UPDATE ON goal_context
    FOR EACH ROW
    EXECUTE FUNCTION update_goal_context_updated_at();

