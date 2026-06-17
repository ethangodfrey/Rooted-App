import { useState } from 'react';
import { Text, TextInput, View, type TextInputProps, type TextStyle } from 'react-native';

import { colors } from '@/src/theme/colors';
import { inputBorderStyle } from '@/src/theme/input-styles';

interface InputProps extends TextInputProps {
  label?: string;
  className?: string;
}

export function Input({ label, className, onFocus, onBlur, style, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View className={`mb-3 ${className ?? ''}`}>
      {label ? (
        <Text className="mb-1.5 text-sm font-medium text-muted">{label}</Text>
      ) : null}
      <TextInput
        className="px-3.5 py-3 text-base text-ink"
        placeholderTextColor={colors.muted}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[inputBorderStyle(focused) as TextStyle, style]}
        {...props}
      />
    </View>
  );
}
