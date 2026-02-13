import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { WhlcMark, WhlcWordmark } from './WhlcLogo';
import NotificationBell from './NotificationBell';

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const handleLogout = () => {
    setDrawerOpen(false);
    logout();
    navigate('/login');
  };

  const showEvents = user?.role !== 'hiring_manager' || user?.eventAccess !== false;

  const navItems = [
    { to: '/', label: 'Dashboard' },
    { to: '/jobs', label: 'Jobs' },
    { to: '/applicants', label: 'Applicants' },
    ...(showEvents ? [{ to: '/events', label: 'Events' }] : []),
    ...(user?.role === 'admin' || user?.role === 'hiring_manager'
      ? [{ to: '/settings', label: 'Settings' }]
      : []),
    ...(user?.role === 'admin' ? [{ to: '/offices', label: 'Offices' }] : []),
    ...(user?.role === 'admin' ? [{ to: '/users', label: 'Users' }] : []),
  ];

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-6 py-6 border-b border-neutral-800">
        <NavLink to="/" className="flex items-center gap-3 text-white">
          <WhlcMark height={48} />
          <div className="flex flex-col items-center">
            <WhlcWordmark height={16} />
            <span className="text-[9px] uppercase tracking-[0.2em] text-neutral-500 font-display mt-1">Applicant Tracking System</span>
          </div>
        </NavLink>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `block px-4 py-2.5 rounded text-sm font-medium font-display uppercase tracking-wider transition-colors ${
                isActive
                  ? 'bg-neutral-700 text-white'
                  : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout at bottom */}
      <div className="px-5 py-5 border-t border-neutral-800">
        <div className="flex items-center justify-between mb-3">
          <NotificationBell />
          <button
            onClick={toggleTheme}
            className="p-2 rounded hover:bg-neutral-800 transition-colors text-neutral-400 hover:text-white"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
        <div className="mb-3">
          <p className="text-sm font-medium truncate">{user?.name}</p>
          <p className="text-xs text-neutral-400 capitalize">{user?.role?.replace('_', ' ')}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full px-3 py-2 bg-neutral-800 hover:bg-neutral-700 rounded text-sm transition-colors"
        >
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex">
      {/* Desktop Sidebar — always visible at lg+ */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-64 bg-neutral-900 text-white z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      <div
        className={`lg:hidden fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setDrawerOpen(false)}
      />

      {/* Mobile Drawer */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 w-64 bg-neutral-900 text-white z-50 flex flex-col transform transition-transform duration-300 ease-in-out ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Main area (offset by sidebar on desktop) */}
      <div className="flex-1 flex flex-col lg:pl-64">
        {/* Mobile Header */}
        <header className="lg:hidden bg-neutral-900 text-white shadow-lg sticky top-0 z-30">
          <div className="px-4 sm:px-6">
            <div className="flex justify-between items-center h-14">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="p-2 -ml-2 rounded hover:bg-neutral-800"
                  aria-label="Open menu"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <NavLink to="/" className="flex items-center gap-2 text-white">
                  <WhlcMark height={28} />
                  <span className="text-xs uppercase tracking-[0.2em] text-neutral-400 font-display">ATS</span>
                </NavLink>
              </div>

              <div className="flex items-center space-x-3">
                <NotificationBell />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-8">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="bg-neutral-900 text-neutral-500 py-6">
          <div className="px-4 sm:px-6 lg:px-10 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} WHLC Architecture. All rights reserved.</p>
            <p className="mt-1">Baton Rouge, LA | Fairhope, AL | Biloxi, MS</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
