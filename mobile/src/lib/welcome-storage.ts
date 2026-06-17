import AsyncStorage from '@react-native-async-storage/async-storage';

const WELCOME_SEEN_KEY = 'rooted_welcome_seen_v1';

export async function hasSeenWelcome(): Promise<boolean> {
  const value = await AsyncStorage.getItem(WELCOME_SEEN_KEY);
  return value === '1';
}

export async function markWelcomeSeen(): Promise<void> {
  await AsyncStorage.setItem(WELCOME_SEEN_KEY, '1');
}
