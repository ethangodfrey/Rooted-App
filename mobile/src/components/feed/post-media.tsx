import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'react-native';

import type { PostMediaType } from '@/src/types/database';

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

interface PostMediaProps {
  mediaUrl: string;
  mediaType?: PostMediaType | null;
  videoThumbnailUrl?: string | null;
  className?: string;
}

function PostVideo({ uri, className }: { uri: string; className?: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });

  return (
    <VideoView
      player={player}
      className={className ?? 'mt-2 h-48 w-full rounded-xl bg-ink'}
      contentFit="cover"
      nativeControls
      allowsFullscreen
    />
  );
}

export function PostMedia({ mediaUrl, mediaType, videoThumbnailUrl, className }: PostMediaProps) {
  if (mediaType === 'video') {
    return <PostVideo uri={mediaUrl} className={className} />;
  }

  return (
    <Image
      source={{ uri: mediaUrl }}
      className={className ?? 'mt-2 h-48 w-full rounded-xl bg-line'}
      resizeMode="cover"
    />
  );
}

export { MAX_VIDEO_BYTES };
