import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { WhlcMark, WhlcWordmark } from './WhlcLogo';
import NotificationBell from './NotificationBell';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
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

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-64 bg-black text-white">
        {/* Logo */}
        <div className="px-6 py-6 border-b border-gray-800">
          <NavLink to="/" className="flex items-center gap-3 text-white">
            <WhlcMark height={36} />
            <WhlcWordmark height={18} />
          </NavLink>
          <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mt-1.5 block">Applicant Tracking</span>
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
                    ? 'bg-white text-black'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User + Logout at bottom */}
        <div className="px-5 py-5 border-t border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <NotificationBell />
          </div>
          <div className="mb-3">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 capitalize">{user?.role?.replace('_', ' ')}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main area (offset by sidebar on desktop) */}
      <div className="flex-1 flex flex-col lg:pl-64">
        {/* Mobile Header */}
        <header className="lg:hidden bg-black text-white shadow-lg">
          <div className="px-4 sm:px-6">
            <div className="flex justify-between items-center h-14">
              <NavLink to="/" className="flex items-center gap-2.5 text-white">
                <WhlcMark height={28} />
                <div className="hidden sm:flex items-center gap-2.5">
                  <WhlcWordmark height={14} />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400 border-l border-gray-600 pl-2.5">ATS</span>
                </div>
              </NavLink>

              <div className="flex items-center space-x-3">
                <NotificationBell />
                <button
                  onClick={handleLogout}
                  className="hidden sm:block px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm transition-colors"
                >
                  Logout
                </button>
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-2 rounded hover:bg-gray-800"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {mobileMenuOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Navigation Dropdown */}
          {mobileMenuOpen && (
            <nav className="border-t border-gray-800 px-4 py-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `block px-4 py-2 rounded text-sm font-medium font-display uppercase tracking-wider ${
                      isActive
                        ? 'bg-white text-black'
                        : 'text-gray-300 hover:bg-gray-800'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <button
                onClick={handleLogout}
                className="sm:hidden block w-full text-left px-4 py-2 rounded text-sm font-medium font-display uppercase tracking-wider text-gray-300 hover:bg-gray-800"
              >
                Logout
              </button>
            </nav>
          )}
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-8">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="bg-black text-gray-500 py-6">
          <div className="px-4 sm:px-6 lg:px-10 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} WHLC Architecture. All rights reserved.</p>
            <p className="mt-1">Baton Rouge, LA | Fairhope, AL | Biloxi, MS</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
