import { useState, useEffect } from 'react';
import { tasksApi, Task } from '../api';
import CountdownTimer from './CountdownTimer';

interface TasksProps {
  userId: number;
  onRefresh: () => void;
}

function Tasks({ userId, onRefresh }: TasksProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [loading, setLoading] = useState(true);
  const [completingTask, setCompletingTask] = useState<number | null>(null);
  const [updatingPlan, setUpdatingPlan] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<{
    canRefresh: boolean;
    secondsUntilNext: number;
  } | null>(null);

  useEffect(() => {
    loadTasks();
    loadRefreshStatus();
  }, [userId, filter]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const status = filter === 'all' ? undefined : filter;
      const response = await tasksApi.getTasks(userId, status);
      setTasks(response.data);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRefreshStatus = async () => {
    try {
      const response = await tasksApi.getRefreshStatus(userId);
      setRefreshStatus({
        canRefresh: response.data.canRefresh,
        secondsUntilNext: response.data.secondsUntilNext
      });
    } catch (error) {
      console.error('Error loading refresh status:', error);
    }
  };

  const handleCompleteTask = async (taskId: number) => {
    try {
      setCompletingTask(taskId);
      
      // Находим задачу, чтобы проверить, из чата ли она
      const task = tasks.find(t => t.id === taskId);
      
      const response = await tasksApi.completeTask(taskId, userId);
      
      if (response.data.success) {
        // Show success animation
        const message = [
          `✅ Задача выполнена!`,
          `+${response.data.xpGained} XP`,
          response.data.leveledUp ? `🎉 Новый уровень ${response.data.newLevel}!` : '',
          response.data.newStreak > 1 ? `🔥 Серия: ${response.data.newStreak} дней` : '',
          response.data.unlockedAchievements.length > 0 
            ? `🏆 Достижение: ${response.data.unlockedAchievements[0].name}` 
            : ''
        ].filter(Boolean).join('\n');

        alert(message);
        
        // Если задача из чата, предлагаем оставить feedback (опционально)
        if (task && task.from_chat) {
          const wantsFeedback = confirm('💬 Хотите оставить отзыв о выполнении задачи? (опционально)\n\nЭто поможет AI лучше понять ваш прогресс.');
          
          if (wantsFeedback) {
            const feedback = prompt('Расскажите, как прошло выполнение задачи:\n\n• Что сделали?\n• Какие сложности возникли?\n• Что узнали нового?');
            
            if (feedback && feedback.trim()) {
              try {
                // Сохраняем feedback (API endpoint будет создан далее)
                await tasksApi.submitFeedback(taskId, feedback.trim());
                alert('✅ Спасибо за отзыв!');
              } catch (error) {
                console.error('Error submitting feedback:', error);
              }
            }
          }
        }
        
        // Refresh tasks and user data
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

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Удалить эту задачу?')) return;

    try {
      await tasksApi.deleteTask(taskId);
      setTasks(tasks.filter(t => t.id !== taskId));
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const handleRefreshTasks = async () => {
    if (!refreshStatus?.canRefresh && !confirm('Обновление задач доступно раз в 24 часа. Хочешь обновить принудительно?')) {
      return;
    }

    try {
      setUpdatingPlan(true);
      const response = await tasksApi.autoRefresh(userId, !refreshStatus?.canRefresh);
      
      if (response.data.success) {
        const message = [
          '🎯 План обновлен!',
          `Создано задач: ${response.data.tasks.length}`,
          '',
          response.data.motivation_message
        ].join('\n');

        alert(message);
        await loadTasks();
        await loadRefreshStatus();
        onRefresh();
      }
    } catch (error: any) {
      console.error('Error refreshing tasks:', error);
      alert(error.response?.data?.error || 'Ошибка обновления задач. Попробуй позже.');
    } finally {
      setUpdatingPlan(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'var(--success-color)';
      case 'medium': return 'var(--warning-color)';
      case 'hard': return 'var(--danger-color)';
      default: return 'var(--text-secondary)';
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return '🟢 Легко';
      case 'medium': return '🟡 Средне';
      case 'hard': return '🔴 Сложно';
      default: return difficulty;
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">✅ Мои задачи</h1>
        <p className="page-subtitle">Выполняй задачи и получай XP</p>
      </div>

      {/* Auto-refresh info */}
      {refreshStatus && (
        <div className="card" style={{ 
          marginBottom: '1rem', 
          padding: '1rem',
          background: refreshStatus.canRefresh 
            ? 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.05) 100%)'
            : 'var(--secondary-bg-color)',
          border: refreshStatus.canRefresh 
            ? '2px solid var(--success-color)'
            : '2px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ 
                fontSize: '0.875rem', 
                color: refreshStatus.canRefresh ? 'var(--success-color)' : 'var(--text-secondary)',
                marginBottom: '0.25rem',
                fontWeight: 600
              }}>
                {refreshStatus.canRefresh ? '✨ Обновление доступно!' : '⏳ Следующее обновление'}
              </div>
              {!refreshStatus.canRefresh && refreshStatus.secondsUntilNext > 0 && (
                <div style={{ 
                  fontSize: '1.125rem', 
                  color: 'var(--text-primary)',
                  fontWeight: 700
                }}>
                  <CountdownTimer 
                    seconds={refreshStatus.secondsUntilNext}
                    onExpire={() => loadRefreshStatus()}
                  />
                </div>
              )}
              <div style={{ 
                fontSize: '0.75rem', 
                color: 'var(--text-secondary)',
                marginTop: '0.25rem'
              }}>
                {refreshStatus.canRefresh 
                  ? 'Нажми кнопку для обновления задач на основе твоего прогресса'
                  : 'Задачи обновляются автоматически раз в 24 часа с учётом выполненных'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refresh Tasks Button */}
      <button
        className="btn btn-primary"
        style={{ 
          width: '100%', 
          marginBottom: '1rem',
          opacity: refreshStatus?.canRefresh ? 1 : 0.7
        }}
        onClick={handleRefreshTasks}
        disabled={updatingPlan}
      >
        {updatingPlan ? '🔄 Генерируем...' : '🔄 Обновить задачи с AI'}
      </button>

      {/* Filter Tabs */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-outline'}`}
            style={{ flex: 1 }}
            onClick={() => setFilter('all')}
          >
            Все ({tasks.length})
          </button>
          <button
            className={`btn ${filter === 'pending' ? 'btn-primary' : 'btn-outline'}`}
            style={{ flex: 1 }}
            onClick={() => setFilter('pending')}
          >
            Активные ({pendingTasks.length})
          </button>
          <button
            className={`btn ${filter === 'completed' ? 'btn-primary' : 'btn-outline'}`}
            style={{ flex: 1 }}
            onClick={() => setFilter('completed')}
          >
            Выполнено ({completedTasks.length})
          </button>
        </div>
      </div>

      {/* Tasks List */}
      {tasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <h3>Пока нет задач</h3>
          <p>Добавь цели и сгенерируй план развития с помощью AI</p>
        </div>
      ) : (
        <div>
          {tasks.map((task, index) => (
            <div key={task.id} className="task-item slide-up" style={{ animationDelay: `${index * 0.05}s` }}>
              <div className="task-header">
                <div style={{ flex: 1 }}>
                  <h4 className="task-title">{task.title}</h4>
                  {task.goal_title && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      🎯 {task.goal_title}
                    </div>
                  )}
                </div>
                <span 
                  className="badge"
                  style={{ 
                    background: getDifficultyColor(task.difficulty) + '20',
                    color: getDifficultyColor(task.difficulty)
                  }}
                >
                  {getDifficultyLabel(task.difficulty)}
                </span>
              </div>

              {task.description && (
                <p className="task-description">{task.description}</p>
              )}

              <div className="task-footer">
                <div className="task-meta">
                  <span className="badge badge-primary">
                    ⭐ {task.xp_reward} XP
                  </span>
                  {task.status === 'completed' && (
                    <span className="badge badge-success">
                      ✅ Выполнено
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {task.status !== 'completed' && (
                    <button
                      className="btn btn-success btn-small"
                      onClick={() => handleCompleteTask(task.id)}
                      disabled={completingTask === task.id}
                    >
                      {completingTask === task.id ? '⏳' : '✓'}
                    </button>
                  )}
                  <button
                    className="btn btn-small btn-outline"
                    onClick={() => handleDeleteTask(task.id)}
                    style={{ color: 'var(--danger-color)' }}
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {task.due_date && (
                <div style={{ 
                  marginTop: '0.75rem', 
                  fontSize: '0.75rem', 
                  color: 'var(--text-secondary)' 
                }}>
                  📅 Срок: {new Date(task.due_date).toLocaleDateString('ru-RU')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stats Summary */}
      {tasks.length > 0 && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h4 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>📊 Статистика задач</h4>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {pendingTasks.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Активных</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {completedTasks.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Выполнено</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {tasks.reduce((sum, t) => sum + (t.status === 'completed' ? t.xp_reward : 0), 0)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Получено XP</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Tasks;

