import { useState, useRef, useEffect, useMemo } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import GlobalSearch, { type GlobalSearchHandle } from './GlobalSearch';
import BookmarksBar from './BookmarksBar';
import ThemeToggle from './ThemeToggle';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

interface NavItem {
  to: string;
  label: string;
  end: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

interface LayoutProps {
  children: React.ReactNode;
  pageTitle: string;
  navLinks?: NavItem[];
  navGroups?: NavGroup[];
}

// Top-level link shown above the groups
const BROKER_TOP: NavItem = { to: '/broker', label: 'Overview', end: true };

const BROKER_GROUPS: NavGroup[] = [
  {
    id: 'market',
    label: 'Market Data',
    items: [
      { to: '/broker/daily',      label: 'Morning Daily Report',  end: false },
      { to: '/broker/evening',    label: 'Daily Evening Report',  end: false },
      { to: '/broker/products',   label: 'Products Data', end: false },
      { to: '/broker/charts',     label: 'Charts',        end: false },
      { to: '/broker/spreads',    label: 'Spreads',       end: false },
      { to: '/broker/history',    label: 'History',       end: false },
      { to: '/broker/alt-data',   label: 'Alt Data',      end: false },
    ],
  },
  {
    id: 'periodic',
    label: 'Periodic Reports',
    items: [
      { to: '/broker/weekly',    label: 'Weekly Report',    end: false },
    ],
  },
  {
    id: 'whiteboard',
    label: 'Whiteboard',
    items: [
      { to: '/broker/whiteboard', label: 'Whiteboard', end: false },
    ],
  },
  {
    id: 'trading',
    label: 'Trading',
    items: [
      { to: '/broker/blotter',        label: 'Trade Blotter',   end: false },
      { to: '/broker/pnl',            label: 'Positions & P&L', end: false },
      { to: '/broker/counterparties', label: 'Counterparties',  end: false },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    items: [
      { to: '/broker/research',    label: 'Research',       end: false },
      { to: '/broker/quant',       label: 'Quant Research', end: false },
      { to: '/broker/forecasting', label: 'Forecasting',    end: false },
      { to: '/broker/ai',          label: 'Biofuels AI',    end: false },
      { to: '/broker/archive',     label: 'Archive',        end: false },
      { to: '/broker/mandates',    label: 'Mandates',       end: false },
      { to: '/broker/feedstock',   label: 'Feedstock & Trade', end: false },
    ],
  },
  {
    id: 'business',
    label: 'Business Dev',
    items: [
      { to: '/broker/prospection',   label: 'Prospection',   end: false },
    ],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      { to: '/broker/alerts',        label: 'Alerts',        end: false },
      { to: '/broker/subscriptions', label: 'Subscriptions', end: false },
    ],
  },
];

// Flat list for backwards compatibility (search, router, etc.)
const BROKER_NAV: NavItem[] = [
  BROKER_TOP,
  ...BROKER_GROUPS.flatMap((g) => g.items),
];

const CLIENT_NAV: NavItem[] = [
  { to: '/client',          label: 'Daily Report',  end: true  },
  { to: '/client/charts',   label: 'Charts',        end: false },
  { to: '/client/archive',  label: 'Archive',       end: false },
  { to: '/client/ai',       label: 'Biofuels AI',   end: false },
];

export { BROKER_NAV, CLIENT_NAV, BROKER_TOP, BROKER_GROUPS };

// ─── Grouped Nav Helpers ──────────────────────────────────────────────────────

const EXPANDED_STORAGE_KEY = 'sunco:sidebar-expanded-groups';

function loadExpandedGroups(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(EXPANDED_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveExpandedGroups(state: Record<string, boolean>) {
  try {
    localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export default function Layout({ children, pageTitle, navLinks, navGroups }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef<GlobalSearchHandle>(null);

  // Decide nav rendering mode:
  //   - navGroups provided → grouped mode
  //   - navLinks provided  → flat mode (client view, etc.)
  //   - neither            → default to broker grouped nav
  const useGroupedMode = !navLinks;
  const links = navLinks ?? BROKER_NAV;
  const groups = navGroups ?? BROKER_GROUPS;
  const topLink = BROKER_TOP;

  // Which group (if any) contains the current path
  const activeGroupId = useMemo(() => {
    const match = groups.find((g) =>
      g.items.some((item) => location.pathname === item.to || location.pathname.startsWith(item.to + '/'))
    );
    return match?.id ?? null;
  }, [groups, location.pathname]);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => loadExpandedGroups());

  // Auto-expand the group that contains the current page
  useEffect(() => {
    if (!activeGroupId) return;
    setExpandedGroups((prev) => (prev[activeGroupId] ? prev : { ...prev, [activeGroupId]: true }));
  }, [activeGroupId]);

  // Persist expansion state
  useEffect(() => {
    saveExpandedGroups(expandedGroups);
  }, [expandedGroups]);

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  useKeyboardShortcuts(undefined, () => searchRef.current?.focus());

  const handleLogout = () => {
    localStorage.clear();
    void navigate('/');
  };

  const renderFlatLink = (link: NavItem) => (
    <NavLink
      key={link.to}
      to={link.to}
      end={link.end}
      onClick={() => setSidebarOpen(false)}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors ${
          isActive
            ? 'bg-accent/10 text-accent border-l-2 border-accent pl-[10px]'
            : 'text-text-secondary hover:bg-card hover:text-text-primary'
        }`
      }
    >
      <span>{link.label}</span>
    </NavLink>
  );

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-panel w-60 border-r border-border">
      <div className="px-6 py-5 border-b border-border">
        <div className="text-text-primary font-bold text-sm tracking-widest uppercase">SUNCO BROKERS</div>
        <div className="text-text-secondary text-xs mt-1 tracking-wide">Biofuels Intelligence</div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {useGroupedMode ? (
          <>
            {/* Top-level Overview link */}
            {renderFlatLink(topLink)}

            {/* Groups */}
            <div className="pt-3 space-y-0.5">
              {groups.map((group) => {
                const isExpanded = !!expandedGroups[group.id];
                const isActiveGroup = activeGroupId === group.id;
                return (
                  <div key={group.id}>
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded text-[10px] font-semibold uppercase tracking-widest transition-colors ${
                        isActiveGroup
                          ? 'text-accent'
                          : 'text-text-dim hover:text-text-secondary'
                      }`}
                    >
                      <span>{group.label}</span>
                      <span className={`text-[9px] transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                        ▶
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="mt-0.5 ml-2 pl-2 border-l border-border/60 space-y-0.5">
                        {group.items.map((item) => (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            onClick={() => setSidebarOpen(false)}
                            className={({ isActive }) =>
                              `flex items-center gap-3 px-3 py-2 rounded text-[13px] font-medium transition-colors ${
                                isActive
                                  ? 'bg-accent/10 text-accent border-l-2 border-accent pl-[10px]'
                                  : 'text-text-secondary hover:bg-card hover:text-text-primary'
                              }`
                            }
                          >
                            <span>{item.label}</span>
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          links.map(renderFlatLink)
        )}
      </nav>
      <div className="px-5 py-4 border-t border-border">
        <p className="text-text-dim text-xs">Sunco Brokers SA</p>
        <p className="text-text-dim text-xs">Geneva, Switzerland</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-surface font-sans overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-shrink-0">
        <Sidebar />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-black opacity-70" />
          <aside className="absolute left-0 top-0 h-full z-50" onClick={(e) => e.stopPropagation()}>
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-panel border-b border-border px-4 md:px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Hamburger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-1 rounded text-text-secondary hover:text-text-primary"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-text-primary font-semibold text-sm tracking-wide uppercase">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <GlobalSearch ref={searchRef} />
            <ThemeToggle />
          <button
            onClick={handleLogout}
            className="text-xs text-text-secondary hover:text-text-primary border border-border hover:border-accent/50 px-3 py-1.5 rounded transition-colors tracking-wide"
          >
            LOGOUT
          </button>
          </div>
        </header>

        {/* Bookmarks bar */}
        <BookmarksBar pageTitle={pageTitle} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
