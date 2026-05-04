import { useState } from 'react';
import { authApi } from '../api';

interface LoginProps {
  userId: number;
  onSuccess: () => void;
}

function Login({ userId, onSuccess }: LoginProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password.trim()) {
      setError('Введите пароль');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await authApi.checkPassword(userId, password);
      
      if (response.data.authorized) {
        onSuccess();
      } else {
        setError(response.data.message || 'Неверный пароль');
        setPassword('');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Ошибка проверки пароля');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      padding: '2rem',
      background: 'var(--bg-color)',
      color: 'var(--text-primary)'
    }}>
      <div style={{
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎯</h1>
        <h2 style={{ marginBottom: '1rem' }}>XP Game</h2>
        <p style={{ 
          color: 'var(--text-secondary)', 
          marginBottom: '2rem',
          fontSize: '0.875rem'
        }}>
          Добро пожаловать! Введите пароль для доступа к приложению.
        </p>

        <form onSubmit={handleSubmit} style={{ marginBottom: '1rem' }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Введите пароль"
            disabled={loading}
            className="input"
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1rem',
              border: '2px solid var(--border-color)',
              borderRadius: '12px',
              background: 'var(--card-bg)',
              color: 'var(--text-primary)',
              marginBottom: '1rem',
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--primary-color)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
          />

          {error && (
            <div style={{
              padding: '0.75rem',
              background: '#ff000020',
              border: '1px solid #ff0000',
              borderRadius: '8px',
              color: '#ff0000',
              fontSize: '0.875rem',
              marginBottom: '1rem'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1rem'
            }}
          >
            {loading ? '⏳ Проверка...' : '🔓 Войти'}
          </button>
        </form>

        <p style={{ 
          fontSize: '0.75rem', 
          color: 'var(--text-secondary)',
          marginTop: '2rem'
        }}>
          Пароль предоставляется администратором
        </p>
      </div>
    </div>
  );
}

export default Login;


