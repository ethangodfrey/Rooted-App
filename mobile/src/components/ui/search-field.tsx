import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { colors } from '@/src/theme/colors';
import { floatingShadow, radius } from '@/src/theme/layout';
import { inputBorderStyle } from '@/src/theme/input-styles';

interface SearchFieldProps extends Omit<TextInputProps, 'style'> {
  value: string;
  onChangeText: (text: string) => void;
  onClear?: () => void;
  floating?: boolean;
  className?: string;
}

export function SearchField({
  value,
  onChangeText,
  onClear,
  floating = false,
  placeholder = 'Search',
  className,
  onFocus,
  onBlur,
  ...props
}: SearchFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View
      className={className}
      style={[
        inputBorderStyle(focused),
        floating ? floatingShadow : undefined,
        {
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: floating ? radius.pill : undefined,
          paddingHorizontal: 14,
          minHeight: 48,
        },
      ]}>
      <FontAwesome name="search" size={16} color={colors.sage} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={{
          flex: 1,
          marginLeft: 10,
          fontSize: 16,
          color: colors.text,
          paddingVertical: 10,
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        autoCorrect={false}
        returnKeyType="search"
        {...props}
      />
      {value.length > 0 && onClear ? (
        <Pressable onPress={onClear} hitSlop={8} accessibilityLabel="Clear search">
          <FontAwesome name="times-circle" size={18} color={colors.sage} />
        </Pressable>
      ) : null}
    </View>
  );
}
