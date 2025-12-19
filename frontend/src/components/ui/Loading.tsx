import type { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface LoadingProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  text?: string;
}

export function Loading({
  className,
  size = 'md',
  fullScreen = false,
  text,
  ...props
}: LoadingProps) {
  const sizes = {
    sm: 'h-6 w-6',
    md: 'h-10 w-10',
    lg: 'h-16 w-16',
  };

  const spinner = (
    <svg
      className={cn('animate-spin text-primary-600', sizes[size])}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );

  if (fullScreen) {
    return (
      <div
        className={cn(
          'fixed inset-0 flex flex-col items-center justify-center bg-white bg-opacity-90 z-50',
          className
        )}
        {...props}
      >
        {spinner}
        {text && <p className="mt-4 text-gray-600">{text}</p>}
      </div>
    );
  }

  return (
    <div
      className={cn('flex flex-col items-center justify-center', className)}
      {...props}
    >
      {spinner}
      {text && <p className="mt-2 text-sm text-gray-600">{text}</p>}
    </div>
  );
}

// Inline loading for buttons and small components
export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin h-4 w-4', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
