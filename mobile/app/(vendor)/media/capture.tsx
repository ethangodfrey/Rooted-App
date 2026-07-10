import { FontAwesome } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import {
  captureAndUploadVendorMedia,
  type VendorMediaKind,
  type VendorMediaSource,
  type VendorMediaUploadResult,
} from '@/src/lib/vendor-media-upload';

export default function VendorMediaCaptureScreen() {
  const [mediaType, setMediaType] = useState<VendorMediaKind>('image');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('Ready');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<VendorMediaUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(source: VendorMediaSource) {
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const uploaded = await captureAndUploadVendorMedia({
        mediaType,
        source,
        onProgress: (next, label) => {
          setProgress(next);
          setProgressLabel(label);
        },
      });
      if (uploaded) setResult(uploaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  function createPost() {
    if (!result) return;
    router.push({
      pathname: '/(vendor)/posts/new',
      params: {
        mediaUrl: result.publicUrl,
        mediaType: result.mediaType,
      },
    });
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Capture media',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      <Screen scroll>
        <Text variant="eyebrow" className="mb-2">
          Vendor media
        </Text>
        <Text variant="title" className="mb-3">
          Capture for your feed
        </Text>
        <Text variant="caption" className="mb-5">
          Images are downscaled to a web-friendly 1080px width before upload. Videos are
          validated under 50 MB and get a local thumbnail preview.
        </Text>

        <View className="mb-5 flex-row gap-2">
          {(['image', 'video'] as const).map((kind) => (
            <Pressable
              key={kind}
              onPress={() => setMediaType(kind)}
              className={`flex-1 rounded-2xl border p-3 ${
                mediaType === kind ? 'border-primary bg-honeydew' : 'border-subtle bg-white'
              }`}>
              <Text className="text-center font-semibold capitalize">{kind}</Text>
            </Pressable>
          ))}
        </View>

        <View className="mb-5 flex-row gap-3">
          <Button
            label="Camera"
            onPress={() => void run('camera')}
            disabled={uploading}
            className="flex-1"
          />
          <Button
            label="Library"
            variant="secondary"
            onPress={() => void run('library')}
            disabled={uploading}
            className="flex-1"
          />
        </View>

        <Card className="mb-5">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="font-semibold">{progressLabel}</Text>
            <Text variant="caption">{progress}%</Text>
          </View>
          <View className="h-3 overflow-hidden rounded-full bg-stone-100">
            <View className="h-3 rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </View>
        </Card>

        {error ? <Text className="mb-4 text-sm text-danger">{error}</Text> : null}

        {result ? (
          <Card className="gap-3">
            <View className="items-center justify-center rounded-2xl bg-honeydew p-4">
              {result.thumbnailUri ? (
                <Image source={{ uri: result.thumbnailUri }} className="h-44 w-full rounded-xl" />
              ) : (
                <FontAwesome name="check-circle" size={44} color="#228B22" />
              )}
            </View>
            <Text className="font-semibold">Upload complete</Text>
            <Text variant="caption" numberOfLines={2}>
              {result.publicUrl}
            </Text>
            <Button label="Create feed post" onPress={createPost} />
          </Card>
        ) : null}
      </Screen>
    </>
  );
}
