import { useState } from 'react';

interface TaskFeedbackProps {
  taskId: number;
  taskTitle: string;
  xpGained: number;
  onClose: () => void;
  onSubmit: (feedback: { difficulty: string; notes: string }) => void;
}

function TaskFeedback({ taskTitle, xpGained, onClose, onSubmit }: TaskFeedbackProps) {
  const [difficulty, setDifficulty] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const difficulties = [
    { value: 'easy', label: 'Легко 😊', color: '#22c55e' },
    { value: 'medium', label: 'Нормально 👍', color: '#f59e0b' },
    { value: 'hard', label: 'Сложно 💪', color: '#ef4444' },
  ];

  const handleSubmit = () => {
    if (!difficulty) return;
    setSubmitted(true);
    onSubmit({ difficulty, notes });
    setTimeout(onClose, 1500);
  };

  const handleSkip = () => {
    onClose();
  };

  if (submitted) {
    return (
      <div className="feedback-overlay">
        <div className="feedback-modal success">
          <div className="success-emoji">✨</div>
          <div className="success-text">Спасибо за feedback!</div>
          <div className="success-subtext">AI учтёт это</div>
        </div>
        <style>{feedbackStyles}</style>
      </div>
    );
  }

  return (
    <div className="feedback-overlay">
      <div className="feedback-modal">
        <div className="feedback-header">
          <div className="feedback-xp">+{xpGained} XP</div>
          <div className="feedback-title">🎉 Задача выполнена!</div>
          <div className="feedback-task">{taskTitle}</div>
        </div>

        <div className="feedback-question">
          Как тебе было?
        </div>

        <div className="difficulty-options">
          {difficulties.map(d => (
            <button
              key={d.value}
              className={`difficulty-btn ${difficulty === d.value ? 'selected' : ''}`}
              style={{ 
                borderColor: difficulty === d.value ? d.color : undefined,
                background: difficulty === d.value ? `${d.color}22` : undefined
              }}
              onClick={() => setDifficulty(d.value)}
            >
              {d.label}
            </button>
          ))}
        </div>

        <textarea
          className="feedback-notes"
          placeholder="Заметки (необязательно)..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />

        <div className="feedback-actions">
          <button className="skip-btn" onClick={handleSkip}>
            Пропустить
          </button>
          <button 
            className="submit-btn" 
            onClick={handleSubmit}
            disabled={!difficulty}
          >
            Готово
          </button>
        </div>
      </div>
      <style>{feedbackStyles}</style>
    </div>
  );
}

const feedbackStyles = `
  .feedback-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
    animation: fadeIn 0.2s ease;
  }

  .feedback-modal {
    background: var(--tg-theme-bg-color, #1a1a2e);
    border-radius: 16px;
    padding: 1.5rem;
    width: 100%;
    max-width: 340px;
    animation: slideUp 0.3s ease;
  }

  .feedback-modal.success {
    text-align: center;
    padding: 2rem;
  }

  .success-emoji {
    font-size: 3rem;
    margin-bottom: 0.5rem;
  }

  .success-text {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--tg-theme-text-color, #fff);
  }

  .success-subtext {
    font-size: 0.875rem;
    color: var(--tg-theme-hint-color, #888);
    margin-top: 0.25rem;
  }

  .feedback-header {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .feedback-xp {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: white;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  .feedback-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--tg-theme-text-color, #fff);
  }

  .feedback-task {
    font-size: 0.875rem;
    color: var(--tg-theme-hint-color, #888);
    margin-top: 0.25rem;
  }

  .feedback-question {
    font-size: 1rem;
    font-weight: 600;
    color: var(--tg-theme-text-color, #fff);
    margin-bottom: 0.75rem;
    text-align: center;
  }

  .difficulty-options {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .difficulty-btn {
    flex: 1;
    padding: 0.75rem 0.5rem;
    border: 2px solid var(--tg-theme-hint-color, #444)44;
    border-radius: 10px;
    background: var(--tg-theme-secondary-bg-color, #16213e);
    color: var(--tg-theme-text-color, #fff);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .difficulty-btn.selected {
    transform: scale(1.02);
  }

  .feedback-notes {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--tg-theme-hint-color, #444)44;
    border-radius: 10px;
    background: var(--tg-theme-secondary-bg-color, #16213e);
    color: var(--tg-theme-text-color, #fff);
    font-size: 0.9rem;
    font-family: inherit;
    resize: none;
    margin-bottom: 1rem;
  }

  .feedback-notes::placeholder {
    color: var(--tg-theme-hint-color, #666);
  }

  .feedback-actions {
    display: flex;
    gap: 0.75rem;
  }

  .skip-btn {
    flex: 1;
    padding: 0.875rem;
    border: 1px solid var(--tg-theme-hint-color, #444)44;
    border-radius: 10px;
    background: transparent;
    color: var(--tg-theme-hint-color, #888);
    font-size: 0.9rem;
    cursor: pointer;
  }

  .submit-btn {
    flex: 1;
    padding: 0.875rem;
    border: none;
    border-radius: 10px;
    background: var(--tg-theme-button-color, #3390ec);
    color: var(--tg-theme-button-text-color, #fff);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;

export default TaskFeedback;


