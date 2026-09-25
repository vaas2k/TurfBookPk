import AsyncStorage from '@react-native-async-storage/async-storage';
const KEY = 'turfbook.onboarding-seen';
export const hasSeenOnboarding = async () => (await AsyncStorage.getItem(KEY)) === 'true';
export const markOnboardingSeen = () => AsyncStorage.setItem(KEY, 'true');
