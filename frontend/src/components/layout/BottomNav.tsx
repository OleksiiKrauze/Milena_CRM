import { Link, useLocation } from 'react-router-dom';
import { Home, FolderOpen, PlusCircle, User, Settings } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/store/authStore';

const baseNavItems = [
  { path: '/', label: 'Головна', icon: Home },
  { path: '/cases', label: 'Заявки', icon: FolderOpen },
  { path: '/cases/new', label: 'Створити', icon: PlusCircle },
  { path: '/profile', label: 'Профіль', icon: User },
];

const adminNavItem = { path: '/settings', label: 'Налаштування', icon: Settings };

export function BottomNav() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  // Check if user is admin
  const isAdmin = user?.roles.some((role) => role.name === 'admin');

  // Add admin nav item if user is admin
  const navItems = isAdmin
    ? [...baseNavItems.slice(0, 3), adminNavItem, baseNavItems[3]]
    : baseNavItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom">
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center flex-1 py-2 tap-target',
                'transition-colors duration-200',
                isActive
                  ? 'text-primary-600'
                  : 'text-gray-600 active:text-primary-500'
              )}
            >
              <Icon className="h-6 w-6 mb-1" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
