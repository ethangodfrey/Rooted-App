import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { colors } from '@/src/theme/colors';
import { floatingShadow, radius } from '@/src/theme/layout';
import { inputBorderStyle } from '@/src/theme/input-styles';

interface MapFloatingSearchProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear?: () => void;
  resultCount?: number;
}

export function MapFloatingSearch({
  value,
  onChangeText,
  onClear,
  resultCount,
}: MapFloatingSearchProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        inputBorderStyle(focused),
        floatingShadow,
        {
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: radius.pill,
          paddingHorizontal: 16,
          paddingVertical: 4,
          minHeight: 48,
        },
      ]}>
      <FontAwesome name="search" size={16} color={colors.sage} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search by ZIP, city, or market name"
        placeholderTextColor={colors.muted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          flex: 1,
          marginLeft: 10,
          fontSize: 16,
          color: colors.text,
          paddingVertical: 10,
        }}
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <Pressable onPress={onClear} hitSlop={8} accessibilityLabel="Clear search">
          <FontAwesome name="times-circle" size={18} color={colors.sage} />
        </Pressable>
      ) : resultCount != null ? (
        <View
          style={{
            marginLeft: 8,
            borderLeftWidth: 1,
            borderLeftColor: '#E5E7EB',
            paddingLeft: 12,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
          <FontAwesome name="sliders" size={16} color={colors.primary} />
          {resultCount > 0 ? (
            <View
              style={{
                marginLeft: 6,
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
              }}>
              <Text style={{ color: colors.white, fontSize: 10, fontWeight: '700' }}>
                {resultCount > 9 ? '9+' : resultCount}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
