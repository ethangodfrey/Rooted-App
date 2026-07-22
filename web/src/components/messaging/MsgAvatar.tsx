import { FallbackImage } from '@/components/ui/FallbackImage';

interface MsgAvatarProps {
  src?: string | null;
  label: string;
  size?: number;
  variant?: 'vendor-logo' | 'avatar';
}

/** Messaging thread avatar with graceful fallback when image is null or fails to load. */
export function MsgAvatar({ src, label, size = 48, variant = 'avatar' }: MsgAvatarProps) {
  const sizeStyle = { width: size, height: size };

  return (
    <FallbackImage
      src={src}
      alt=""
      variant={variant}
      label={label}
      className="msg-avatar"
      style={sizeStyle}
    />
  );
}
