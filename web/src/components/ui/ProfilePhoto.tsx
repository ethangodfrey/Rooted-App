import { SafeImage } from './SafeImage';

interface ProfilePhotoProps {
  photoUrl?: string | null;
  initials: string;
  className?: string;
  size?: 'default' | 'small';
}

export function ProfilePhoto({
  photoUrl,
  initials,
  className = '',
  size = 'default',
}: ProfilePhotoProps) {
  const sizeClass = size === 'small' ? 'profile-avatar--small' : '';

  return (
    <SafeImage
      src={photoUrl ?? undefined}
      alt=""
      className={`profile-avatar ${sizeClass} ${className}`.trim()}
      fallback={
        <div
          className={`profile-avatar profile-avatar--placeholder ${sizeClass}`.trim()}
          aria-hidden="true"
        >
          {initials}
        </div>
      }
    />
  );
}
