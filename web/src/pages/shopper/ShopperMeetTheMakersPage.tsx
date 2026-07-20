import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { FallbackImage } from '@/components/ui/FallbackImage';
import { useAuth } from '@/hooks/use-auth';
import { useUserCoords } from '@/hooks/use-user-coords';
import { isApiConfigured } from '@/lib/api';
import { marketPath, vendorPath } from '@/lib/market-routes';
import {
  fetchMeetTheMakersFeed,
  rsvpToMakerEvent,
  type MakerFeedItem,
} from '@/lib/meet-the-makers';
import '@/components/ui/ui.css';
import '@/components/makers/meet-the-makers.css';

export function ShopperMeetTheMakersPage() {
  const { user, shopper } = useAuth();
  const { coords } = useUserCoords();
  const [items, setItems] = useState<MakerFeedItem[]>([]);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rsvpBusy, setRsvpBusy] = useState<string | null>(null);
  const [rsvpDone, setRsvpDone] = useState<Set<string>>(() => new Set());

  const categoriesKey = useMemo(
    () => (shopper?.interests ?? user?.shopper_interests ?? []).join('|'),
    [shopper?.interests, user?.shopper_interests],
  );
  const categories = useMemo(
    () => (categoriesKey ? categoriesKey.split('|').filter(Boolean) : []),
    [categoriesKey],
  );

  const load = useCallback(async () => {
    if (!isApiConfigured) {
      setError('API is not configured.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const feed = await fetchMeetTheMakersFeed({
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        categories,
        limit: 40,
      });
      setItems(feed.ITEMS ?? []);
      setRadiusKm(feed.ALERT_RADIUS_KM ?? null);
      console.log(
        `PARTNERSHIP_FEED_SYNCED COUNT=${feed.COUNT} ALERT_RADIUS_KM=${feed.ALERT_RADIUS_KM}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load makers feed.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [coords?.latitude, coords?.longitude, categories]);

  useEffect(() => {
    console.log('DISCOVERY_INTERFACE_INITIALIZED SURFACE=MEET_THE_MAKERS');
    void load();
  }, [load]);

  async function handleRsvp(item: MakerFeedItem) {
    if (!item.eventId) return;
    setRsvpBusy(item.postId);
    try {
      await rsvpToMakerEvent({ eventId: item.eventId, postId: item.postId });
      setRsvpDone((prev) => new Set(prev).add(item.eventId!));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'RSVP failed.');
    } finally {
      setRsvpBusy(null);
    }
  }

  return (
    <div className="app-screen app-screen--narrow meet-makers">
      <header className="meet-makers__header">
        <p className="app-eyebrow">Discovery</p>
        <h1 className="meet-makers__title">Meet the Makers</h1>
        <p className="meet-makers__lede">
          Farmer and vendor partnerships near you
          {radiusKm != null ? ` · ${radiusKm} km alert radius` : ''}.
        </p>
        <Link to="/shopper/explore" className="app-back-link">
          Back to explore
        </Link>
      </header>

      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : error ? (
        <p className="app-error">{error}</p>
      ) : items.length === 0 ? (
        <p className="app-row-meta">No active partnership posts in range yet.</p>
      ) : (
        <ul className="meet-makers__list">
          {items.map((item) => {
            const media = item.cdnMediaUrl || item.mediaUrl;
            const rsvpd = item.eventId ? rsvpDone.has(item.eventId) : false;
            return (
              <li key={item.postId} className="meet-makers__card">
                {media ? (
                  <FallbackImage
                    src={media}
                    variant="banner"
                    alt=""
                    className="meet-makers__media"
                  />
                ) : null}
                <div className="meet-makers__body">
                  <p className="meet-makers__partners">
                    {[item.vendorName, item.partnerName].filter(Boolean).join(' · ') ||
                      'Partnership'}
                  </p>
                  <p className="meet-makers__caption">{item.caption}</p>
                  <p className="meet-makers__meta">
                    {item.distanceKm != null
                      ? `${item.distanceKm.toFixed(1)} km`
                      : 'Distance unknown'}
                    {item.preferredCategoryHits.length > 0
                      ? ` · ${item.preferredCategoryHits.join(', ')}`
                      : ''}
                  </p>
                  <div className="meet-makers__actions">
                    <Link to={vendorPath(item.vendorId)} className="meet-makers__link">
                      View maker
                    </Link>
                    {item.eventId ? (
                      <>
                        <Link
                          to={marketPath(item.eventId)}
                          className="meet-makers__link"
                        >
                          Market
                        </Link>
                        <button
                          type="button"
                          className="meet-makers__rsvp"
                          disabled={rsvpBusy === item.postId || rsvpd}
                          onClick={() => void handleRsvp(item)}
                        >
                          {rsvpd
                            ? 'RSVP saved'
                            : rsvpBusy === item.postId
                              ? 'Saving…'
                              : 'RSVP'}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
