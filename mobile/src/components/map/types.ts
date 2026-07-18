import type { RefObject } from 'react';
import type MapView from 'react-native-maps';

import type { TrackedBusiness } from '@/src/lib/spatial-businesses';
import type { Event } from '@/src/types/database';

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface EventMapProps {
  events: Event[];
  businesses?: TrackedBusiness[];
  initialRegion: MapRegion;
  onPreviewEvent: (id: string) => void;
  onOpenEvent: (id: string) => void;
  onRegionChangeComplete?: (region: MapRegion) => void;
  getDistanceLabel?: (event: Event) => string | null;
  mapRef?: RefObject<MapView | null>;
  selectedEventId?: string | null;
}
