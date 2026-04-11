import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';
const STORAGE_KEY = 'sunco:theme';

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // ignore
  }
  return 'dark';
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'light') {
    root.classList.add('light');
  } else {
    root.classList.remove('light');
  }
}

// Apply theme immediately on module load to prevent flash
applyTheme(getInitialTheme());

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const toggle = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-text-secondary border border-border rounded hover:border-accent/50 hover:text-text-primary transition-colors"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
    </button>
  );
}
