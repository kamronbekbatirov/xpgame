/// <reference types="vite/client" />

interface Window {
  Telegram?: {
    WebApp: {
      ready: () => void;
      expand: () => void;
      close: () => void;
      colorScheme: 'light' | 'dark';
      MainButton: {
        text: string;
        show: () => void;
        hide: () => void;
        enable: () => void;
        disable: () => void;
        onClick: (callback: () => void) => void;
        offClick: (callback: () => void) => void;
      };
      BackButton: {
        show: () => void;
        hide: () => void;
        onClick: (callback: () => void) => void;
        offClick: (callback: () => void) => void;
      };
      initData: string;
      initDataUnsafe: {
        user?: {
          id: number;
          first_name: string;
          last_name?: string;
          username?: string;
        };
      };
      themeParams: {
        bg_color?: string;
        text_color?: string;
        hint_color?: string;
        link_color?: string;
        button_color?: string;
        button_text_color?: string;
      };
      sendData: (data: string) => void;
      onEvent: (eventType: string, eventHandler: () => void) => void;
      offEvent: (eventType: string, eventHandler: () => void) => void;
    };
  };
}

