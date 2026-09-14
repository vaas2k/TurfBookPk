import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { BookingProfile } from '@/types/booking';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }) });

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const current = await Notifications.getPermissionsAsync();
  const status = current.status === 'granted' ? current.status : (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('bookings', { name: 'Bookings', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 250, 250, 250] });
  const projectId = process.env.EXPO_PUBLIC_EXPO_PROJECT_ID || Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return null;
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

export async function scheduleBookingReminders(booking: BookingProfile): Promise<void> {
  if (booking.status !== 'confirmed') return;
  const startsAt = new Date(`${booking.date}T${booking.start_time.length === 5 ? `${booking.start_time}:00` : booking.start_time}+05:00`).getTime();
  const reminders = [{ ms: 24 * 60 * 60 * 1000, label: 'tomorrow' }, { ms: 60 * 60 * 1000, label: 'in one hour' }];
  for (const reminder of reminders) {
    const seconds = Math.floor((startsAt - reminder.ms - Date.now()) / 1000);
    if (seconds > 5) await Notifications.scheduleNotificationAsync({ content: { title: 'Match reminder', body: `Your booking at ${booking.ground_title} starts ${reminder.label}.`, data: { bookingId: booking.id } }, trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds } });
  }
}
