import { useState, useEffect } from 'react';
import { GameStats, tasksApi, gamificationApi, Task } from '../api';
import TaskFeedback from './TaskFeedback';
import UnifiedChat from './UnifiedChat';

interface TodayProps {
  user: GameStats;
  onRefresh: () => void;
  onNavigate: (page: string) => void;
}

interface FeedbackData {
  taskId: number;
  taskTitle: string;
  xpGained: number;
}

function Today({ user, onRefresh, onNavigate }: TodayProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingTask, setCompletingTask] = useState<number | null>(null);
  const [bonusAvailable, setBonusAvailable] = useState(false);
  const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(null);
  const [showChat, setShowChat] = useState(false);

  const { user: userData } = user;
  const DAILY_GOAL = 3;
  
  // Подсчёт выполненных задач сегодня
  const todayCompleted = tasks.filter(t => {
    if (t.status !== 'completed' || !t.completed_at) return false;
    const completedDate = new Date(t.completed_at).toDateString();
    const today = new Date().toDateString();
    return completedDate === today;
  }).length;

  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
  const streakSafe = todayCompleted >= 1; // Хотя бы 1 задача = streak сохранён

  useEffect(() => {
    loadTasks();
    checkBonusAvailability();
  }, [userData.id]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const response = await tasksApi.getTasks(userData.id, 'pending');
      setTasks(response.data);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkBonusAvailability = async () => {
    try {
      const response = await gamificationApi.getDailyBonus(userData.id);
      // Если success = false и нет secondsUntilNext, значит бонус доступен
      setBonusAvailable(!response.data.success && !response.data.secondsUntilNext);
    } catch {
      setBonusAvailable(false);
    }
  };

  const handleCompleteTask = async (taskId: number) => {
    const task = tasks.find(t => t.id === taskId);
    
    try {
      setCompletingTask(taskId);
      const response = await tasksApi.completeTask(taskId, userData.id);
      
      if (response.data.success) {
        // Показываем feedback popup
        setFeedbackData({
          taskId,
          taskTitle: task?.title || 'Задача',
          xpGained: response.data.xpGained || 0
        });
        
        // Обновляем данные
        await loadTasks();
        onRefresh();
      }
    } catch (error) {
      console.error('Error completing task:', error);
      alert('Ошибка выполнения задачи');
    } finally {
      setCompletingTask(null);
    }
  };

  const handleFeedbackSubmit = async (feedback: { difficulty: string; notes: string }) => {
    if (!feedbackData) return;
    
    try {
      await fetch('/xpgame/api/unified-chat/task-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userData.id,
          taskId: feedbackData.taskId,
          difficulty: feedback.difficulty,
          notes: feedback.notes
        })
      });
    } catch (error) {
      console.error('Error saving feedback:', error);
    }
  };

  const handleDailyBonus = async () => {
    try {
      const response = await gamificationApi.getDailyBonus(userData.id);
      if (response.data.success) {
        alert(`🎁 +${response.data.xpGained} XP\nБонус за серию: +${response.data.streakBonus}`);
        setBonusAvailable(false);
        onRefresh();
      }
    } catch (error) {
      console.error('Error getting bonus:', error);
    }
  };

  // Мотивационные сообщения
  const getMotivationMessage = () => {
    const hour = new Date().getHours();
    
    if (!streakSafe && hour >= 18) {
      return { text: '⚠️ Сделай хотя бы 1 задачу чтобы сохранить серию!', urgent: true };
    }
    if (!streakSafe && hour >= 12) {
      return { text: '👋 Сделай задачу и продолжи серию!', urgent: false };
    }
    if (todayCompleted >= DAILY_GOAL) {
      return { text: '🔥 Отлично! Цель на сегодня выполнена!', urgent: false };
    }
    if (todayCompleted > 0) {
      return { text: `💪 Осталось ${DAILY_GOAL - todayCompleted} задач до цели!`, urgent: false };
    }
    if (hour < 12) {
      return { text: '☀️ Доброе утро! Начни день с задачи!', urgent: false };
    }
    return { text: '🎯 Выполни задачу и получи XP!', urgent: false };
  };

  const motivation = getMotivationMessage();

  if (loading) {
    return (
      <div className="today-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="today-screen">
      {/* Task Feedback Modal */}
      {feedbackData && (
        <TaskFeedback
          taskId={feedbackData.taskId}
          taskTitle={feedbackData.taskTitle}
          xpGained={feedbackData.xpGained}
          onClose={() => setFeedbackData(null)}
          onSubmit={handleFeedbackSubmit}
        />
      )}

      {/* Unified Chat */}
      {showChat && (
        <UnifiedChat
          user={user}
          onClose={() => setShowChat(false)}
          onRefresh={onRefresh}
        />
      )}

      {/* Header с Streak и XP */}
      <div className="today-header">
        <div className="streak-display">
          <span className="streak-fire">🔥</span>
          <span className="streak-number">{userData.current_streak}</span>
          <span className="streak-label">дней</span>
        </div>
        <div className="xp-display">
          <span className="xp-amount">💎 {userData.total_xp}</span>
          {bonusAvailable && (
            <button className="bonus-btn" onClick={handleDailyBonus}>
              🎁
            </button>
          )}
        </div>
      </div>

      {/* Мотивационное сообщение */}
      <div className={`motivation-banner ${motivation.urgent ? 'urgent' : ''}`}>
        {motivation.text}
      </div>

      {/* Список задач */}
      <div className="tasks-section">
        <h2 className="tasks-title">
          Задачи на сегодня
          <span className="tasks-count">{pendingTasks.length}</span>
        </h2>

        {pendingTasks.length === 0 ? (
          <div className="empty-tasks">
            <div className="empty-icon">🎉</div>
            <p>Все задачи выполнены!</p>
            <button 
              className="add-goals-btn"
              onClick={() => onNavigate('me')}
            >
              Добавить цели →
            </button>
          </div>
        ) : (
          <div className="tasks-list">
            {pendingTasks.slice(0, 10).map((task) => (
              <div key={task.id} className="task-card">
                <div className="task-content">
                  <div className="task-title">{task.title}</div>
                  {task.goal_title && (
                    <div className="task-goal">🎯 {task.goal_title}</div>
                  )}
                </div>
                <div className="task-actions">
                  <span className="task-xp">+{task.xp_reward}</span>
                  <button
                    className="complete-btn"
                    onClick={() => handleCompleteTask(task.id)}
                    disabled={completingTask === task.id}
                  >
                    {completingTask === task.id ? '...' : '✓'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Chat Button */}
      <button 
        className="chat-fab"
        onClick={() => setShowChat(true)}
        style={{
          position: 'fixed',
          bottom: '90px',
          right: '16px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          border: 'none',
          background: 'linear-gradient(135deg, var(--primary-color), #8b5cf6)',
          color: 'white',
          fontSize: '1.5rem',
          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
          cursor: 'pointer',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        💬
      </button>
    </div>
  );
}

export default Today;

