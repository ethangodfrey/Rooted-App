import { FontAwesome } from '@expo/vector-icons';
import { Image, Pressable, View } from 'react-native';

import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { Text } from '@/src/components/ui/text';
import { colors } from '@/src/theme/colors';
import { inputBorderStyle } from '@/src/theme/input-styles';
import { radius } from '@/src/theme/layout';

interface BrandImageFieldProps {
  label: string;
  hint: string;
  imageUrl: string | null;
  variant: 'banner' | 'logo';
  uploading?: boolean;
  onPick: () => void;
  onRemove: () => void;
}

export function BrandImageField({
  label,
  hint,
  imageUrl,
  variant,
  uploading = false,
  onPick,
  onRemove,
}: BrandImageFieldProps) {
  const isBanner = variant === 'banner';

  return (
    <View className="mb-5">
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4 }}>
        {label}
      </Text>
      <Text variant="caption" className="mb-2">
        {hint}
      </Text>

      {imageUrl ? (
        <View>
          <Image
            source={{ uri: imageUrl }}
            style={{
              width: '100%',
              height: isBanner ? 148 : 96,
              borderRadius: radius.card,
              backgroundColor: colors.honeydew,
            }}
            resizeMode="cover"
          />
          <View className="mt-2 flex-row gap-2">
            <Pressable
              onPress={onPick}
              disabled={uploading}
              style={[inputBorderStyle(), { borderRadius: radius.button, paddingHorizontal: 14, paddingVertical: 10 }]}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>Replace</Text>
            </Pressable>
            <Pressable
              onPress={onRemove}
              disabled={uploading}
              style={{ borderRadius: radius.button, paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.muted }}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={onPick}
          disabled={uploading}
          style={[
            inputBorderStyle(),
            {
              height: isBanner ? 148 : 112,
              borderRadius: radius.card,
              alignItems: 'center',
              justifyContent: 'center',
              borderStyle: 'dashed',
            },
          ]}>
          {uploading ? (
            <LoadingIndicator />
          ) : (
            <>
              <FontAwesome name="camera" size={22} color={colors.primary} />
              <Text variant="caption" className="mt-2">
                {isBanner ? 'Add cover banner' : 'Add logo'}
              </Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}
