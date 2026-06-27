import { ExploreShowcaseManager } from '@/components/explore/ExploreShowcaseManager';
import { useAuth } from '@/hooks/use-auth';
import '@/components/ui/ui.css';

export function ChefPortfolioPage() {
  const { user, chef } = useAuth();

  return (
    <div className="app-screen">
      <p className="app-eyebrow">Portfolio</p>
      <h1 className="app-title">Showcase your work</h1>
      <p className="app-subtitle">
        Publish dishes, past events, and behind-the-scenes to the customer Explore feed.
      </p>

      {user?.id && chef?.id ? (
        <ExploreShowcaseManager
          creator={{ creatorType: 'chef', chefId: chef.id }}
          uploaderUserId={user.id}
        />
      ) : (
        <p className="app-row-meta">Complete your chef profile to publish showcase posts.</p>
      )}
    </div>
  );
}
