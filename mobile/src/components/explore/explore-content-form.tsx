import { FontAwesome } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Chip } from '@/src/components/ui/chip';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { TextArea } from '@/src/components/ui/text-area';
import { Text } from '@/src/components/ui/text';
import { useAuth } from '@/src/hooks/use-auth';
import {
  EXPLORE_CONTENT_TYPES,
  EXPLORE_CONTENT_TYPE_LABEL,
  type ExploreContentInput,
} from '@/src/lib/explore-content';
import { pickAndUploadProductImage } from '@/src/lib/upload';
import type { ExploreContentType } from '@/src/types/database';

const MAX_IMAGES = 6;
const inputClass = 'rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-ink';

export interface LinkOption {
  id: string;
  label: string;
}

interface ExploreContentFormProps {
  creatorKind: 'vendor' | 'chef';
  /** Vendor products or chef services that can be linked to the post. */
  linkOptions?: LinkOption[];
  linkLabel?: string;
  submitLabel: string;
  loading?: boolean;
  onSubmit: (input: ExploreContentInput) => Promise<void> | void;
}

function parseTags(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0),
    ),
  ).slice(0, 8);
}

export function ExploreContentForm({
  creatorKind,
  linkOptions = [],
  linkLabel,
  submitLabel,
  loading = false,
  onSubmit,
}: ExploreContentFormProps) {
  const { user } = useAuth();
  const [contentType, setContentType] = useState<ExploreContentType>(
    creatorKind === 'chef' ? 'portfolio' : 'menu_highlight',
  );
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [linkedId, setLinkedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAddImage() {
    if (!user) return;
    if (mediaUrls.length >= MAX_IMAGES) {
      setError(`You can add up to ${MAX_IMAGES} photos.`);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const url = await pickAndUploadProductImage(user.id);
      if (url) setMediaUrls((current) => [...current, url]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload photo.');
    } finally {
      setUploading(false);
    }
  }

  function removeImage(url: string) {
    setMediaUrls((current) => current.filter((item) => item !== url));
  }

  async function handleSubmit() {
    if (mediaUrls.length === 0) {
      setError('Add at least one photo to your post.');
      return;
    }
    if (!caption.trim() && !title.trim()) {
      setError('Add a title or caption so shoppers know what this is.');
      return;
    }
    setError(null);
    await onSubmit({
      content_type: contentType,
      title: title.trim() || null,
      caption: caption.trim() || null,
      media_urls: mediaUrls,
      tags: parseTags(tagsInput),
      linked_product_id: creatorKind === 'vendor' ? linkedId : null,
      linked_service_id: creatorKind === 'chef' ? linkedId : null,
    });
  }

  return (
    <View>
      <Text className="mb-1.5 text-sm font-semibold text-ink">Type</Text>
      <View className="mb-5 flex-row flex-wrap gap-2">
        {EXPLORE_CONTENT_TYPES.map((type) => (
          <Chip
            key={type}
            label={EXPLORE_CONTENT_TYPE_LABEL[type]}
            selected={contentType === type}
            onPress={() => setContentType(type)}
          />
        ))}
      </View>

      <Text className="mb-1.5 text-sm font-semibold text-ink">Photos</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-5"
        contentContainerClassName="gap-3">
        {mediaUrls.map((url) => (
          <View key={url} className="relative">
            <Image source={{ uri: url }} className="h-28 w-28 rounded-xl bg-line" />
            <Pressable
              onPress={() => removeImage(url)}
              className="absolute -right-2 -top-2 h-7 w-7 items-center justify-center rounded-full bg-ink"
              accessibilityLabel="Remove photo">
              <FontAwesome name="times" size={13} color="#ffffff" />
            </Pressable>
          </View>
        ))}
        {mediaUrls.length < MAX_IMAGES ? (
          <Pressable
            onPress={handleAddImage}
            disabled={uploading}
            className="h-28 w-28 items-center justify-center rounded-xl border border-dashed border-subtle bg-white">
            {uploading ? (
              <LoadingIndicator />
            ) : (
              <>
                <FontAwesome name="camera" size={20} color="#228B22" />
                <Text variant="caption" className="mt-2">
                  Add photo
                </Text>
              </>
            )}
          </Pressable>
        ) : null}
      </ScrollView>

      <Text className="mb-1.5 text-sm font-semibold text-ink">Title (optional)</Text>
      <TextInput
        className={`mb-5 ${inputClass}`}
        placeholder="Give your post a short title"
        value={title}
        onChangeText={setTitle}
      />

      <TextArea
        label="Caption"
        className="mb-5"
        value={caption}
        onChangeText={setCaption}
        placeholder={
          creatorKind === 'chef'
            ? 'Describe the dish, event, or technique...'
            : 'Share what makes this special...'
        }
        minHeight={112}
      />

      <Text className="mb-1.5 text-sm font-semibold text-ink">Tags (optional)</Text>
      <TextInput
        className={`mb-1 ${inputClass}`}
        placeholder="e.g. vegan, sourdough, catering"
        autoCapitalize="none"
        value={tagsInput}
        onChangeText={setTagsInput}
      />
      <Text variant="caption" className="mb-5">
        Separate tags with commas. Up to 8.
      </Text>

      {linkOptions.length > 0 ? (
        <>
          <Text className="mb-1.5 text-sm font-semibold text-ink">
            {linkLabel ?? 'Link an item (optional)'}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-5"
            contentContainerClassName="gap-2">
            <Chip label="None" selected={linkedId === null} onPress={() => setLinkedId(null)} />
            {linkOptions.map((option) => (
              <Chip
                key={option.id}
                label={option.label}
                selected={linkedId === option.id}
                onPress={() => setLinkedId(option.id)}
              />
            ))}
          </ScrollView>
        </>
      ) : null}

      {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}

      <Button label={submitLabel} loading={loading} onPress={handleSubmit} />
    </View>
  );
}
