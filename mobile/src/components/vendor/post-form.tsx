import { FontAwesome } from '@expo/vector-icons';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Switch, View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Chip } from '@/src/components/ui/chip';
import { PostMedia } from '@/src/components/feed/post-media';
import { TextArea } from '@/src/components/ui/text-area';
import { inputBorderStyle } from '@/src/theme/input-styles';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import { formatDateTime } from '@/src/lib/format';
import { POST_TYPES, POST_TYPE_LABEL } from '@/src/lib/post-type';
import { supabase } from '@/src/lib/supabase';
import { pickAndUploadProductImage, pickAndUploadVendorVideo } from '@/src/lib/upload';
import type { PostMediaType, PostType } from '@/src/types/database';

export interface PostFormValues {
  post_type: PostType;
  caption: string;
  media_url: string | null;
  media_type: PostMediaType;
  product_id: string | null;
  event_id: string | null;
  /** ISO string when scheduled for the future; null = publish now / not scheduled. */
  publish_at: string | null;
}

interface PostFormProps {
  initial?: Partial<PostFormValues>;
  /** When set, the form only allows photo or video uploads for that kind. */
  mediaKind?: PostMediaType;
  submitLabel: string;
  onSubmit: (values: PostFormValues) => Promise<void> | void;
  loading?: boolean;
  onDelete?: () => void;
}

interface LinkOption {
  id: string;
  label: string;
}

const MIN_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MIN_MS;

function oneHourFromNow(): Date {
  return new Date(Date.now() + 60 * MIN_MS);
}

function Stepper({
  label,
  onMinus,
  onPlus,
}: {
  label: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <Pressable
        onPress={onMinus}
        className="h-9 w-9 items-center justify-center rounded-full bg-honeydew"
        accessibilityLabel={`Decrease ${label}`}>
        <FontAwesome name="minus" size={12} color="#228B22" />
      </Pressable>
      <Text variant="caption" className="w-10 text-center">
        {label}
      </Text>
      <Pressable
        onPress={onPlus}
        className="h-9 w-9 items-center justify-center rounded-full bg-honeydew"
        accessibilityLabel={`Increase ${label}`}>
        <FontAwesome name="plus" size={12} color="#228B22" />
      </Pressable>
    </View>
  );
}

export function PostForm({
  initial,
  mediaKind = 'image',
  submitLabel,
  onSubmit,
  loading = false,
  onDelete,
}: PostFormProps) {
  const { user, vendor } = useAuth();
  const initialScheduled =
    !!initial?.publish_at && new Date(initial.publish_at).getTime() > Date.now();

  const [postType, setPostType] = useState<PostType>(initial?.post_type ?? 'announcement');
  const [caption, setCaption] = useState(initial?.caption ?? '');
  const [mediaUrl, setMediaUrl] = useState<string | null>(initial?.media_url ?? null);
  const [productId, setProductId] = useState<string | null>(initial?.product_id ?? null);
  const [eventId, setEventId] = useState<string | null>(initial?.event_id ?? null);
  const [products, setProducts] = useState<LinkOption[]>([]);
  const [events, setEvents] = useState<LinkOption[]>([]);
  const [scheduleEnabled, setScheduleEnabled] = useState(initialScheduled);
  const [scheduledFor, setScheduledFor] = useState<Date>(
    initialScheduled ? new Date(initial!.publish_at!) : oneHourFromNow(),
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function shiftSchedule(deltaMs: number) {
    setScheduledFor((prev) => new Date(prev.getTime() + deltaMs));
  }

  useEffect(() => {
    let active = true;
    async function load() {
      if (!vendor) return;
      const [productsRes, eventsRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, name')
          .eq('vendor_id', vendor.id)
          .eq('status', 'active'),
        supabase.from('vendor_events').select('event:events(id, name)').eq('vendor_id', vendor.id),
      ]);
      if (!active) return;
      setProducts(
        ((productsRes.data as { id: string; name: string }[]) ?? []).map((p) => ({
          id: p.id,
          label: p.name,
        })),
      );
      const evRows =
        (eventsRes.data as unknown as { event: { id: string; name: string } | null }[]) ?? [];
      setEvents(
        evRows.filter((r) => r.event).map((r) => ({ id: r.event!.id, label: r.event!.name })),
      );
    }
    load();
    return () => {
      active = false;
    };
  }, [vendor]);

  async function handleAddPhoto() {
    if (!user) return;
    setError(null);
    setUploading(true);
    try {
      const url = await pickAndUploadProductImage(user.id);
      if (url) setMediaUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload photo.');
    } finally {
      setUploading(false);
    }
  }

  async function handleAddVideo() {
    if (!user) return;
    setError(null);
    setUploading(true);
    try {
      const url = await pickAndUploadVendorVideo(user.id);
      if (url) setMediaUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload video.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!caption.trim()) {
      setError('Write a caption for your post.');
      return;
    }
    if (mediaKind === 'video' && !mediaUrl) {
      setError('Add a video for this post.');
      return;
    }
    let publishAt: string | null = null;
    if (scheduleEnabled) {
      if (scheduledFor.getTime() <= Date.now()) {
        setError('Pick a future date and time to schedule this post.');
        return;
      }
      publishAt = scheduledFor.toISOString();
    }
    setError(null);
    await onSubmit({
      post_type: postType,
      caption: caption.trim(),
      media_url: mediaUrl,
      media_type: mediaKind,
      product_id: productId,
      event_id: eventId,
      publish_at: publishAt,
    });
  }

  return (
    <View>
      <Text className="mb-1.5 text-sm font-semibold text-ink">Type</Text>
      <View className="mb-5 flex-row flex-wrap gap-2">
        {POST_TYPES.map((type) => (
          <Chip
            key={type}
            label={POST_TYPE_LABEL[type]}
            selected={postType === type}
            onPress={() => setPostType(type)}
          />
        ))}
      </View>

      <TextArea
        label="Caption"
        className="mb-5"
        value={caption}
        onChangeText={setCaption}
        placeholder={
          mediaKind === 'video'
            ? 'Describe your video — product demo, market day, behind the scenes...'
            : 'Share a promotion, launch, restock, or update...'
        }
        minHeight={112}
      />

      {mediaKind === 'video' ? (
        <>
          <Text className="mb-1.5 text-sm font-semibold text-ink">Video</Text>
          <View className="mb-5">
            {mediaUrl ? (
              <View className="relative w-full self-start">
                <PostMedia mediaUrl={mediaUrl} mediaType="video" className="h-40 w-full rounded-xl bg-ink" />
                <Pressable
                  onPress={() => setMediaUrl(null)}
                  className="absolute -right-2 -top-2 h-7 w-7 items-center justify-center rounded-full bg-ink"
                  accessibilityLabel="Remove video">
                  <FontAwesome name="times" size={13} color="#ffffff" />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={handleAddVideo}
                disabled={uploading}
                className="h-28 items-center justify-center rounded-xl border border-dashed border-subtle bg-white">
                {uploading ? (
                  <LoadingIndicator />
                ) : (
                  <>
                    <FontAwesome name="video-camera" size={20} color="#228B22" />
                    <Text variant="caption" className="mt-2">
                      Add a video (up to 90 sec)
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        </>
      ) : (
        <>
          <Text className="mb-1.5 text-sm font-semibold text-ink">Photo (optional)</Text>
          <View className="mb-5">
            {mediaUrl ? (
              <View className="relative self-start">
                <Image source={{ uri: mediaUrl }} className="h-40 w-full rounded-xl bg-line" />
                <Pressable
                  onPress={() => setMediaUrl(null)}
                  className="absolute -right-2 -top-2 h-7 w-7 items-center justify-center rounded-full bg-ink"
                  accessibilityLabel="Remove photo">
                  <FontAwesome name="times" size={13} color="#ffffff" />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={handleAddPhoto}
                disabled={uploading}
                className="h-28 items-center justify-center rounded-xl border border-dashed border-subtle bg-white">
                {uploading ? (
                  <LoadingIndicator />
                ) : (
                  <>
                    <FontAwesome name="camera" size={20} color="#228B22" />
                    <Text variant="caption" className="mt-2">
                      Add a photo
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        </>
      )}

      {products.length > 0 ? (
        <>
          <Text className="mb-1.5 text-sm font-semibold text-ink">Link a product (optional)</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-5"
            contentContainerClassName="gap-2">
            <Chip label="None" selected={productId === null} onPress={() => setProductId(null)} />
            {products.map((p) => (
              <Chip
                key={p.id}
                label={p.label}
                selected={productId === p.id}
                onPress={() => setProductId(p.id)}
              />
            ))}
          </ScrollView>
        </>
      ) : null}

      {events.length > 0 ? (
        <>
          <Text className="mb-1.5 text-sm font-semibold text-ink">Link an event (optional)</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-5"
            contentContainerClassName="gap-2">
            <Chip label="None" selected={eventId === null} onPress={() => setEventId(null)} />
            {events.map((e) => (
              <Chip
                key={e.id}
                label={e.label}
                selected={eventId === e.id}
                onPress={() => setEventId(e.id)}
              />
            ))}
          </ScrollView>
        </>
      ) : null}

      <View className="mb-5 px-3.5 py-3" style={inputBorderStyle()}>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text variant="body" className="font-semibold">
              Schedule for later
            </Text>
            <Text variant="caption" className="mt-0.5">
              Choose when this post goes live for followers.
            </Text>
          </View>
          <Switch
            value={scheduleEnabled}
            onValueChange={setScheduleEnabled}
            trackColor={{ true: '#228B22', false: '#E5E7EB' }}
            thumbColor="#ffffff"
          />
        </View>

        {scheduleEnabled ? (
          <View className="mt-4 border-t border-honeydew pt-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Stepper label="Day" onMinus={() => shiftSchedule(-DAY_MS)} onPlus={() => shiftSchedule(DAY_MS)} />
              <Text variant="body" className="font-semibold">
                {scheduledFor.toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Stepper
                label="Time"
                onMinus={() => shiftSchedule(-30 * MIN_MS)}
                onPlus={() => shiftSchedule(30 * MIN_MS)}
              />
              <Text variant="body" className="font-semibold">
                {scheduledFor.toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <Text variant="caption" className="mt-3">
              Goes live {formatDateTime(scheduledFor.toISOString())}
            </Text>
          </View>
        ) : null}
      </View>

      {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}

      <Button label={submitLabel} loading={loading} onPress={handleSubmit} />

      {onDelete ? (
        <View className="mt-3">
          <Button label="Delete post" variant="ghost" onPress={onDelete} />
        </View>
      ) : null}
    </View>
  );
}
