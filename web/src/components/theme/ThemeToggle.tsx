import { useTheme } from '@/providers/theme-provider';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isNight = theme === 'night';

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={isNight ? 'Switch to day mode' : 'Switch to night mode'}
      title={isNight ? 'Day mode' : 'Night mode'}
    >
      <span className="theme-toggle__icon" aria-hidden="true">
        {isNight ? '☀' : '☾'}
      </span>
      <span className="theme-toggle__label">{isNight ? 'Day' : 'Night'}</span>
    </button>
  );
}
