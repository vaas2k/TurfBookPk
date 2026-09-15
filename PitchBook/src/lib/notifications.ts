import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BookingProfile } from '@/types/booking';

export const isExpoGoRuntime = (Constants as any).executionEnvironment === 'storeClient' || (Constants as any).appOwnership === 'expo';

if (!isExpoGoRuntime) {
  Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }) });
}
const PREFERENCES_KEY = 'pitchbook.notification-preferences';
const reminderKey = (bookingId: string) => `pitchbook.reminders.${bookingId}`;
export type NotificationPreferences = { bookingUpdates: boolean; matchReminders: boolean; vendorAlerts: boolean; promotions: boolean };
const defaults: NotificationPreferences = { bookingUpdates: true, matchReminders: true, vendorAlerts: true, promotions: false };
export async function getNotificationPreferences(): Promise<NotificationPreferences> { const raw = await AsyncStorage.getItem(PREFERENCES_KEY); return raw ? { ...defaults, ...JSON.parse(raw) } : defaults; }
export async function setNotificationPreferences(value: NotificationPreferences): Promise<void> { await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(value)); }

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Expo Go removed Android remote-push support in SDK 53. Do not invoke its token API.
    // if (isExpoGoRuntime) return null;
    if (!Device.isDevice) return null;
    const current = await Notifications.getPermissionsAsync();
    const status = current.status === 'granted' ? current.status : (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('bookings', { name: 'Bookings', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 250, 250, 250] });
    const projectId = process.env.EXPO_PUBLIC_EXPO_PROJECT_ID || Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return null;
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (error) {
    console.info('Remote push registration is unavailable in this runtime.', error);
    return null;
  }
}

export async function scheduleBookingReminders(booking: BookingProfile): Promise<void> {
  if (booking.status !== 'confirmed' || !(await getNotificationPreferences()).matchReminders) return;
  await cancelBookingReminders(booking.id);
  const startsAt = new Date(`${booking.date}T${booking.start_time.length === 5 ? `${booking.start_time}:00` : booking.start_time}+05:00`).getTime();
  const reminders = [{ ms: 24 * 60 * 60 * 1000, label: 'tomorrow' }, { ms: 60 * 60 * 1000, label: 'in one hour' }];
  const ids: string[] = [];
  for (const reminder of reminders) {
    const seconds = Math.floor((startsAt - reminder.ms - Date.now()) / 1000);
    if (seconds > 5) ids.push(await Notifications.scheduleNotificationAsync({ content: { title: 'Match reminder', body: `Your booking at ${booking.ground_title} starts ${reminder.label}.`, data: { bookingId: booking.id } }, trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds } }));
  }
  await AsyncStorage.setItem(reminderKey(booking.id), JSON.stringify(ids));
}
export async function cancelBookingReminders(bookingId: string): Promise<void> { const raw = await AsyncStorage.getItem(reminderKey(bookingId)); if (raw) await Promise.all(JSON.parse(raw).map((id: string) => Notifications.cancelScheduledNotificationAsync(id))); await AsyncStorage.removeItem(reminderKey(bookingId)); }
