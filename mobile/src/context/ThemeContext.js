import React, { createContext, useState, useContext } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [activeTheme, setActiveTheme] = useState('Light');

  const isDark = activeTheme === 'Dark';
  
  const theme = {
    bg: isDark ? '#0f172a' : '#f8fafc',
    card: isDark ? '#1e293b' : '#ffffff',
    textMain: isDark ? '#f8fafc' : '#0f172a',
    textSub: isDark ? '#94a3b8' : '#64748b',
    border: isDark ? '#334155' : '#f1f5f9',
    iconBg: isDark ? '#334155' : '#f1f5f9',
  };

  return (
    <ThemeContext.Provider value={{ activeTheme, setActiveTheme, isDark, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
