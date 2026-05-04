import { useState, useEffect, useRef } from 'react';
import { GameStats } from '../api';

interface UnifiedChatProps {
  user: GameStats;
  onClose: () => void;
  onRefresh: () => void;
}

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
}

function UnifiedChat({ user, onClose, onRefresh }: UnifiedChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadInitialMessage();
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

  const loadInitialMessage = async () => {
    const { user: userData } = user;
    
    const greeting = getTimeGreeting();
    const streakStatus = userData.current_streak > 0 
      ? `У тебя ${userData.current_streak} дней серии 🔥` 
      : 'Давай начнём серию!';
    
    setMessages([{
      id: Date.now(),
      role: 'assistant',
      content: `${greeting}, ${userData.first_name}! 👋\n\n${streakStatus}\n\nЯ знаю все твои цели и задачи. Чем могу помочь?\n\n• Обсудить прогресс\n• Получить совет\n• Разобрать задачу\n• Изменить план`
    }]);
  };

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Доброе утро';
    if (hour < 18) return 'Добрый день';
    return 'Добрый вечер';
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    inputRef.current?.blur();

    const newUserMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: userMessage
    };
    setMessages(prev => [...prev, newUserMessage]);

    setLoading(true);

    try {
      const response = await fetch('/xpgame/api/unified-chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.user.id,
          message: userMessage
        })
      });

      const data = await response.json();

      const aiMessage: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.message || 'Ошибка получения ответа'
      };
      setMessages(prev => [...prev, aiMessage]);

      if (data.tasksCreated) {
        onRefresh();
      }

    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: '❌ Ошибка соединения. Попробуй ещё раз.'
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
    // Скроллим несколько раз чтобы поймать момент после появления клавиатуры
    setTimeout(scrollToBottom, 100);
    setTimeout(scrollToBottom, 300);
    setTimeout(scrollToBottom, 500);
  };

  return (
    <div className="unified-chat">
      {/* Header */}
      <div className="chat-header">
        <button className="back-btn" onClick={onClose}>←</button>
        <div className="chat-title">
          <div className="title-text">🤖 AI Коуч</div>
          <div className="title-subtitle">Знает твои цели и задачи</div>
        </div>
      </div>

      {/* Messages */}
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

      {/* Input */}
      <div className="chat-input-container">
        <textarea
          ref={inputRef}
          className="chat-input"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          onFocus={handleInputFocus}
          placeholder="Спроси что угодно..."
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

      <style>{`
        .unified-chat {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--tg-theme-bg-color, #1a1a2e);
          display: flex;
          flex-direction: column;
          z-index: 1000;
        }

        .chat-header {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: var(--tg-theme-secondary-bg-color, #16213e);
        }

        .back-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: var(--tg-theme-hint-color, #444)33;
          color: var(--tg-theme-text-color, #fff);
          font-size: 1.25rem;
          cursor: pointer;
        }

        .chat-title {
          flex: 1;
        }

        .title-text {
          font-weight: 700;
          font-size: 1rem;
          color: var(--tg-theme-text-color, #fff);
        }

        .title-subtitle {
          font-size: 0.75rem;
          color: var(--tg-theme-hint-color, #888);
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
          color: var(--tg-theme-button-text-color, #fff);
          border-bottom-right-radius: 4px;
        }

        .chat-message.assistant .message-content {
          background: var(--tg-theme-secondary-bg-color, #1e2a3a);
          color: var(--tg-theme-text-color, #fff);
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
      `}</style>
    </div>
  );
}

export default UnifiedChat;
