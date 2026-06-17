import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Pressable } from 'react-native';

import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { colors } from '@/src/theme/colors';

interface BackButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function BackButton({ onPress, loading = false, disabled = false }: BackButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`mb-4 h-10 w-10 items-center justify-center rounded-full active:bg-honeydew ${
        isDisabled ? 'opacity-50' : ''
      }`}
      accessibilityRole="button"
      accessibilityLabel="Back">
      {loading ? (
        <LoadingIndicator size="small" />
      ) : (
        <FontAwesome name="chevron-left" size={20} color={colors.primary} />
      )}
    </Pressable>
  );
}
