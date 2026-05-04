import { useState, useEffect } from 'react';
import { goalsApi, weaknessesApi, aiApi, Goal, Weakness } from '../api';
import GoalChat from './GoalChat';

interface GoalsProps {
  userId: number;
  onRefresh: () => void;
}

function Goals({ userId, onRefresh }: GoalsProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [weaknesses, setWeaknesses] = useState<Weakness[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showAddWeakness, setShowAddWeakness] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editingWeakness, setEditingWeakness] = useState<Weakness | null>(null);
  const [chatGoal, setChatGoal] = useState<Goal | null>(null);

  const categoryLabels: Record<string, string> = {
    'personal': '🎯 Личное',
    'health': '💪 Здоровье',
    'education': '📚 Образование',
    'career': '💼 Карьера',
    'finance': '💰 Финансы',
    'hobby': '🎨 Хобби'
  };

  const priorityLabels: Record<number, string> = {
    1: '🔴 Критичная',
    2: '🟠 Высокая',
    3: '🟡 Средняя',
    4: '🟢 Низкая',
    5: '⚪ Очень низкая'
  };

  const severityLabels: Record<number, string> = {
    1: '🟢 Лёгкая',
    2: '🟡 Средняя',
    3: '🟠 Серьёзная',
    4: '🔴 Критичная',
    5: '💀 Очень критичная'
  };

  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    category: '',
    priority: 3,
    auto_generate_tasks: true
  });

  const [newWeakness, setNewWeakness] = useState({
    title: '',
    description: '',
    severity: 3
  });

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [goalsRes, weaknessesRes] = await Promise.all([
        goalsApi.getGoals(userId),
        weaknessesApi.getWeaknesses(userId)
      ]);
      setGoals(goalsRes.data);
      setWeaknesses(weaknessesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddGoal = async () => {
    if (!newGoal.title.trim()) return;

    try {
      const response = await goalsApi.createGoal({
        user_id: userId,
        ...newGoal
      });
      
      setGoals([response.data.goal, ...goals]);
      setNewGoal({ title: '', description: '', category: '', priority: 3, auto_generate_tasks: true });
      setShowAddGoal(false);

      if (response.data.unlockedAchievements.length > 0) {
        alert(`🏆 Новое достижение: ${response.data.unlockedAchievements[0].name}!`);
        onRefresh();
      }
    } catch (error) {
      console.error('Error adding goal:', error);
      alert('Ошибка добавления цели');
    }
  };

  const handleAddWeakness = async () => {
    if (!newWeakness.title.trim()) return;

    try {
      const response = await weaknessesApi.createWeakness({
        user_id: userId,
        ...newWeakness
      });
      
      setWeaknesses([response.data, ...weaknesses]);
      setNewWeakness({ title: '', description: '', severity: 3 });
      setShowAddWeakness(false);
    } catch (error) {
      console.error('Error adding weakness:', error);
      alert('Ошибка добавления слабости');
    }
  };

  const handleGeneratePlan = async () => {
    if (goals.length === 0 && weaknesses.length === 0) {
      alert('Добавьте хотя бы одну цель или слабость');
      return;
    }

    try {
      setGeneratingPlan(true);
      const response = await aiApi.generatePlan(userId);
      
      // Show success message
      alert(`✅ План создан! Добавлено ${response.data.tasks.length} задач`);
      onRefresh();
    } catch (error: any) {
      console.error('Error generating plan:', error);
      alert('Ошибка генерации плана: ' + (error.response?.data?.error || error.message));
    } finally {
      setGeneratingPlan(false);
    }
  };

  const handleDeleteGoal = async (goalId: number) => {
    if (!confirm('Удалить эту цель?')) return;

    try {
      await goalsApi.deleteGoal(goalId);
      setGoals(goals.filter(g => g.id !== goalId));
    } catch (error) {
      console.error('Error deleting goal:', error);
    }
  };

  const handleDeleteWeakness = async (weaknessId: number) => {
    if (!confirm('Удалить эту слабость?')) return;

    try {
      await weaknessesApi.deleteWeakness(weaknessId);
      setWeaknesses(weaknesses.filter(w => w.id !== weaknessId));
    } catch (error) {
      console.error('Error deleting weakness:', error);
    }
  };

  const handleUpdateGoal = async () => {
    if (!editingGoal || !editingGoal.title.trim()) return;

    try {
      const response = await goalsApi.updateGoal(editingGoal.id, {
        title: editingGoal.title,
        description: editingGoal.description,
        category: editingGoal.category,
        priority: editingGoal.priority
      });
      
      setGoals(goals.map(g => g.id === editingGoal.id ? response.data : g));
      setEditingGoal(null);
    } catch (error) {
      console.error('Error updating goal:', error);
      alert('Ошибка обновления цели');
    }
  };

  const handleUpdateWeakness = async () => {
    if (!editingWeakness || !editingWeakness.title.trim()) return;

    try {
      const response = await weaknessesApi.updateWeakness(editingWeakness.id, {
        title: editingWeakness.title,
        description: editingWeakness.description,
        severity: editingWeakness.severity
      });
      
      setWeaknesses(weaknesses.map(w => w.id === editingWeakness.id ? response.data : w));
      setEditingWeakness(null);
    } catch (error) {
      console.error('Error updating weakness:', error);
      alert('Ошибка обновления слабости');
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">🎯 Мои цели</h1>
        <p className="page-subtitle">Определи свой путь к успеху</p>
      </div>

      {/* Generate Plan Button */}
      {(goals.length > 0 || weaknesses.length > 0) && (
        <button
          className="btn btn-success mb-2"
          style={{ width: '100%' }}
          onClick={handleGeneratePlan}
          disabled={generatingPlan}
        >
          {generatingPlan ? '🤖 Генерация плана...' : '🤖 Создать план развития с AI'}
        </button>
      )}

      {/* Goals Section */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ color: 'var(--text-primary)' }}>Мои цели ({goals.length})</h3>
          <button className="btn btn-primary btn-small" onClick={() => setShowAddGoal(true)}>
            + Добавить
          </button>
        </div>

        {goals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🎯</div>
            <p>Пока нет целей</p>
            <button className="btn btn-primary mt-2" onClick={() => setShowAddGoal(true)}>
              Добавить первую цель
            </button>
          </div>
        ) : (
          goals.map(goal => (
            <div key={goal.id} className="goal-item">
              <div className="goal-header">
                <div>
                  <h4 className="goal-title">{goal.title}</h4>
                  {goal.category && (
                    <span className="goal-category">
                      {categoryLabels[goal.category] || goal.category}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-small"
                    onClick={() => setChatGoal(goal)}
                    style={{ 
                      background: 'var(--primary-color)',
                      color: 'white',
                      border: 'none'
                    }}
                    title="Обсудить с AI"
                  >
                    💬
                  </button>
                  <button
                    className="btn btn-small btn-outline"
                    onClick={() => setEditingGoal(goal)}
                    style={{ color: 'var(--primary-color)' }}
                    title="Редактировать"
                  >
                    ✏️
                  </button>
                <button
                  className="btn btn-small btn-outline"
                  onClick={() => handleDeleteGoal(goal.id)}
                  style={{ color: 'var(--danger-color)' }}
                    title="Удалить"
                >
                  🗑️
                </button>
                </div>
              </div>
              {goal.description && (
                <p className="goal-description">{goal.description}</p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div className="flex justify-between items-center">
                <span className="badge badge-primary">
                    {priorityLabels[goal.priority] || `Приоритет: ${goal.priority}`}
                </span>
                {goal.task_count !== undefined && (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    Задач: {goal.task_count}
                  </span>
                )}
                </div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  padding: '0.5rem',
                  background: 'var(--secondary-bg-color)',
                  borderRadius: '6px',
                  fontSize: '0.875rem'
                }}>
                  <input
                    type="checkbox"
                    id={`auto-gen-${goal.id}`}
                    checked={goal.auto_generate_tasks !== false}
                    onChange={async (e) => {
                      try {
                        await goalsApi.updateGoal(goal.id, {
                          auto_generate_tasks: e.target.checked
                        });
                        loadData();
                      } catch (error) {
                        console.error('Error updating goal:', error);
                        alert('Ошибка обновления цели');
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                  <label 
                    htmlFor={`auto-gen-${goal.id}`}
                    style={{ 
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      userSelect: 'none'
                    }}
                  >
                    🤖 Генерировать задачи AI для этой цели
                  </label>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Weaknesses Section */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ color: 'var(--text-primary)' }}>Слабые стороны ({weaknesses.length})</h3>
          <button className="btn btn-primary btn-small" onClick={() => setShowAddWeakness(true)}>
            + Добавить
          </button>
        </div>

        {weaknesses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💪</div>
            <p>Определи свои слабые стороны для роста</p>
            <button className="btn btn-primary mt-2" onClick={() => setShowAddWeakness(true)}>
              Добавить
            </button>
          </div>
        ) : (
          weaknesses.map(weakness => (
            <div key={weakness.id} className="goal-item">
              <div className="goal-header">
                <div>
                  <h4 className="goal-title">{weakness.title}</h4>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-small btn-outline"
                    onClick={() => setEditingWeakness(weakness)}
                    style={{ color: 'var(--primary-color)' }}
                    title="Редактировать"
                  >
                    ✏️
                  </button>
                <button
                  className="btn btn-small btn-outline"
                  onClick={() => handleDeleteWeakness(weakness.id)}
                  style={{ color: 'var(--danger-color)' }}
                    title="Удалить"
                >
                  🗑️
                </button>
                </div>
              </div>
              {weakness.description && (
                <p className="goal-description">{weakness.description}</p>
              )}
              <span className="badge badge-warning">
                {severityLabels[weakness.severity] || `Важность: ${weakness.severity}`}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Add Goal Modal */}
      {showAddGoal && (
        <div className="modal-overlay" onClick={() => setShowAddGoal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Новая цель</h3>
            </div>
            <div className="modal-body">
              <div className="mb-2">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Название цели *
                </label>
                <input
                  className="input"
                  type="text"
                  placeholder="Например: Выучить английский язык"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                />
              </div>
              <div className="mb-2">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Описание
                </label>
                <textarea
                  className="input textarea"
                  placeholder="Подробнее о цели..."
                  value={newGoal.description}
                  onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                />
              </div>
              <div className="mb-2">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Категория
                </label>
                <select
                  className="input"
                  value={newGoal.category}
                  onChange={(e) => setNewGoal({ ...newGoal, category: e.target.value })}
                >
                  <option value="">Не выбрано</option>
                  <option value="personal">🎯 Личное</option>
                  <option value="health">💪 Здоровье</option>
                  <option value="education">📚 Образование</option>
                  <option value="career">💼 Карьера</option>
                  <option value="finance">💰 Финансы</option>
                  <option value="hobby">🎨 Хобби</option>
                </select>
              </div>
              <div className="mb-2">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Приоритет
                </label>
                <select
                  className="input"
                  value={newGoal.priority}
                  onChange={(e) => setNewGoal({ ...newGoal, priority: parseInt(e.target.value) })}
                >
                  <option value="1">🔴 Критичная</option>
                  <option value="2">🟠 Высокая</option>
                  <option value="3">🟡 Средняя</option>
                  <option value="4">🟢 Низкая</option>
                  <option value="5">⚪ Очень низкая</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAddGoal(false)}>
                Отмена
              </button>
              <button className="btn btn-primary" onClick={handleAddGoal}>
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Weakness Modal */}
      {showAddWeakness && (
        <div className="modal-overlay" onClick={() => setShowAddWeakness(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Слабая сторона</h3>
            </div>
            <div className="modal-body">
              <div className="mb-2">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Название *
                </label>
                <input
                  className="input"
                  type="text"
                  placeholder="Например: Прокрастинация"
                  value={newWeakness.title}
                  onChange={(e) => setNewWeakness({ ...newWeakness, title: e.target.value })}
                />
              </div>
              <div className="mb-2">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Описание
                </label>
                <textarea
                  className="input textarea"
                  placeholder="Подробнее..."
                  value={newWeakness.description}
                  onChange={(e) => setNewWeakness({ ...newWeakness, description: e.target.value })}
                />
              </div>
              <div className="mb-2">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Насколько серьёзно?
                </label>
                <select
                  className="input"
                  value={newWeakness.severity}
                  onChange={(e) => setNewWeakness({ ...newWeakness, severity: parseInt(e.target.value) })}
                >
                  <option value="1">🟢 Лёгкая</option>
                  <option value="2">🟡 Средняя</option>
                  <option value="3">🟠 Серьёзная</option>
                  <option value="4">🔴 Критичная</option>
                  <option value="5">💀 Очень критичная</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAddWeakness(false)}>
                Отмена
              </button>
              <button className="btn btn-primary" onClick={handleAddWeakness}>
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Goal Modal */}
      {editingGoal && (
        <div className="modal-overlay" onClick={() => setEditingGoal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Редактировать цель</h3>
            </div>
            <div className="modal-body">
              <div className="mb-2">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Название цели *
                </label>
                <input
                  className="input"
                  type="text"
                  value={editingGoal.title}
                  onChange={(e) => setEditingGoal({ ...editingGoal, title: e.target.value })}
                />
              </div>
              <div className="mb-2">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Описание
                </label>
                <textarea
                  className="input textarea"
                  value={editingGoal.description || ''}
                  onChange={(e) => setEditingGoal({ ...editingGoal, description: e.target.value })}
                />
              </div>
              <div className="mb-2">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Категория
                </label>
                <select
                  className="input"
                  value={editingGoal.category || ''}
                  onChange={(e) => setEditingGoal({ ...editingGoal, category: e.target.value })}
                >
                  <option value="">Не выбрано</option>
                  <option value="personal">🎯 Личное</option>
                  <option value="health">💪 Здоровье</option>
                  <option value="education">📚 Образование</option>
                  <option value="career">💼 Карьера</option>
                  <option value="finance">💰 Финансы</option>
                  <option value="hobby">🎨 Хобби</option>
                </select>
              </div>
              <div className="mb-2">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Приоритет
                </label>
                <select
                  className="input"
                  value={editingGoal.priority}
                  onChange={(e) => setEditingGoal({ ...editingGoal, priority: parseInt(e.target.value) })}
                >
                  <option value="1">🔴 Критичная</option>
                  <option value="2">🟠 Высокая</option>
                  <option value="3">🟡 Средняя</option>
                  <option value="4">🟢 Низкая</option>
                  <option value="5">⚪ Очень низкая</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setEditingGoal(null)}>
                Отмена
              </button>
              <button className="btn btn-primary" onClick={handleUpdateGoal}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Weakness Modal */}
      {editingWeakness && (
        <div className="modal-overlay" onClick={() => setEditingWeakness(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Редактировать слабость</h3>
            </div>
            <div className="modal-body">
              <div className="mb-2">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Название *
                </label>
                <input
                  className="input"
                  type="text"
                  value={editingWeakness.title}
                  onChange={(e) => setEditingWeakness({ ...editingWeakness, title: e.target.value })}
                />
              </div>
              <div className="mb-2">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Описание
                </label>
                <textarea
                  className="input textarea"
                  value={editingWeakness.description || ''}
                  onChange={(e) => setEditingWeakness({ ...editingWeakness, description: e.target.value })}
                />
              </div>
              <div className="mb-2">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  Насколько серьёзно?
                </label>
                <select
                  className="input"
                  value={editingWeakness.severity}
                  onChange={(e) => setEditingWeakness({ ...editingWeakness, severity: parseInt(e.target.value) })}
                >
                  <option value="1">🟢 Лёгкая</option>
                  <option value="2">🟡 Средняя</option>
                  <option value="3">🟠 Серьёзная</option>
                  <option value="4">🔴 Критичная</option>
                  <option value="5">💀 Очень критичная</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setEditingWeakness(null)}>
                Отмена
              </button>
              <button className="btn btn-primary" onClick={handleUpdateWeakness}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Goal Chat Modal */}
      {chatGoal && (
        <GoalChat
          goal={chatGoal}
          onClose={() => setChatGoal(null)}
        />
      )}
    </div>
  );
}

export default Goals;

