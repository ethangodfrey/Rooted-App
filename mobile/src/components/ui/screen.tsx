import { KeyboardAvoidingView, Platform, ScrollView, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layoutStyles } from '@/src/theme/layout';

interface ScreenProps extends ViewProps {
  scroll?: boolean;
  centered?: boolean;
  /** Full-bleed layout (maps). Default applies side gutters. */
  wide?: boolean;
  className?: string;
  contentClassName?: string;
}

export function Screen({
  scroll = false,
  centered = false,
  wide = false,
  className,
  contentClassName,
  children,
  style,
  ...props
}: ScreenProps) {
  const gutterStyle = wide ? { flex: 1, paddingTop: 16 } : layoutStyles.screenGutter;

  if (scroll) {
    return (
      <SafeAreaView style={layoutStyles.canvas} edges={['top']} className={className}>
        <KeyboardAvoidingView
          style={layoutStyles.canvas}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={layoutStyles.canvas}
            contentContainerStyle={[
              layoutStyles.screenScrollContent,
              centered ? { justifyContent: 'center' } : null,
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}>
            <View style={layoutStyles.screenColumn} className={contentClassName}>
              {children}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={layoutStyles.canvas} edges={['top']} className={className}>
      <View
        style={[gutterStyle, centered ? { justifyContent: 'center' } : null, style]}
        className={contentClassName}
        {...props}>
        {children}
      </View>
    </SafeAreaView>
  );
}
