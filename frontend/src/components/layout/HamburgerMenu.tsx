import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu, X, Home, FolderOpen, Building2, PlusCircle, User,
  Phone, PhoneCall, Settings,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/store/authStore';
import { hasPermission } from '@/utils/permissions';

interface MenuItem {
  path: string;
  label: string;
  icon: typeof Home;
  permission?: string;
}

const mainItems: MenuItem[] = [
  { path: '/', label: 'Головна', icon: Home },
  { path: '/cases', label: 'Заявки', icon: FolderOpen, permission: 'cases:read' },
  { path: '/organizations', label: 'Довідник', icon: Building2, permission: 'organizations:read' },
  { path: '/cases/new', label: 'Створити заявку', icon: PlusCircle, permission: 'cases:create' },
  { path: '/profile', label: 'Профіль', icon: User },
  { path: '/settings', label: 'Налаштування', icon: Settings, permission: 'settings:read' },
];

const telephonyItems: MenuItem[] = [
  { path: '/telephony/recordings', label: 'Записи розмов', icon: PhoneCall, permission: 'ip_atc:read' },
];

export function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const user = useAuthStore(state => state.user);

  // Close on route change
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const visibleMain = mainItems.filter(i => !i.permission || hasPermission(user, i.permission));
  const visibleTelephony = telephonyItems.filter(i => !i.permission || hasPermission(user, i.permission));

  return (
    <>
      {/* Toggle button — fixed top-right */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed top-3 right-4 z-50 p-2 rounded-lg bg-white shadow-md border border-gray-200 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
        aria-label="Меню"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 right-0 z-40 h-full w-72 bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Phone className="h-5 w-5 text-white" />
          </div>
          <span className="font-semibold text-gray-900 text-lg">Меню</span>
        </div>

        <div className="flex-1 overflow-y-auto py-3">

          {/* Main navigation */}
          <div className="px-3 mb-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">
              Навігація
            </p>
            {visibleMain.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 transition-colors',
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <Icon className={cn('h-5 w-5', isActive ? 'text-blue-600' : 'text-gray-500')} />
                  <span className="font-medium text-sm">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Telephony section */}
          {visibleTelephony.length > 0 && (
            <div className="px-3 mt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">
                Телефонія
              </p>
              {visibleTelephony.map(item => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith('/telephony');
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 transition-colors',
                      isActive
                        ? 'bg-violet-50 text-violet-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    <Icon className={cn('h-5 w-5', isActive ? 'text-violet-600' : 'text-gray-500')} />
                    <span className="font-medium text-sm">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
