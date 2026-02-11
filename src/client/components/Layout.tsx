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

  const navItems = [
    { to: '/', label: 'Dashboard' },
    { to: '/jobs', label: 'Jobs' },
    { to: '/applicants', label: 'Applicants' },
    { to: '/events', label: 'Events' },
    ...(user?.role === 'admin' || user?.role === 'hiring_manager'
      ? [{ to: '/email-settings', label: 'Settings' }]
      : []),
    ...(user?.role === 'admin' ? [{ to: '/offices', label: 'Offices' }] : []),
    ...(user?.role === 'admin' ? [{ to: '/users', label: 'Users' }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-black text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <NavLink to="/" className="flex items-center gap-2.5 text-white">
                <WhlcMark height={32} />
                <div className="hidden sm:flex items-center gap-2.5">
                  <WhlcWordmark height={16} />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400 border-l border-gray-600 pl-2.5">ATS</span>
                </div>
              </NavLink>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `px-4 py-2 rounded text-sm font-medium font-display uppercase tracking-wider transition-colors ${
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

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              <NotificationBell />
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-gray-400 capitalize">{user?.role?.replace('_', ' ')}</p>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm transition-colors"
              >
                Logout
              </button>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded hover:bg-gray-800"
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

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-gray-800 px-4 py-2">
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
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-black text-gray-500 py-6 sticky bottom-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} WHLC Architecture. All rights reserved.</p>
          <p className="mt-1">Baton Rouge, LA | Fairhope, AL | Biloxi, MS</p>
        </div>
      </footer>
    </div>
  );
}
