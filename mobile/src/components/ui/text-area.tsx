import { useState } from 'react';
import { Text, TextInput, View, type TextInputProps, type TextStyle } from 'react-native';

import { colors } from '@/src/theme/colors';
import { inputBorderStyle } from '@/src/theme/input-styles';

interface TextAreaProps extends TextInputProps {
  label?: string;
  className?: string;
  minHeight?: number;
}

export function TextArea({
  label,
  className,
  minHeight = 96,
  onFocus,
  onBlur,
  style,
  ...props
}: TextAreaProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View className={`mb-3 ${className ?? ''}`}>
      {label ? (
        <Text className="mb-1.5 text-sm font-medium text-muted">{label}</Text>
      ) : null}
      <TextInput
        className="px-3.5 py-3 text-base text-ink"
        placeholderTextColor={colors.muted}
        multiline
        textAlignVertical="top"
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[inputBorderStyle(focused) as TextStyle, { minHeight }, style]}
        {...props}
      />
    </View>
  );
}
