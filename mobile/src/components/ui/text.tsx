import { Text as RNText, type TextProps } from 'react-native';

type Variant = 'eyebrow' | 'title' | 'heading' | 'subtitle' | 'body' | 'caption';

const variantClasses: Record<Variant, string> = {
  eyebrow: 'text-sm font-semibold text-accent',
  title: 'text-[28px] font-bold text-ink leading-tight',
  heading: 'text-lg font-semibold text-ink leading-snug',
  subtitle: 'text-base font-normal text-muted leading-6',
  body: 'text-base font-normal text-ink leading-6',
  caption: 'text-sm font-normal text-muted leading-5',
};

interface UITextProps extends TextProps {
  variant?: Variant;
  className?: string;
}

export function Text({ variant = 'body', className, ...props }: UITextProps) {
  return <RNText className={`${variantClasses[variant]} ${className ?? ''}`} {...props} />;
}
