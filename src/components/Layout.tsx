import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
  pageTitle: string;
}

const navLinks = [
  { to: '/broker', label: 'Daily Report', icon: '📊', end: true },
  { to: '/broker/blotter', label: 'Trade Blotter', icon: '📋', end: false },
  { to: '/broker/archive', label: 'Archive', icon: '🗂', end: false },
];

export default function Layout({ children, pageTitle }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    void navigate('/');
  };

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-navy w-60">
      <div className="px-6 py-6 border-b border-navy-light">
        <div className="text-white font-bold text-lg leading-tight">🌿 SUNCO BROKERS</div>
        <div className="text-blue-300 text-xs mt-1">Biofuels Intelligence Platform</div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-navy-light text-white'
                  : 'text-blue-200 hover:bg-navy-light hover:text-white'
              }`
            }
          >
            <span>{link.icon}</span>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-navy-light">
        <p className="text-blue-400 text-xs px-3">Sunco Brokers SA</p>
        <p className="text-blue-500 text-xs px-3">Geneva, Switzerland</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
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
          <div className="absolute inset-0 bg-black opacity-50" />
          <aside className="absolute left-0 top-0 h-full z-50" onClick={(e) => e.stopPropagation()}>
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Hamburger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-1 rounded text-gray-500 hover:text-gray-700"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-navy font-semibold text-lg">{pageTitle}</h1>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-600 hover:text-navy border border-gray-300 hover:border-navy px-3 py-1.5 rounded transition-colors"
          >
            Logout
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
