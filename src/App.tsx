import { useState, useEffect } from 'react';
import { userApi, GameStats, authApi } from './api';
import Today from './components/Today';
import Me from './components/Me';
import Login from './components/Login';
import OnboardingChat from './components/OnboardingChat';
import './App.css';

type Page = 'today' | 'me';
type AppState = 'loading' | 'login' | 'onboarding' | 'app';

function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [currentPage, setCurrentPage] = useState<Page>('today');
  const [user, setUser] = useState<GameStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const initApp = async () => {
      const tg = window.Telegram?.WebApp;

      if (tg) {
        tg.ready();
        tg.expand();
        
        // Применяем тему
        const applyTheme = () => {
          const isDark = tg.colorScheme === 'dark';
          document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
          
          if (tg.themeParams?.bg_color) {
            document.documentElement.style.setProperty('--bg-color', tg.themeParams.bg_color);
          }
          if (tg.themeParams?.text_color) {
            document.documentElement.style.setProperty('--text-primary', tg.themeParams.text_color);
          }
        };
        
        applyTheme();
        
        tg.onEvent('themeChanged', applyTheme);
        cleanup = () => tg.offEvent('themeChanged', applyTheme);
      }

      await new Promise(resolve => setTimeout(resolve, tg ? 200 : 300));
      await checkAuthAndLoad();
    };

    initApp();

    return () => cleanup?.();
  }, []);

  const checkAuthAndLoad = async () => {
    try {
      setLoading(true);
      const userData = await loadUser();
      
      if (!userData) {
        setAppState('loading');
        return;
      }

      const authStatus = await authApi.getStatus(userData.user.id);
      
      if (!authStatus.data.isAuthorized) {
        setAppState('login');
        return;
      }
      
      if (!authStatus.data.onboardingCompleted) {
        setAppState('onboarding');
        return;
      }
      
      setAppState('app');
    } catch (error) {
      console.error('Error checking auth:', error);
      setAppState('app');
    } finally {
      setLoading(false);
    }
  };

  const loadUser = async (): Promise<GameStats | null> => {
    try {
      const tg = window.Telegram?.WebApp;
      const telegramUser = tg?.initDataUnsafe?.user;
      
      if (!telegramUser) {
        if (typeof window !== 'undefined' && !window.Telegram) {
          setError('Открой через Telegram');
        } else {
          setError('Ошибка загрузки. Перезапусти приложение.');
        }
        setLoading(false);
        return null;
      }

      try {
        await userApi.createOrUpdateUser({
          telegram_id: telegramUser.id,
          username: telegramUser.username,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name,
          photo_url: (telegramUser as any).photo_url,
        });
      } catch (createError: any) {
        if (createError?.response?.status !== 409) throw createError;
      }

      const response = await userApi.getUser(telegramUser.id);
      setUser(response.data);
      setError(null);
      return response.data;
    } catch (err: any) {
      console.error('Error loading user:', err);
      setError('Ошибка загрузки');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = () => loadUser();

  // Loading
  if (loading || appState === 'loading') {
    return (
      <div className="app-loading">
        <div className="loading-content">
          <div className="loading-fire">🔥</div>
          <div className="loading-text">Загрузка...</div>
        </div>
      </div>
    );
  }

  // Login
  if (appState === 'login' && user) {
    return <Login userId={user.user.id} onSuccess={() => checkAuthAndLoad()} />;
  }

  // Onboarding - UHM Chat
  if (appState === 'onboarding' && user) {
    return <OnboardingChat userId={user.user.id} onComplete={() => checkAuthAndLoad()} />;
  }

  // Error
  if (error || !user) {
    return (
      <div className="app-error">
        <div className="error-content">
          <div className="error-icon">⚠️</div>
          <p>{error || 'Ошибка загрузки'}</p>
          <button onClick={() => checkAuthAndLoad()}>
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  // Main App - 2 страницы
  return (
    <div className="app">
      <main className="app-content">
        {currentPage === 'today' && (
          <Today 
            user={user} 
            onRefresh={refreshUser} 
            onNavigate={(page) => setCurrentPage(page as Page)}
          />
        )}
        {currentPage === 'me' && (
          <Me user={user} onRefresh={refreshUser} />
        )}
      </main>

      {/* Минималистичная навигация - 2 кнопки */}
      <nav className="bottom-nav">
        <button
          className={`nav-btn ${currentPage === 'today' ? 'active' : ''}`}
          onClick={() => setCurrentPage('today')}
        >
          <span className="nav-icon">✅</span>
          <span className="nav-label">Сегодня</span>
        </button>
        <button
          className={`nav-btn ${currentPage === 'me' ? 'active' : ''}`}
          onClick={() => setCurrentPage('me')}
        >
          <span className="nav-icon">👤</span>
          <span className="nav-label">Я</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
