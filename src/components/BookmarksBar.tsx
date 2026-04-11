import { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Bookmark {
  path: string;
  label: string;
}

const STORAGE_KEY = 'sunco:bookmarks';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadBookmarks(): Bookmark[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Bookmark[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((b) => b && typeof b.path === 'string' && typeof b.label === 'string');
  } catch {
    return [];
  }
}

function saveBookmarks(bookmarks: Bookmark[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  } catch {
    // ignore
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BookmarksBarProps {
  pageTitle: string;
}

export default function BookmarksBar({ pageTitle }: BookmarksBarProps) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => loadBookmarks());
  const location = useLocation();

  useEffect(() => {
    saveBookmarks(bookmarks);
  }, [bookmarks]);

  // Listen for storage changes from other tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setBookmarks(loadBookmarks());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const currentPath = location.pathname;
  const isBookmarked = bookmarks.some((b) => b.path === currentPath);

  const toggleCurrent = useCallback(() => {
    setBookmarks((prev) => {
      if (prev.some((b) => b.path === currentPath)) {
        return prev.filter((b) => b.path !== currentPath);
      }
      // Cap at 8 bookmarks
      const next = [...prev, { path: currentPath, label: pageTitle }];
      return next.slice(-8);
    });
  }, [currentPath, pageTitle]);

  const removeBookmark = useCallback((path: string) => {
    setBookmarks((prev) => prev.filter((b) => b.path !== path));
  }, []);

  if (bookmarks.length === 0) {
    return (
      <div className="bg-panel/60 border-b border-border px-4 md:px-6 py-1.5 flex items-center gap-2 flex-shrink-0">
        <span className="text-text-dim text-[10px] uppercase tracking-widest">Bookmarks</span>
        <button
          onClick={toggleCurrent}
          className="text-[10px] text-text-dim hover:text-accent transition-colors"
          title="Bookmark this page"
        >
          ☆ Pin current page
        </button>
      </div>
    );
  }

  return (
    <div className="bg-panel/60 border-b border-border px-4 md:px-6 py-1.5 flex items-center gap-2 flex-shrink-0 overflow-x-auto">
      <span className="text-text-dim text-[10px] uppercase tracking-widest shrink-0">★</span>
      {bookmarks.map((b) => (
        <div key={b.path} className="group flex items-center shrink-0">
          <NavLink
            to={b.path}
            className={({ isActive }) =>
              `text-[11px] px-2 py-0.5 rounded border transition-colors ${
                isActive
                  ? 'bg-accent/10 border-accent/40 text-accent'
                  : 'bg-surface/50 border-border text-text-secondary hover:border-accent/30 hover:text-text-primary'
              }`
            }
          >
            {b.label}
          </NavLink>
          <button
            onClick={() => removeBookmark(b.path)}
            className="text-text-dim hover:text-negative text-[10px] ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove bookmark"
          >
            ×
          </button>
        </div>
      ))}
      <button
        onClick={toggleCurrent}
        className={`text-[11px] px-2 py-0.5 rounded border shrink-0 transition-colors ${
          isBookmarked
            ? 'text-negative border-negative/30 hover:bg-negative/10'
            : 'text-text-dim border-border hover:text-accent hover:border-accent/30'
        }`}
        title={isBookmarked ? 'Unpin current page' : 'Pin current page'}
      >
        {isBookmarked ? '− Unpin' : '+ Pin current'}
      </button>
    </div>
  );
}
