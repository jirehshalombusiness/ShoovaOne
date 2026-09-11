import { useState } from 'react';
import { cn } from '@/lib/utils';

interface AvatarProps {
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  rounded?: 'full' | 'md';
}

const sizeMap = {
  xs: { container: 'w-6 h-6', text: 'text-[9px]' },
  sm: { container: 'w-7 h-7', text: 'text-[10px]' },
  md: { container: 'w-9 h-9', text: 'text-xs' },
  lg: { container: 'w-12 h-12', text: 'text-sm' },
  xl: { container: 'w-16 h-16', text: 'text-lg' },
  '2xl': { container: 'w-20 h-20', text: 'text-2xl' },
};

export function Avatar({
  firstName,
  lastName,
  imageUrl,
  size = 'md',
  className,
  rounded = 'full',
}: AvatarProps) {
  const [failed, setFailed] = useState(false);

  const initials =
    `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?';
  const showImage = imageUrl && !failed;
  const s = sizeMap[size];

  return (
    <div
      className={cn(
        'flex items-center justify-center flex-shrink-0 overflow-hidden select-none',
        rounded === 'full' ? 'rounded-full' : 'rounded-md',
        'bg-primary/10 text-primary font-semibold',
        s.container,
        s.text,
        className
      )}
      title={firstName && lastName ? `${firstName} ${lastName}` : undefined}
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt={`${firstName ?? ''} ${lastName ?? ''}`.trim() || 'Avatar'}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}