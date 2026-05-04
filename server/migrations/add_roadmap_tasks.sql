-- Добавляем поля для roadmap в goal_context
ALTER TABLE goal_context ADD COLUMN IF NOT EXISTS roadmap_generated BOOLEAN DEFAULT FALSE;
ALTER TABLE goal_context ADD COLUMN IF NOT EXISTS tasks_generated BOOLEAN DEFAULT FALSE;

-- Добавляем связь задач с roadmap этапами
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS roadmap_stage INTEGER;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS from_chat BOOLEAN DEFAULT FALSE;

-- Добавляем таблицу для feedback по задачам
CREATE TABLE IF NOT EXISTS task_feedback (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  feedback_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_feedback_task ON task_feedback(task_id);
CREATE INDEX IF NOT EXISTS idx_task_feedback_user_goal ON task_feedback(user_id, goal_id);

-- Добавляем поле для отслеживания прогресса по этапам roadmap
ALTER TABLE goal_context ADD COLUMN IF NOT EXISTS completed_stages INTEGER[] DEFAULT '{}';

COMMENT ON COLUMN tasks.roadmap_stage IS 'Номер этапа roadmap, к которому относится задача';
COMMENT ON COLUMN tasks.from_chat IS 'Задача создана из чата с AI';
COMMENT ON COLUMN goal_context.roadmap_generated IS 'Roadmap был создан AI';
COMMENT ON COLUMN goal_context.tasks_generated IS 'Задачи были сгенерированы из roadmap';
COMMENT ON COLUMN goal_context.completed_stages IS 'Массив номеров завершенных этапов';

