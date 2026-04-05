import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

interface NavItem {
  to: string;
  label: string;
  end: boolean;
}

interface LayoutProps {
  children: React.ReactNode;
  pageTitle: string;
  navLinks?: NavItem[];
}

const BROKER_NAV: NavItem[] = [
  { to: '/broker',           label: 'Daily Report',  end: true  },
  { to: '/broker/products',  label: 'Products Data', end: false },
  { to: '/broker/charts',    label: 'Charts',        end: false },
  { to: '/broker/blotter',   label: 'Trade Blotter', end: false },
  { to: '/broker/archive',   label: 'Archive',       end: false },
  { to: '/broker/ai',        label: 'Biofuels AI',   end: false },
  { to: '/broker/research',  label: 'Research',      end: false },
];

const CLIENT_NAV: NavItem[] = [
  { to: '/client',          label: 'Daily Report',  end: true  },
  { to: '/client/charts',   label: 'Charts',        end: false },
  { to: '/client/archive',  label: 'Archive',       end: false },
  { to: '/client/ai',       label: 'Biofuels AI',   end: false },
];

export { BROKER_NAV, CLIENT_NAV };

export default function Layout({ children, pageTitle, navLinks }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const links = navLinks ?? BROKER_NAV;

  const handleLogout = () => {
    localStorage.clear();
    void navigate('/');
  };

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-panel w-60 border-r border-border">
      <div className="px-6 py-5 border-b border-border">
        <div className="text-text-primary font-bold text-sm tracking-widest uppercase">SUNCO BROKERS</div>
        <div className="text-text-secondary text-xs mt-1 tracking-wide">Biofuels Intelligence</div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {links.map((link) => (
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
        ))}
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
          <button
            onClick={handleLogout}
            className="text-xs text-text-secondary hover:text-text-primary border border-border hover:border-accent/50 px-3 py-1.5 rounded transition-colors tracking-wide"
          >
            LOGOUT
          </button>
        </header>

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
