import { useState, useEffect, useRef } from 'react';
import { authApi } from '../api';

interface OnboardingChatProps {
  userId: number;
  onComplete: () => void;
}

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
}

// UHM этапы
const UHM_STAGES = [
  { id: 'intro', name: 'Знакомство', emoji: '👋' },
  { id: 'meaning', name: 'Смысл', emoji: '💭' },
  { id: 'vision', name: 'Видение', emoji: '🎯' },
  { id: 'reality', name: 'Реальность', emoji: '📍' },
  { id: 'formulate', name: 'Формулировка', emoji: '✍️' },
  { id: 'strategy', name: 'Стратегия', emoji: '🗺️' },
  { id: 'prototypes', name: 'Эксперименты', emoji: '🧪' },
  { id: 'systems', name: 'Система', emoji: '⚙️' },
  { id: 'complete', name: 'Готово', emoji: '🎉' },
];

function OnboardingChat({ userId, onComplete }: OnboardingChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startConversation();
    
    // Telegram WebApp expand
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.expand();
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 50);
  };

  const startConversation = async () => {
    setLoading(true);
    try {
      const response = await fetch('/xpgame/api/onboarding/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      
      const data = await response.json();
      
      if (data.message) {
        setMessages([{
          id: Date.now(),
          role: 'assistant',
          content: data.message
        }]);
      }
    } catch (error) {
      console.error('Error starting onboarding:', error);
      setMessages([{
        id: Date.now(),
        role: 'assistant',
        content: '👋 Привет! Я твой AI-коуч.\n\nДавай вместе поставим твою первую цель по методу UHM.\n\nРасскажи, чего ты хочешь достичь?'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    
    // Скрываем клавиатуру
    inputRef.current?.blur();
    
    const newUserMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: userMessage
    };
    setMessages(prev => [...prev, newUserMessage]);
    
    setLoading(true);
    
    try {
      const response = await fetch('/xpgame/api/onboarding/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          message: userMessage,
          currentStage: UHM_STAGES[currentStage].id
        })
      });
      
      const data = await response.json();
      
      const aiMessage: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.message
      };
      setMessages(prev => [...prev, aiMessage]);
      
      if (data.nextStage) {
        const nextIndex = UHM_STAGES.findIndex(s => s.id === data.nextStage);
        if (nextIndex > currentStage) {
          setCurrentStage(nextIndex);
        }
      }
      
      if (data.isComplete) {
        setIsComplete(true);
        await authApi.updateOnboarding(userId, null, true);
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: '❌ Ошибка. Попробуй ещё раз.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputFocus = () => {
    // Скроллим к последнему сообщению при фокусе с задержкой для клавиатуры
    setTimeout(scrollToBottom, 100);
    setTimeout(scrollToBottom, 300);
    setTimeout(scrollToBottom, 500);
  };

  return (
    <div className="onboarding-chat">
      {/* Header */}
      <div className="onboarding-header">
        <div className="onboarding-title">
          <span className="title-emoji">🚀</span>
          <span>Постановка цели</span>
        </div>
        <div className="progress-text">
          {currentStage + 1}/{UHM_STAGES.length - 1}
        </div>
      </div>

      {/* Текущий этап */}
      <div className="current-stage-banner">
        <span className="stage-emoji">{UHM_STAGES[currentStage].emoji}</span>
        <span className="stage-name">{UHM_STAGES[currentStage].name}</span>
      </div>

      {/* Сообщения */}
      <div className="chat-messages" ref={messagesContainerRef}>
        {messages.map((message) => (
          <div key={message.id} className={`chat-message ${message.role}`}>
            <div className="message-content">
              {message.content}
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="chat-message assistant">
            <div className="message-content typing">
              <span>●</span><span>●</span><span>●</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Ввод */}
      {isComplete ? (
        <div className="completion-section">
          <div className="completion-message">
            🎉 Цель поставлена!
          </div>
          <button className="start-button" onClick={onComplete}>
            Начать 🚀
          </button>
        </div>
      ) : (
        <div className="chat-input-container">
          <textarea
            ref={inputRef}
            className="chat-input"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            onFocus={handleInputFocus}
            placeholder="Напиши сообщение..."
            disabled={loading}
            rows={1}
          />
          <button 
            className="send-btn"
            onClick={sendMessage}
            disabled={!inputMessage.trim() || loading}
          >
            {loading ? '...' : '➤'}
          </button>
        </div>
      )}

      <style>{`
        .onboarding-chat {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          background: var(--tg-theme-bg-color, #1a1a2e);
          color: var(--tg-theme-text-color, #ffffff);
        }

        .onboarding-header {
          flex-shrink: 0;
          padding: 0.75rem 1rem;
          background: var(--tg-theme-secondary-bg-color, #16213e);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .onboarding-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 700;
          font-size: 1rem;
          color: var(--tg-theme-text-color, #ffffff);
        }

        .title-emoji {
          font-size: 1.25rem;
        }

        .progress-text {
          font-size: 0.875rem;
          color: var(--tg-theme-hint-color, #888);
        }

        .current-stage-banner {
          flex-shrink: 0;
          padding: 0.5rem 1rem;
          background: var(--tg-theme-button-color, #3390ec);
          color: var(--tg-theme-button-text-color, #ffffff);
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .stage-emoji {
          font-size: 1rem;
        }

        .stage-name {
          font-weight: 600;
          font-size: 0.875rem;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          -webkit-overflow-scrolling: touch;
        }

        .chat-message {
          max-width: 85%;
          animation: slideIn 0.2s ease;
        }

        .chat-message.user {
          align-self: flex-end;
        }

        .chat-message.assistant {
          align-self: flex-start;
        }

        .message-content {
          padding: 0.75rem 1rem;
          border-radius: 16px;
          line-height: 1.5;
          white-space: pre-wrap;
          word-break: break-word;
          font-size: 0.95rem;
        }

        .chat-message.user .message-content {
          background: var(--tg-theme-button-color, #3390ec);
          color: var(--tg-theme-button-text-color, #ffffff);
          border-bottom-right-radius: 4px;
        }

        .chat-message.assistant .message-content {
          background: var(--tg-theme-secondary-bg-color, #1e2a3a);
          color: var(--tg-theme-text-color, #ffffff);
          border-bottom-left-radius: 4px;
        }

        .message-content.typing {
          display: flex;
          gap: 0.3rem;
          color: var(--tg-theme-hint-color, #888);
        }

        .message-content.typing span {
          animation: bounce 1.4s infinite;
        }

        .message-content.typing span:nth-child(1) { animation-delay: 0s; }
        .message-content.typing span:nth-child(2) { animation-delay: 0.2s; }
        .message-content.typing span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .chat-input-container {
          flex-shrink: 0;
          padding: 0.75rem 1rem;
          padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
          background: var(--tg-theme-secondary-bg-color, #16213e);
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .chat-input {
          flex: 1;
          padding: 0.625rem 1rem;
          border: none;
          border-radius: 20px;
          background: var(--tg-theme-bg-color, #1a1a2e);
          color: var(--tg-theme-text-color, #fff);
          font-size: 16px;
          font-family: inherit;
          resize: none;
          outline: none;
          min-height: 40px;
          max-height: 80px;
        }

        .chat-input::placeholder {
          color: var(--tg-theme-hint-color, #888);
        }

        .send-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: var(--tg-theme-button-color, #3390ec);
          color: var(--tg-theme-button-text-color, #fff);
          font-size: 1rem;
          cursor: pointer;
          flex-shrink: 0;
        }

        .send-btn:disabled {
          opacity: 0.4;
        }

        .completion-section {
          flex-shrink: 0;
          padding: 1.25rem;
          padding-bottom: max(1.25rem, env(safe-area-inset-bottom));
          background: var(--tg-theme-secondary-bg-color, #16213e);
          text-align: center;
        }

        .completion-message {
          font-size: 1.1rem;
          font-weight: 600;
          margin-bottom: 1rem;
          color: var(--tg-theme-text-color, #ffffff);
        }

        .start-button {
          width: 100%;
          padding: 0.875rem;
          border: none;
          border-radius: 12px;
          background: #22c55e;
          color: white;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

export default OnboardingChat;
