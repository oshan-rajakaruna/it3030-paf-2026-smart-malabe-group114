import { createContext, useEffect } from 'react';

import { useLocalStorage } from '../hooks/useLocalStorage';
import { THEMES } from '../utils/constants';

export const ThemeContext = createContext(null);

function getPreferredTheme() {
  if (typeof window === 'undefined') {
    return THEMES.LIGHT;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? THEMES.DARK : THEMES.LIGHT;
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useLocalStorage('smart-campus-theme', getPreferredTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK));
  };

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}
