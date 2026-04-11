import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Global keyboard shortcuts for the broker platform.
 *
 * Shortcut table:
 *   o → Overview
 *   d → Daily Report
 *   m → Mandates
 *   p → Products Data
 *   c → Charts
 *   s → Spreads
 *   h → History
 *   b → Trade Blotter
 *   l → Positions & P&L (L for ledger)
 *   k → Counterparties (K for... uh, key accounts)
 *   a → Alerts
 *   r → Research
 *   / → Focus global search (handled by GlobalSearch component directly)
 *   ? → Show shortcut help modal
 *
 * Shortcuts are disabled when an input/textarea is focused.
 */

export interface ShortcutHelp {
  key: string;
  description: string;
  path: string;
}

export const SHORTCUTS: ShortcutHelp[] = [
  { key: 'O', description: 'Overview',        path: '/broker' },
  { key: 'D', description: 'Daily Report',    path: '/broker/daily' },
  { key: 'M', description: 'Mandates',        path: '/broker/mandates' },
  { key: 'P', description: 'Products Data',   path: '/broker/products' },
  { key: 'C', description: 'Charts',          path: '/broker/charts' },
  { key: 'S', description: 'Spreads',         path: '/broker/spreads' },
  { key: 'H', description: 'History',         path: '/broker/history' },
  { key: 'B', description: 'Trade Blotter',   path: '/broker/blotter' },
  { key: 'L', description: 'Positions & P&L', path: '/broker/pnl' },
  { key: 'K', description: 'Counterparties',  path: '/broker/counterparties' },
  { key: 'A', description: 'Alerts',          path: '/broker/alerts' },
  { key: 'R', description: 'Research',        path: '/broker/research' },
];

export function useKeyboardShortcuts(onShowHelp?: () => void, onFocusSearch?: () => void) {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when user is typing in an input, textarea, or contentEditable element
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Ignore when modifier keys are held (don't hijack Cmd+C etc.)
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      const key = e.key.toLowerCase();

      // Search shortcut
      if (key === '/' && onFocusSearch) {
        e.preventDefault();
        onFocusSearch();
        return;
      }

      // Help shortcut
      if (key === '?' && onShowHelp) {
        e.preventDefault();
        onShowHelp();
        return;
      }

      // Navigation shortcuts
      const shortcut = SHORTCUTS.find((s) => s.key.toLowerCase() === key);
      if (shortcut) {
        e.preventDefault();
        void navigate(shortcut.path);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, onShowHelp, onFocusSearch]);
}
