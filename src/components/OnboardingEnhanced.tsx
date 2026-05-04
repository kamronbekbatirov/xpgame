import { useState } from 'react';
import { goalsApi, weaknessesApi, aiApi, authApi } from '../api';

interface OnboardingProps {
  userId: number;
  onComplete: () => void;
}

interface GoalForm {
  title: string;
  description: string;
  category: string;
  priority: number;
}

interface WeaknessForm {
  title: string;
  description: string;
  severity: number;
}

function OnboardingEnhanced({ userId, onComplete }: OnboardingProps) {
  const [step, setStep] = useState<'welcome' | 'goals' | 'weaknesses' | 'generating'>('welcome');
  const [goals, setGoals] = useState<GoalForm[]>([
    { title: '', description: '', category: 'personal', priority: 3 }
  ]);
  const [weaknesses, setWeaknesses] = useState<WeaknessForm[]>([
    { title: '', description: '', severity: 3 }
  ]);
  const [loading, setLoading] = useState(false);

  const categories = [
    { value: 'personal', label: '🎯 Личное' },
    { value: 'health', label: '💪 Здоровье' },
    { value: 'education', label: '📚 Образование' },
    { value: 'career', label: '💼 Карьера' },
    { value: 'finance', label: '💰 Финансы' },
    { value: 'hobby', label: '🎨 Хобби' },
  ];

  const priorities = [
    { value: 1, label: '🔴 Критичная', color: '#ff4444' },
    { value: 2, label: '🟠 Высокая', color: '#ff9944' },
    { value: 3, label: '🟡 Средняя', color: '#ffdd44' },
    { value: 4, label: '🟢 Низкая', color: '#44ff44' },
  ];

  const severities = [
    { value: 1, label: '🟢 Лёгкая' },
    { value: 2, label: '🟡 Средняя' },
    { value: 3, label: '🟠 Серьёзная' },
    { value: 4, label: '🔴 Критичная' },
  ];

  const handleAddGoal = () => {
    setGoals([...goals, { title: '', description: '', category: 'personal', priority: 3 }]);
  };

  const handleRemoveGoal = (index: number) => {
    if (goals.length > 1) {
      setGoals(goals.filter((_, i) => i !== index));
    }
  };

  const handleGoalChange = (index: number, field: keyof GoalForm, value: string | number) => {
    const newGoals = [...goals];
    newGoals[index] = { ...newGoals[index], [field]: value };
    setGoals(newGoals);
  };

  const handleAddWeakness = () => {
    setWeaknesses([...weaknesses, { title: '', description: '', severity: 3 }]);
  };

  const handleRemoveWeakness = (index: number) => {
    if (weaknesses.length > 1) {
      setWeaknesses(weaknesses.filter((_, i) => i !== index));
    }
  };

  const handleWeaknessChange = (index: number, field: keyof WeaknessForm, value: string | number) => {
    const newWeaknesses = [...weaknesses];
    newWeaknesses[index] = { ...newWeaknesses[index], [field]: value };
    setWeaknesses(newWeaknesses);
  };

  const handleNextFromGoals = async () => {
    const validGoals = goals.filter(g => g.title.trim());
    
    if (validGoals.length === 0) {
      alert('Добавьте хотя бы одну цель');
      return;
    }

    try {
      setLoading(true);
      
      // Сохраняем цели с полной информацией
      for (const goal of validGoals) {
        await goalsApi.createGoal({ 
          user_id: userId, 
          title: goal.title,
          description: goal.description || undefined,
          category: goal.category,
          priority: goal.priority
        });
      }
      
      await authApi.updateOnboarding(userId, 'weaknesses', false);
      setStep('weaknesses');
    } catch (error) {
      console.error('Error saving goals:', error);
      alert('Ошибка сохранения целей');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    const validWeaknesses = weaknesses.filter(w => w.title.trim());
    
    if (validWeaknesses.length === 0) {
      alert('Добавьте хотя бы одну слабую сторону');
      return;
    }

    try {
      setLoading(true);
      setStep('generating');
      
      // Сохраняем слабости с полной информацией
      for (const weakness of validWeaknesses) {
        await weaknessesApi.createWeakness({ 
          user_id: userId, 
          title: weakness.title,
          description: weakness.description || undefined,
          severity: weakness.severity
        });
      }
      
      await authApi.updateOnboarding(userId, 'generating', false);
      
      // Генерируем план через AI
      await aiApi.generatePlan(userId);
      
      // Завершаем onboarding
      await authApi.updateOnboarding(userId, null, true);
      
      onComplete();
    } catch (error) {
      console.error('Error generating plan:', error);
      alert('Ошибка генерации плана. Попробуйте позже.');
      setStep('weaknesses');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'welcome') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: '2rem',
        background: 'var(--bg-color)',
        color: 'var(--text-primary)',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</h1>
        <h2 style={{ marginBottom: '0.5rem' }}>Добро пожаловать!</h2>
        <p style={{ 
          color: 'var(--text-secondary)', 
          marginBottom: '2rem',
          maxWidth: '400px'
        }}>
          Давайте настроим ваше приложение. Это займет всего пару минут.
        </p>
        
        <button
          className="btn btn-primary"
          onClick={() => setStep('goals')}
          style={{ minWidth: '200px' }}
        >
          Начать 🚀
        </button>
      </div>
    );
  }

  if (step === 'goals') {
    return (
      <div style={{
        minHeight: '100vh',
        padding: '2rem 1rem 6rem 1rem',
        background: 'var(--bg-color)',
        color: 'var(--text-primary)'
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ marginBottom: '0.5rem' }}>Ваши цели 🎯</h2>
          <p style={{ 
            color: 'var(--text-secondary)', 
            fontSize: '0.875rem',
            marginBottom: '1.5rem'
          }}>
            Добавьте детали для каждой цели
          </p>

          {goals.map((goal, index) => (
            <div key={index} className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>Цель {index + 1}</h3>
                {goals.length > 1 && (
                  <button
                    onClick={() => handleRemoveGoal(index)}
                    className="btn btn-outline"
                    style={{ padding: '0.5rem', minWidth: '36px', fontSize: '0.875rem' }}
                  >
                    🗑️
                  </button>
                )}
              </div>

              <input
                type="text"
                value={goal.title}
                onChange={(e) => handleGoalChange(index, 'title', e.target.value)}
                placeholder="Название цели (например: выучить английский)"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid rgba(128, 128, 128, 0.3)',
                  borderRadius: '8px',
                  background: 'rgba(128, 128, 128, 0.1)',
                  color: 'var(--text-primary)',
                  fontSize: '1rem',
                  marginBottom: '0.75rem',
                  boxSizing: 'border-box'
                }}
              />

              <textarea
                value={goal.description}
                onChange={(e) => handleGoalChange(index, 'description', e.target.value)}
                placeholder="Описание (опционально)"
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid rgba(128, 128, 128, 0.3)',
                  borderRadius: '8px',
                  background: 'rgba(128, 128, 128, 0.1)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  marginBottom: '0.75rem',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    Категория
                  </label>
                  <select
                    value={goal.category}
                    onChange={(e) => handleGoalChange(index, 'category', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid rgba(128, 128, 128, 0.3)',
                      borderRadius: '8px',
                      background: 'rgba(128, 128, 128, 0.1)',
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box'
                    }}
                  >
                    {categories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    Приоритет
                  </label>
                  <select
                    value={goal.priority}
                    onChange={(e) => handleGoalChange(index, 'priority', parseInt(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid rgba(128, 128, 128, 0.3)',
                      borderRadius: '8px',
                      background: 'rgba(128, 128, 128, 0.1)',
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box'
                    }}
                  >
                    {priorities.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={handleAddGoal}
            className="btn btn-outline"
            style={{ 
              width: '100%', 
              marginBottom: '1rem',
              padding: '0.75rem'
            }}
          >
            ➕ Добавить ещё цель
          </button>

          <button
            onClick={handleNextFromGoals}
            disabled={loading || goals.filter(g => g.title.trim()).length === 0}
            className="btn btn-primary"
            style={{ width: '100%', padding: '1rem' }}
          >
            {loading ? '⏳ Сохранение...' : 'Далее →'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'weaknesses') {
    return (
      <div style={{
        minHeight: '100vh',
        padding: '2rem 1rem 6rem 1rem',
        background: 'var(--bg-color)',
        color: 'var(--text-primary)'
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ marginBottom: '0.5rem' }}>Ваши слабые стороны ⚠️</h2>
          <p style={{ 
            color: 'var(--text-secondary)', 
            fontSize: '0.875rem',
            marginBottom: '1.5rem'
          }}>
            Что мешает достижению целей?
          </p>

          {weaknesses.map((weakness, index) => (
            <div key={index} className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>Слабость {index + 1}</h3>
                {weaknesses.length > 1 && (
                  <button
                    onClick={() => handleRemoveWeakness(index)}
                    className="btn btn-outline"
                    style={{ padding: '0.5rem', minWidth: '36px', fontSize: '0.875rem' }}
                  >
                    🗑️
                  </button>
                )}
              </div>

              <input
                type="text"
                value={weakness.title}
                onChange={(e) => handleWeaknessChange(index, 'title', e.target.value)}
                placeholder="Название (например: играю в игры 3 часа)"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid rgba(128, 128, 128, 0.3)',
                  borderRadius: '8px',
                  background: 'rgba(128, 128, 128, 0.1)',
                  color: 'var(--text-primary)',
                  fontSize: '1rem',
                  marginBottom: '0.75rem',
                  boxSizing: 'border-box'
                }}
              />

              <textarea
                value={weakness.description}
                onChange={(e) => handleWeaknessChange(index, 'description', e.target.value)}
                placeholder="Подробнее (опционально)"
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid rgba(128, 128, 128, 0.3)',
                  borderRadius: '8px',
                  background: 'rgba(128, 128, 128, 0.1)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  marginBottom: '0.75rem',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  Насколько серьёзно?
                </label>
                <select
                  value={weakness.severity}
                  onChange={(e) => handleWeaknessChange(index, 'severity', parseInt(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid rgba(128, 128, 128, 0.3)',
                    borderRadius: '8px',
                    background: 'rgba(128, 128, 128, 0.1)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box'
                  }}
                >
                  {severities.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}

          <button
            onClick={handleAddWeakness}
            className="btn btn-outline"
            style={{ 
              width: '100%', 
              marginBottom: '1rem',
              padding: '0.75rem'
            }}
          >
            ➕ Добавить ещё слабость
          </button>

          <button
            onClick={handleGenerate}
            disabled={loading || weaknesses.filter(w => w.title.trim()).length === 0}
            className="btn btn-primary"
            style={{ width: '100%', padding: '1rem' }}
          >
            {loading ? '⏳ Генерация...' : 'Создать план с AI 🤖'}
          </button>
        </div>
      </div>
    );
  }

  // generating step
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      padding: '2rem',
      background: 'var(--bg-color)',
      color: 'var(--text-primary)',
      textAlign: 'center'
    }}>
      <div className="spinner" style={{ marginBottom: '1.5rem' }}></div>
      <h2 style={{ marginBottom: '0.5rem' }}>Создаём ваш план... 🤖</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
        AI анализирует ваши цели и создаёт персональные задачи
      </p>
    </div>
  );
}

export default OnboardingEnhanced;

