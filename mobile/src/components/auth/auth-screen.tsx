import { Link } from 'expo-router';
import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { Logo } from '@/src/components/Logo';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Text } from '@/src/components/ui/text';
import { layoutStyles } from '@/src/theme/layout';

interface AuthScreenProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  submitLabel: string;
  showPassword?: boolean;
  loading?: boolean;
  error?: string | null;
  message?: string | null;
  footer?: ReactNode;
}

export function AuthScreen({
  title,
  subtitle,
  children,
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  submitLabel,
  showPassword = true,
  loading = false,
  error,
  message,
  footer,
}: AuthScreenProps) {
  return (
    <KeyboardAvoidingView
      style={layoutStyles.canvas}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[layoutStyles.screenScrollContent, { justifyContent: 'center' }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={layoutStyles.screenColumn}>
          <Logo variant="primary" size="medium" style={{ marginBottom: 8 }} />
          <Text variant="title" className="mb-2">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="subtitle" className="mb-6">
              {subtitle}
            </Text>
          ) : null}

          <Input
            label="Email"
            value={email}
            onChangeText={onEmailChange}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
          />

          {showPassword ? (
            <Input
              label="Password"
              value={password}
              onChangeText={onPasswordChange}
              secureTextEntry
              autoComplete="password"
              placeholder="••••••••"
            />
          ) : null}

          {children}

          {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}
          {message ? <Text className="mb-3 text-sm text-primary">{message}</Text> : null}

          <View className="mt-2">
            <Button label={submitLabel} loading={loading} onPress={onSubmit} />
          </View>

          {footer}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function AuthLink({
  href,
  children,
}: {
  href: '/(auth)/login' | '/(auth)/signup' | '/(auth)/forgot-password';
  children: ReactNode;
}) {
  return (
    <Link href={href} asChild>
      <Pressable className="mt-4 items-center active:opacity-80">
        <Text className="text-base font-medium text-primary">{children}</Text>
      </Pressable>
    </Link>
  );
}
