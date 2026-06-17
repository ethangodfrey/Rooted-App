import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_PERMISSION_ASKED_KEY = 'rooted_location_permission_asked_v1';
const EVENTS_SCOPE_KEY = 'rooted_events_scope_v1';

export type EventsScope = 'local' | 'nationwide';

export async function hasAskedLocationPermission(): Promise<boolean> {
  return (await AsyncStorage.getItem(LOCATION_PERMISSION_ASKED_KEY)) === '1';
}

export async function markLocationPermissionAsked(): Promise<void> {
  await AsyncStorage.setItem(LOCATION_PERMISSION_ASKED_KEY, '1');
}

export async function getEventsScope(): Promise<EventsScope> {
  const value = await AsyncStorage.getItem(EVENTS_SCOPE_KEY);
  return value === 'nationwide' ? 'nationwide' : 'local';
}

export async function saveEventsScope(scope: EventsScope): Promise<void> {
  await AsyncStorage.setItem(EVENTS_SCOPE_KEY, scope);
}
