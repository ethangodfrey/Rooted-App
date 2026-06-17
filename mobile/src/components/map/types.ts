import type { RefObject } from 'react';
import type MapView from 'react-native-maps';

import type { Event } from '@/src/types/database';

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface EventMapProps {
  events: Event[];
  initialRegion: MapRegion;
  onPreviewEvent: (id: string) => void;
  onOpenEvent: (id: string) => void;
  getDistanceLabel?: (event: Event) => string | null;
  mapRef?: RefObject<MapView | null>;
  selectedEventId?: string | null;
}
