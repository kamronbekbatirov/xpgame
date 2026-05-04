import { useState, useEffect } from 'react';
import { budgetApi } from '../api';

interface BudgetProps {
  userId: number;
}

type Tab = 'incomes' | 'expenses' | 'subscriptions' | 'stats';

function Budget({ userId }: BudgetProps) {
  const [activeTab, setActiveTab] = useState<Tab>('stats');
  const [incomes, setIncomes] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Form states
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<'income' | 'expense' | 'subscription'>('income');
  const [formData, setFormData] = useState<any>({});
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [incomesRes, expensesRes, subsRes, statsRes] = await Promise.allSettled([
        budgetApi.getIncomes(userId),
        budgetApi.getExpenses(userId),
        budgetApi.getSubscriptions(userId),
        budgetApi.getStats(userId)
      ]);

      if (incomesRes.status === 'fulfilled') setIncomes(incomesRes.value.data);
      if (expensesRes.status === 'fulfilled') setExpenses(expensesRes.value.data);
      if (subsRes.status === 'fulfilled') setSubscriptions(subsRes.value.data);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
    } catch (error) {
      console.error('Error loading budget data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = { ...formData, user_id: userId };
      
      if (editingId) {
        // Update
        if (formType === 'income') await budgetApi.updateIncome(editingId, data);
        else if (formType === 'expense') await budgetApi.updateExpense(editingId, data);
        else await budgetApi.updateSubscription(editingId, data);
      } else {
        // Create
        if (formType === 'income') await budgetApi.createIncome(data);
        else if (formType === 'expense') await budgetApi.createExpense(data);
        else await budgetApi.createSubscription(data);
      }
      
      setShowForm(false);
      setFormData({});
      setEditingId(null);
      loadData();
    } catch (error) {
      console.error('Error saving:', error);
      alert('Ошибка сохранения');
    }
  };

  const handleDelete = async (type: 'income' | 'expense' | 'subscription', id: number) => {
    if (!confirm('Удалить эту запись?')) return;
    
    try {
      if (type === 'income') await budgetApi.deleteIncome(id);
      else if (type === 'expense') await budgetApi.deleteExpense(id);
      else await budgetApi.deleteSubscription(id);
      loadData();
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Ошибка удаления');
    }
  };

  const openForm = (type: 'income' | 'expense' | 'subscription', item?: any) => {
    setFormType(type);
    if (item) {
      setEditingId(item.id);
      setFormData(item);
    } else {
      setEditingId(null);
      setFormData({ date: new Date().toISOString().split('T')[0] });
    }
    setShowForm(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ fontSize: '2rem' }}>⏳ Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">💰 Бюджет</h1>
        <p className="page-subtitle" style={{color: 'var(--text-secondary)'}}>
          Управляй своими финансами
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1.5rem',
        overflowX: 'auto',
        padding: '0.25rem'
      }}>
        {[
          { key: 'stats', label: '📊 Статистика', icon: '📊' },
          { key: 'incomes', label: '💵 Доходы', icon: '💵' },
          { key: 'expenses', label: '💸 Расходы', icon: '💸' },
          { key: 'subscriptions', label: '🔄 Подписки', icon: '🔄' }
        ].map(tab => (
          <button
            key={tab.key}
            className="btn"
            onClick={() => setActiveTab(tab.key as Tab)}
            style={{
              flex: 1,
              background: activeTab === tab.key ? 'var(--primary-color)' : 'var(--secondary-bg-color)',
              color: activeTab === tab.key ? 'white' : 'var(--text-primary)',
              border: activeTab === tab.key ? 'none' : '1px solid var(--border-color)',
              fontWeight: activeTab === tab.key ? 600 : 'normal'
            }}
          >
            {tab.icon}
          </button>
        ))}
      </div>

      {/* Stats Tab */}
      {activeTab === 'stats' && stats && (
        <div>
          <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card" style={{ border: '2px solid var(--success-color)' }}>
              <div className="stat-value" style={{ color: 'var(--success-color)' }}>+{formatCurrency(stats.totalIncome)}</div>
              <div className="stat-label">Доходы</div>
            </div>
            <div className="stat-card" style={{ border: '2px solid var(--error-color)' }}>
              <div className="stat-value" style={{ color: 'var(--error-color)' }}>-{formatCurrency(stats.totalExpense)}</div>
              <div className="stat-label">Расходы</div>
            </div>
            <div className="stat-card" style={{ border: '2px solid var(--primary-color)' }}>
              <div className="stat-value" style={{ color: stats.balance >= 0 ? 'var(--success-color)' : 'var(--error-color)' }}>
                {stats.balance >= 0 ? '+' : ''}{formatCurrency(stats.balance)}
              </div>
              <div className="stat-label">Баланс</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.subscriptions.count}</div>
              <div className="stat-label">Подписок ({formatCurrency(stats.subscriptions.total)}/мес)</div>
            </div>
          </div>

          {/* Charts placeholders */}
          {stats.expenseByCategory.length > 0 && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>💸 Расходы по категориям</h3>
              {stats.expenseByCategory.map((cat: any) => (
                <div key={cat.category} style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ color: 'var(--text-primary)' }}>{cat.category}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(cat.total)}</span>
                  </div>
                  <div style={{ height: '8px', background: 'var(--secondary-bg-color)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${(cat.total / stats.totalExpense) * 100}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, var(--error-color), var(--warning-color))',
                      borderRadius: '4px'
                    }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {stats.incomeByCategory.length > 0 && (
            <div className="card">
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>💵 Доходы по категориям</h3>
              {stats.incomeByCategory.map((cat: any) => (
                <div key={cat.category} style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ color: 'var(--text-primary)' }}>{cat.category}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(cat.total)}</span>
                  </div>
                  <div style={{ height: '8px', background: 'var(--secondary-bg-color)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${(cat.total / stats.totalIncome) * 100}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, var(--success-color), var(--primary-color))',
                      borderRadius: '4px'
                    }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Incomes Tab */}
      {activeTab === 'incomes' && (
        <div>
          <button className="btn btn-primary" onClick={() => openForm('income')} style={{ marginBottom: '1rem' }}>
            ➕ Добавить доход
          </button>
          {incomes.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              Пока нет записей о доходах
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {incomes.map(item => (
                <div key={item.id} className="card" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{item.title}</div>
                      {item.category && (
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                          📁 {item.category}
                        </div>
                      )}
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        📅 {new Date(item.date).toLocaleDateString('ru-RU')}
                      </div>
                      {item.notes && (
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                          💬 {item.notes}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', marginLeft: '1rem' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--success-color)', marginBottom: '0.5rem' }}>
                        +{formatCurrency(item.amount)}
                      </div>
                      <button className="btn btn-outline" onClick={() => openForm('income', item)} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', marginRight: '0.25rem' }}>
                        ✏️
                      </button>
                      <button className="btn btn-outline" onClick={() => handleDelete('income', item.id)} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Expenses Tab */}
      {activeTab === 'expenses' && (
        <div>
          <button className="btn btn-primary" onClick={() => openForm('expense')} style={{ marginBottom: '1rem' }}>
            ➕ Добавить расход
          </button>
          {expenses.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              Пока нет записей о расходах
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {expenses.map(item => (
                <div key={item.id} className="card" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{item.title}</div>
                      {item.category && (
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                          📁 {item.category}
                        </div>
                      )}
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        📅 {new Date(item.date).toLocaleDateString('ru-RU')}
                      </div>
                      {item.notes && (
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                          💬 {item.notes}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', marginLeft: '1rem' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--error-color)', marginBottom: '0.5rem' }}>
                        -{formatCurrency(item.amount)}
                      </div>
                      <button className="btn btn-outline" onClick={() => openForm('expense', item)} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', marginRight: '0.25rem' }}>
                        ✏️
                      </button>
                      <button className="btn btn-outline" onClick={() => handleDelete('expense', item.id)} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Subscriptions Tab */}
      {activeTab === 'subscriptions' && (
        <div>
          <button className="btn btn-primary" onClick={() => openForm('subscription')} style={{ marginBottom: '1rem' }}>
            ➕ Добавить подписку
          </button>
          {subscriptions.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              Пока нет подписок
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {subscriptions.map(item => (
                <div key={item.id} className="card" style={{ padding: '1rem', opacity: item.is_active ? 1 : 0.6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                        {item.service_name} {!item.is_active && '(Неактивна)'}
                      </div>
                      {item.category && (
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                          📁 {item.category}
                        </div>
                      )}
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        🔄 {item.billing_period === 'monthly' ? 'Ежемесячно' : item.billing_period === 'yearly' ? 'Ежегодно' : 'Ежеквартально'}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        📅 След. платёж: {new Date(item.next_billing_date).toLocaleDateString('ru-RU')}
                      </div>
                      {item.notes && (
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                          💬 {item.notes}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', marginLeft: '1rem' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary-color)', marginBottom: '0.5rem' }}>
                        {formatCurrency(item.amount)}
                      </div>
                      <button className="btn btn-outline" onClick={() => openForm('subscription', item)} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', marginRight: '0.25rem' }}>
                        ✏️
                      </button>
                      <button className="btn btn-outline" onClick={() => handleDelete('subscription', item.id)} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          zIndex: 1000
        }} onClick={() => setShowForm(false)}>
          <div className="card" style={{ maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>
              {editingId ? 'Редактировать' : 'Добавить'} {
                formType === 'income' ? 'доход' :
                formType === 'expense' ? 'расход' : 'подписку'
              }
            </h3>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  {formType === 'subscription' ? 'Название сервиса' : 'Название'}
                </label>
                <input
                  type="text"
                  className="input"
                  value={formData[formType === 'subscription' ? 'service_name' : 'title'] || ''}
                  onChange={(e) => setFormData({ ...formData, [formType === 'subscription' ? 'service_name' : 'title']: e.target.value })}
                  required
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Сумма</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={formData.amount || ''}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                  required
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Категория</label>
                <input
                  type="text"
                  className="input"
                  value={formData.category || ''}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Необязательно"
                />
              </div>
              {formType !== 'subscription' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Дата</label>
                  <input
                    type="date"
                    className="input"
                    value={formData.date || ''}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
              )}
              {formType === 'subscription' && (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Период оплаты</label>
                    <select
                      className="input"
                      value={formData.billing_period || 'monthly'}
                      onChange={(e) => setFormData({ ...formData, billing_period: e.target.value })}
                      required
                    >
                      <option value="monthly">Ежемесячно</option>
                      <option value="quarterly">Ежеквартально</option>
                      <option value="yearly">Ежегодно</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Следующий платёж</label>
                    <input
                      type="date"
                      className="input"
                      value={formData.next_billing_date || ''}
                      onChange={(e) => setFormData({ ...formData, next_billing_date: e.target.value })}
                      required
                    />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', color: 'var(--text-primary)' }}>
                      <input
                        type="checkbox"
                        checked={formData.is_active !== false}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        style={{ marginRight: '0.5rem' }}
                      />
                      Активна
                    </label>
                  </div>
                </>
              )}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Заметки</label>
                <textarea
                  className="input"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Необязательно"
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {editingId ? 'Сохранить' : 'Добавить'}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)} style={{ flex: 1 }}>
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Budget;


