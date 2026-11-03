import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'dark' | 'light' | 'auto';

interface ThemeContextType {
  theme: ThemeMode;
  actualTheme: 'dark' | 'light';
  setTheme: (theme: ThemeMode) => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  actualTheme: 'dark',
  setTheme: () => {},
  accentColor: '#0071e3',
  setAccentColor: () => {}
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('media-viewer-theme');
    if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved;
    return 'dark';
  });

  const [accentColor, setAccentColorState] = useState<string>(() => {
    return localStorage.getItem('media-viewer-accent') || '#0071e3';
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  const actualTheme: 'dark' | 'light' = theme === 'auto' ? (systemIsDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', actualTheme);
    if (actualTheme === 'light') {
      root.classList.add('light-mode');
      root.classList.remove('dark-mode');
    } else {
      root.classList.add('dark-mode');
      root.classList.remove('light-mode');
    }
    root.style.setProperty('--mac-accent', accentColor);
  }, [actualTheme, accentColor]);

  const setTheme = (t: ThemeMode) => {
    setThemeState(t);
    localStorage.setItem('media-viewer-theme', t);
  };

  const setAccentColor = (c: string) => {
    setAccentColorState(c);
    localStorage.setItem('media-viewer-accent', c);
  };

  return (
    <ThemeContext.Provider value={{ theme, actualTheme, setTheme, accentColor, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
