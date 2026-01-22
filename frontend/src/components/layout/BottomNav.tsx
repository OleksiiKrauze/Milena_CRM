import { Link, useLocation } from 'react-router-dom';
import { Home, FolderOpen, Building2, PlusCircle, User } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/store/authStore';
import { hasPermission } from '@/utils/permissions';

interface NavItem {
  path: string;
  label: string;
  icon: typeof Home;
  permission?: string; // Permission required to see this nav item
}

const allNavItems: NavItem[] = [
  { path: '/', label: 'Головна', icon: Home }, // Always visible
  { path: '/cases', label: 'Заявки', icon: FolderOpen, permission: 'cases:read' },
  { path: '/organizations', label: 'Довідник', icon: Building2, permission: 'organizations:read' },
  { path: '/cases/new', label: 'Створити', icon: PlusCircle, permission: 'cases:create' },
  { path: '/profile', label: 'Профіль', icon: User }, // Always visible
];

export function BottomNav() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  // Filter nav items based on user permissions
  const navItems = allNavItems.filter((item) => {
    // Always show items without permission requirement
    if (!item.permission) return true;
    // Check if user has required permission
    return hasPermission(user, item.permission);
  });

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
