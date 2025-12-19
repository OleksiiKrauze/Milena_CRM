import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/utils/cn';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  action?: ReactNode;
  className?: string;
}

export function Header({ title, showBack = false, action, className }: HeaderProps) {
  const navigate = useNavigate();

  return (
    <header
      className={cn(
        'sticky top-0 z-40 bg-white border-b border-gray-200 safe-area-top',
        className
      )}
    >
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center flex-1 min-w-0">
          {showBack && (
            <button
              onClick={() => navigate(-1)}
              className="mr-3 tap-target -ml-2 p-2 text-gray-600 hover:text-gray-900 active:text-gray-900"
              aria-label="Назад"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
          )}
          <h1 className="text-lg font-semibold text-gray-900 truncate">
            {title}
          </h1>
        </div>
        {action && <div className="ml-4">{action}</div>}
      </div>
    </header>
  );
}
