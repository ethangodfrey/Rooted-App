import { FontAwesome } from '@expo/vector-icons';
import { rootedStackScreenOptions } from '@/src/components/navigation/rooted-stack-options';
import { LoadingIndicator } from '@/src/components/ui/loading-indicator';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Card, PressableCard } from '@/src/components/ui/card';
import { EventStatusBadge } from '@/src/components/events/event-status-badge';
import { EventThumb } from '@/src/components/events/event-thumb';
import { MarketLinks } from '@/src/components/events/market-links';
import { Screen } from '@/src/components/ui/screen';
import { Text } from '@/src/components/ui/text';
import { formatEventFullDate, formatEventTimeRange } from '@/src/lib/format';
import { extraInfoWithoutSocialLinks } from '@/src/lib/market-links';
import {
  getFeaturedVendorCategories,
  getShopperTips,
  hasMarketGuide,
} from '@/src/lib/market-guide';
import { supabase } from '@/src/lib/supabase';
import type { Event } from '@/src/types/database';

interface AttendingVendor {
  id: string;
  business_name: string | null;
  category: string | null;
}

function formatMarketType(value: string | null): string | null {
  if (!value) return null;
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  value: string;
}) {
  return (
    <View className="mb-4 flex-row">
      <View className="mt-0.5 w-7">
        <FontAwesome name={icon} size={16} color="#228B22" />
      </View>
      <View className="flex-1">
        <Text variant="caption" className="mb-0.5">
          {label}
        </Text>
        <Text variant="body">{value}</Text>
      </View>
    </View>
  );
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [vendors, setVendors] = useState<AttendingVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const [eventRes, vendorRes] = await Promise.all([
        supabase.from('events').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('vendor_events')
          .select('vendors!inner(id, business_name, category, approval_status)')
          .eq('event_id', id)
          .eq('participation_status', 'approved'),
      ]);

      if (!active) return;
      if (eventRes.error) {
        setError(eventRes.error.message);
      } else if (!eventRes.data) {
        setError('Event not found.');
      } else {
        setEvent(eventRes.data);
      }

      if (!vendorRes.error && vendorRes.data) {
        const list = vendorRes.data
          .map((row) => {
            const vendor = (row as { vendors: AttendingVendor | AttendingVendor[] }).vendors;
            return Array.isArray(vendor) ? vendor[0] : vendor;
          })
          .filter((v): v is AttendingVendor => Boolean(v));
        setVendors(list);
      }
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Event',
          headerBackTitle: 'Back',
          ...rootedStackScreenOptions,
        }}
      />
      {loading ? (
        <View className="flex-1 items-center justify-center bg-canvas">
          <LoadingIndicator />
        </View>
      ) : error || !event ? (
        <Screen centered>
          <Text variant="subtitle" className="text-center">
            {error ?? 'Event not found.'}
          </Text>
        </Screen>
      ) : (
        <Screen scroll>
          <View className="mb-4">
            <EventThumb event={event} size="lg" />
          </View>
          <View className="mb-3">
            <EventStatusBadge event={event} showHint />
          </View>
          <Text variant="title" className="mb-2">
            {event.name}
          </Text>
          {event.organizer_name ? (
            <Text variant="subtitle" className="mb-6">
              Hosted by {event.organizer_name}
            </Text>
          ) : null}

          {event.description ? (
            <Text variant="body" className="mb-6">
              {event.description}
            </Text>
          ) : null}

          {event.market_history ? (
            <>
              <Text variant="heading" className="mb-2">
                History
              </Text>
              <Text variant="body" className="mb-6">
                {event.market_history}
              </Text>
            </>
          ) : null}

          {hasMarketGuide(event) ? (
            <>
              {event.what_to_look_for ? (
                <>
                  <Text variant="heading" className="mb-2">
                    What to look for
                  </Text>
                  <Text variant="body" className="mb-6">
                    {event.what_to_look_for}
                  </Text>
                </>
              ) : null}

              {getFeaturedVendorCategories(event).length > 0 ? (
                <>
                  <Text variant="heading" className="mb-2">
                    What you&apos;ll find
                  </Text>
                  <View className="mb-6 flex-row flex-wrap gap-2">
                    {getFeaturedVendorCategories(event).map((category) => (
                      <View key={category} className="rounded-full bg-honeydew px-3 py-1.5">
                        <Text variant="caption">{category}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}

              {event.market_highlights ? (
                <>
                  <Text variant="heading" className="mb-2">
                    Highlights & news
                  </Text>
                  <Text variant="body" className="mb-6">
                    {event.market_highlights}
                  </Text>
                </>
              ) : null}

              {getShopperTips(event).length > 0 ? (
                <>
                  <Text variant="heading" className="mb-2">
                    Shopper tips
                  </Text>
                  <View className="mb-6 gap-2">
                    {getShopperTips(event).map((tip) => (
                      <Text key={tip} variant="body">
                        • {tip}
                      </Text>
                    ))}
                  </View>
                </>
              ) : null}
            </>
          ) : null}

          <Card>
            <DetailRow
              icon="calendar"
              label="Date"
              value={formatEventFullDate(event.start_datetime, event.timezone)}
            />
            <DetailRow
              icon="clock-o"
              label="Time"
              value={formatEventTimeRange(event.start_datetime, event.end_datetime, event.timezone)}
            />
            {event.hours_summary ? (
              <DetailRow icon="repeat" label="Schedule" value={event.hours_summary} />
            ) : null}
            {formatMarketType(event.market_type) ? (
              <DetailRow
                icon="shopping-basket"
                label="Market type"
                value={formatMarketType(event.market_type)!}
              />
            ) : null}
            {event.address || event.city ? (
              <DetailRow
                icon="map-marker"
                label="Location"
                value={[event.address, event.city, event.state].filter(Boolean).join(', ')}
              />
            ) : null}
            {event.admission_info ? (
              <DetailRow icon="ticket" label="Admission" value={event.admission_info} />
            ) : null}
            {event.parking_info ? (
              <DetailRow icon="car" label="Parking" value={event.parking_info} />
            ) : null}
            {extraInfoWithoutSocialLinks(event.extra_info) ? (
              <DetailRow
                icon="info-circle"
                label="More info"
                value={extraInfoWithoutSocialLinks(event.extra_info)!}
              />
            ) : null}
            <MarketLinks event={event} />
          </Card>

          <Text variant="heading" className="mb-3 mt-8">
            Vendors on Rooted
          </Text>
          {vendors.length === 0 ? (
            <Text variant="caption">No vendors have confirmed for this event yet.</Text>
          ) : (
            <View className="gap-3">
              {vendors.map((vendor) => (
                <PressableCard
                  key={vendor.id}
                  className="flex-row items-center justify-between"
                  onPress={() => router.push(`/(shopper)/vendors/${vendor.id}`)}>
                  <View className="flex-1 pr-3">
                    <Text variant="body" className="font-semibold">
                      {vendor.business_name ?? 'Vendor'}
                    </Text>
                    {vendor.category ? (
                      <Text variant="caption" className="mt-0.5">
                        {vendor.category}
                      </Text>
                    ) : null}
                  </View>
                  <FontAwesome name="chevron-right" size={14} color="#9CAF88" />
                </PressableCard>
              ))}
            </View>
          )}
        </Screen>
      )}
    </>
  );
}
