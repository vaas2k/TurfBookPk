import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const pitchImage = 'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=1200';

export default function PlayerUiTestScreen() {
  const [darkMode, setDarkMode] = useState(true);
  const [selectedDate, setSelectedDate] = useState(1);
  const [saved, setSaved] = useState(false);

  const colors = darkMode
    ? {
        background: '#08110F',
        backgroundRaised: '#10201B',
        surface: 'rgba(22, 45, 37, 0.78)',
        surfaceStrong: '#17352A',
        text: '#F4FAF6',
        muted: '#A5B8AD',
        border: 'rgba(177, 222, 193, 0.17)',
        accent: '#86EFAC',
        accentStrong: '#2DD477',
        accentText: '#062B18',
        tab: '#17352A',
      }
    : {
        background: '#F1F7F2',
        backgroundRaised: '#E3F1E6',
        surface: 'rgba(255, 255, 255, 0.82)',
        surfaceStrong: '#FFFFFF',
        text: '#10271C',
        muted: '#617469',
        border: 'rgba(26, 91, 50, 0.14)',
        accent: '#178545',
        accentStrong: '#0B6B34',
        accentText: '#FFFFFF',
        tab: '#DDF2E2',
      };

  const dates = [
    { label: 'Today', number: 1 },
    { label: 'Tue', number: 2 },
    { label: 'Wed', number: 3 },
    { label: 'Thu', number: 4 },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>PLAYER PREVIEW</Text>
            <Text style={[styles.title, { color: colors.text }]}>Find your next match</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
            onPress={() => setDarkMode((value) => !value)}
            style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name={darkMode ? 'sunny-outline' : 'moon-outline'} size={20} color={colors.accent} />
          </Pressable>
        </View>

        <View style={[styles.hero, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]}>
          <Image source={{ uri: pitchImage }} style={styles.heroImage} />
          <View style={styles.heroShade} />
          <View style={styles.heroContent}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>NEARBY TONIGHT</Text>
            </View>
            <Text style={styles.heroTitle}>The pitch is calling.</Text>
            <Text style={styles.heroBody}>Fresh turf, easy booking, and a game worth showing up for.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Explore nearby grounds"
              style={[styles.primaryButton, { backgroundColor: colors.accent }]}
              onPress={() => undefined}
            >
              <Text style={[styles.primaryButtonText, { color: colors.accentText }]}>Explore grounds</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.accentText} />
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Browse by date</Text>
            <Text style={[styles.sectionHint, { color: colors.muted }]}>Pick a day, then find your space.</Text>
          </View>
          <Ionicons name="calendar-outline" size={22} color={colors.accent} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
          {dates.map((date) => {
            const active = selectedDate === date.number;
            return (
              <Pressable
                key={date.number}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${date.label}, June ${date.number}`}
                onPress={() => setSelectedDate(date.number)}
                style={[styles.dateChip, { backgroundColor: active ? colors.accent : colors.surface, borderColor: active ? colors.accent : colors.border }]}
              >
                <Text style={[styles.dateLabel, { color: active ? colors.accentText : colors.muted }]}>{date.label}</Text>
                <Text style={[styles.dateNumber, { color: active ? colors.accentText : colors.text }]}>{date.number}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>A good place to start</Text>
            <Text style={[styles.sectionHint, { color: colors.muted }]}>Popular with players near you.</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="See all grounds" onPress={() => undefined}>
            <Text style={[styles.link, { color: colors.accent }]}>See all</Text>
          </Pressable>
        </View>

        <View style={[styles.groundCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Image source={{ uri: pitchImage }} style={styles.groundImage} />
          <View style={styles.groundInfo}>
            <View style={styles.groundTitleRow}>
              <View style={styles.groundTitleCopy}>
                <Text style={[styles.groundTitle, { color: colors.text }]} numberOfLines={1}>Arena 9 Football Club</Text>
                <Text style={[styles.groundLocation, { color: colors.muted }]} numberOfLines={1}>DHA Phase 6, Lahore</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={saved ? 'Remove ground from saved' : 'Save ground'}
                onPress={() => setSaved((value) => !value)}
                style={styles.saveButton}
              >
                <Ionicons name={saved ? 'heart' : 'heart-outline'} size={21} color={saved ? '#F47C7C' : colors.muted} />
              </Pressable>
            </View>
            <View style={styles.metaRow}>
              <View style={styles.rating}><Ionicons name="star" size={15} color="#F7C948" /><Text style={[styles.metaText, { color: colors.text }]}>4.8</Text></View>
              <View style={styles.metaItem}><Ionicons name="navigate-outline" size={15} color={colors.muted} /><Text style={[styles.metaText, { color: colors.muted }]}>1.2 km</Text></View>
              <Text style={[styles.price, { color: colors.accent }]}>PKR 2,400/hr</Text>
            </View>
          </View>
        </View>

        <View style={[styles.bookingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.bookingTopRow}>
            <View style={[styles.bookingIcon, { backgroundColor: colors.tab }]}><Ionicons name="flash" size={20} color={colors.accent} /></View>
            <View style={styles.bookingCopy}>
              <Text style={[styles.bookingTitle, { color: colors.text }]}>Your next booking</Text>
              <Text style={[styles.bookingSubtext, { color: colors.muted }]}>Tomorrow, 8:00 - 9:00 PM</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </View>
          <View style={[styles.bookingDivider, { backgroundColor: colors.border }]} />
          <View style={styles.bookingBottomRow}>
            <Text style={[styles.bookingGround, { color: colors.text }]}>Model Town Sports Park</Text>
            <Text style={[styles.bookingStatus, { color: colors.accent }]}>Confirmed</Text>
          </View>
        </View>

        <View style={[styles.tip, { backgroundColor: colors.backgroundRaised, borderColor: colors.border }]}>
          <Ionicons name="sparkles-outline" size={20} color={colors.accent} />
          <Text style={[styles.tipText, { color: colors.text }]}>A calm, focused home screen keeps the next game one tap away.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  headerCopy: { flex: 1, marginHorizontal: 14 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  title: { fontSize: 26, lineHeight: 31, fontWeight: '800', marginTop: 3 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1 },
  hero: { minHeight: 300, overflow: 'hidden', borderRadius: 28, borderWidth: 1 },
  heroImage: { ...StyleSheet.absoluteFill },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(1, 14, 8, 0.58)' },
  heroContent: { flex: 1, justifyContent: 'flex-end', padding: 22 },
  liveBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(134, 239, 172, 0.18)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 12 },
  liveDot: { width: 7, height: 7, borderRadius: 7, backgroundColor: '#86EFAC', marginRight: 7 },
  liveText: { color: '#D9FBE3', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heroTitle: { color: '#FFFFFF', fontSize: 30, lineHeight: 34, fontWeight: '800', maxWidth: 260 },
  heroBody: { color: '#DCEBE1', fontSize: 14, lineHeight: 20, marginTop: 8, maxWidth: 290 },
  primaryButton: { alignSelf: 'flex-start', minHeight: 48, flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingHorizontal: 16, marginTop: 18 },
  primaryButtonText: { fontSize: 14, fontWeight: '800', marginRight: 9 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 13 },
  sectionTitle: { fontSize: 19, fontWeight: '800' },
  sectionHint: { fontSize: 13, marginTop: 3 },
  dateRow: { paddingRight: 10 },
  dateChip: { width: 72, minHeight: 76, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  dateLabel: { fontSize: 12, fontWeight: '700' },
  dateNumber: { fontSize: 23, fontWeight: '800', marginTop: 3 },
  link: { fontSize: 13, fontWeight: '800' },
  groundCard: { borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  groundImage: { width: '100%', height: 145 },
  groundInfo: { padding: 16 },
  groundTitleRow: { flexDirection: 'row', alignItems: 'center' },
  groundTitleCopy: { flex: 1, marginRight: 8 },
  groundTitle: { fontSize: 17, fontWeight: '800' },
  groundLocation: { fontSize: 13, marginTop: 4 },
  saveButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 17 },
  rating: { flexDirection: 'row', alignItems: 'center' },
  metaItem: { flexDirection: 'row', alignItems: 'center', marginLeft: 14 },
  metaText: { fontSize: 12, fontWeight: '700', marginLeft: 4 },
  price: { marginLeft: 'auto', fontSize: 13, fontWeight: '800' },
  bookingCard: { borderRadius: 24, borderWidth: 1, padding: 16, marginTop: 14 },
  bookingTopRow: { flexDirection: 'row', alignItems: 'center' },
  bookingIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bookingCopy: { flex: 1, marginHorizontal: 12 },
  bookingTitle: { fontSize: 15, fontWeight: '800' },
  bookingSubtext: { fontSize: 12, marginTop: 3 },
  bookingDivider: { height: 1, marginVertical: 14 },
  bookingBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bookingGround: { fontSize: 13, fontWeight: '700', flex: 1 },
  bookingStatus: { fontSize: 12, fontWeight: '800', marginLeft: 10 },
  tip: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, padding: 14, marginTop: 14 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 19, marginLeft: 10 },
});
