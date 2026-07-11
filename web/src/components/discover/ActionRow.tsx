import { Link } from 'react-router-dom';

import { TabIcon, type TabIconName } from '@/components/navigation/TabIcon';

type ActionRowProps = {
  to: string;
  icon: TabIconName;
  title: string;
  subtitle: string;
};

export function ActionRow({ to, icon, title, subtitle }: ActionRowProps) {
  return (
    <Link to={to} className="app-action-row">
      <span className="app-action-row__icon" aria-hidden="true">
        <TabIcon name={icon} size={18} color="var(--color-primary)" />
      </span>
      <span className="app-action-row__body">
        <span className="app-action-row__title">{title}</span>
        <span className="app-action-row__subtitle">{subtitle}</span>
      </span>
      <span className="app-action-row__chevron" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}
