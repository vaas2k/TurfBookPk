import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
const groundImage2 = 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=1200';

export default function AntigravityUiTestScreen() {
  const [darkMode, setDarkMode] = useState(true);
  const [selectedDate, setSelectedDate] = useState(1);
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [saved, setSaved] = useState(false);

  // Refined palette for a sleeker, more aesthetic "glassy" look
  const colors = darkMode
    ? {
        background: '#09090B',
        surface: 'rgba(39, 39, 42, 0.65)',
        surfaceStrong: '#18181B',
        text: '#FAFAFA',
        textSecondary: '#A1A1AA',
        border: 'rgba(255, 255, 255, 0.08)',
        accent: '#10B981', // A classy emerald green
        accentSubtle: 'rgba(16, 185, 129, 0.15)',
        accentText: '#FFFFFF',
        danger: '#F43F5E',
      }
    : {
        background: '#F8FAFC',
        surface: 'rgba(255, 255, 255, 0.85)',
        surfaceStrong: '#FFFFFF',
        text: '#0F172A',
        textSecondary: '#64748B',
        border: 'rgba(0, 0, 0, 0.06)',
        accent: '#059669',
        accentSubtle: 'rgba(5, 150, 105, 0.1)',
        accentText: '#FFFFFF',
        danger: '#E11D48',
      };

  const dates = [
    { label: 'Today', number: 1, day: 'Mon' },
    { label: 'Tue', number: 2, day: 'Tue' },
    { label: 'Wed', number: 3, day: 'Wed' },
    { label: 'Thu', number: 4, day: 'Thu' },
    { label: 'Fri', number: 5, day: 'Fri' },
    { label: 'Sat', number: 6, day: 'Sat' },
  ];

  const filters = ['All', '5-a-side', '7-a-side', '11-a-side', 'Indoor'];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>GOOD EVENING</Text>
            <Text style={[styles.title, { color: colors.text }]}>Find a Pitch</Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setDarkMode(!darkMode)}
              style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border, marginRight: 8 }]}
            >
              <Ionicons name={darkMode ? 'sunny-outline' : 'moon-outline'} size={18} color={colors.text} />
            </Pressable>
            <Pressable
              style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.notificationDot} />
              <Ionicons name="notifications-outline" size={18} color={colors.text} />
            </Pressable>
          </View>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} style={{ marginRight: 10 }} />
          <Text style={{ color: colors.textSecondary, fontSize: 14, flex: 1, fontWeight: '500' }}>Search grounds...</Text>
          <View style={[styles.filterIcon, { backgroundColor: colors.accentSubtle }]}>
            <Ionicons name="options-outline" size={16} color={colors.accent} />
          </View>
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filters.map((filter) => {
            const active = selectedFilter === filter;
            return (
              <Pressable
                key={filter}
                onPress={() => setSelectedFilter(filter)}
                style={[
                  styles.filterChip,
                  { 
                    backgroundColor: active ? colors.text : 'transparent', 
                    borderColor: active ? colors.text : colors.border 
                  }
                ]}
              >
                <Text style={[styles.filterText, { color: active ? colors.background : colors.textSecondary }]}>{filter}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Upcoming Booking Card */}
        <View style={[styles.upcomingCard, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]}>
          <View style={styles.upcomingAccentStrip} />
          <View style={styles.upcomingHeader}>
            <Text style={[styles.upcomingTitle, { color: colors.textSecondary }]}>YOUR NEXT GAME</Text>
            <MaterialCommunityIcons name="whistle-outline" size={18} color={colors.accent} />
          </View>
          <Text style={[styles.upcomingGround, { color: colors.text }]}>Model Town Sports Park</Text>
          <Text style={[styles.upcomingTime, { color: colors.textSecondary }]}>Tomorrow • 8:00 PM - 9:00 PM</Text>
          <View style={styles.upcomingActions}>
            <Pressable style={[styles.upcomingButtonPrimary, { backgroundColor: colors.accentSubtle }]}>
              <Text style={[styles.upcomingButtonPrimaryText, { color: colors.accent }]}>View Details</Text>
            </Pressable>
          </View>
        </View>

        {/* Hero Banner (Featured) */}
        <View style={[styles.hero, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]}>
          <Image source={{ uri: pitchImage }} style={styles.heroImage} />
          <View style={[styles.heroShade, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
          <View style={styles.heroContent}>
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <Text style={styles.badgeText}>FEATURED</Text>
            </View>
            <Text style={styles.heroTitle}>The Antigravity Pitch</Text>
            <View style={styles.heroMetaRow}>
              <Ionicons name="location-outline" size={12} color="#E4E4E7" />
              <Text style={styles.heroMetaText}>Gulberg, Lahore</Text>
            </View>
          </View>
        </View>

        {/* Dates */}
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Date</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
          {dates.map((date) => {
            const active = selectedDate === date.number;
            return (
              <Pressable
                key={date.number}
                onPress={() => setSelectedDate(date.number)}
                style={[
                  styles.dateChip,
                  { 
                    backgroundColor: active ? colors.accent : colors.surface, 
                    borderColor: active ? colors.accent : colors.border 
                  }
                ]}
              >
                <Text style={[styles.dateDay, { color: active ? colors.accentText : colors.textSecondary }]}>{date.day}</Text>
                <Text style={[styles.dateNumber, { color: active ? colors.accentText : colors.text }]}>{date.number}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Ground Cards */}
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recommended</Text>
          <Text style={[styles.link, { color: colors.textSecondary }]}>See all</Text>
        </View>

        {/* Card 1 */}
        <View style={[styles.groundCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Image source={{ uri: groundImage2 }} style={styles.groundImage} />
          <View style={styles.priceTag}>
            <Text style={styles.priceTagText}>PKR 2,500/hr</Text>
          </View>
          <Pressable
            style={[styles.saveButton, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]}
            onPress={() => setSaved(!saved)}
          >
            <Ionicons name={saved ? 'heart' : 'heart-outline'} size={18} color={saved ? colors.danger : colors.text} />
          </Pressable>
          
          <View style={styles.groundInfo}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={[styles.groundTitle, { color: colors.text }]} numberOfLines={1}>DHA Phase 6 Turf</Text>
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={[styles.ratingText, { color: colors.text }]}>4.8</Text>
              </View>
            </View>

            <Text style={[styles.groundLocation, { color: colors.textSecondary }]} numberOfLines={1}>Sector J, DHA</Text>
            
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            
            <View style={styles.featuresRow}>
              <View style={styles.featureItem}>
                <Ionicons name="car-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.featureText, { color: colors.textSecondary }]}>Parking</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="water-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.featureText, { color: colors.textSecondary }]}>Water</Text>
              </View>
              <View style={[styles.slotsBadge, { backgroundColor: colors.accentSubtle }]}>
                <Text style={[styles.slotsText, { color: colors.accent }]}>3 slots</Text>
              </View>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 60 },
  
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  headerCopy: { flex: 1, marginHorizontal: 16 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 2 },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
  iconButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  notificationDot: { position: 'absolute', top: 10, right: 10, width: 6, height: 6, borderRadius: 3, backgroundColor: '#F43F5E', zIndex: 1 },
  
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 48, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  filterIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  
  filterRow: { paddingRight: 16, marginBottom: 24, paddingVertical: 2 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, marginRight: 8 },
  filterText: { fontSize: 13, fontWeight: '500' },

  upcomingCard: { borderRadius: 20, padding: 18, marginBottom: 24, borderWidth: 1, position: 'relative', overflow: 'hidden' },
  upcomingAccentStrip: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, backgroundColor: '#10B981' },
  upcomingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingLeft: 6 },
  upcomingTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  upcomingGround: { fontSize: 18, fontWeight: '700', marginBottom: 2, paddingLeft: 6, letterSpacing: -0.3 },
  upcomingTime: { fontSize: 13, fontWeight: '500', marginBottom: 14, paddingLeft: 6 },
  upcomingActions: { flexDirection: 'row', paddingLeft: 6 },
  upcomingButtonPrimary: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  upcomingButtonPrimaryText: { fontSize: 12, fontWeight: '600' },

  hero: { borderRadius: 24, borderWidth: 1, overflow: 'hidden', height: 200, marginBottom: 24 },
  heroImage: { ...StyleSheet.absoluteFill },
  heroShade: { ...StyleSheet.absoluteFill },
  heroContent: { flex: 1, justifyContent: 'flex-end', padding: 16 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 8 },
  badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: '#fff' },
  heroTitle: { fontSize: 22, fontWeight: '800', marginBottom: 4, color: '#fff', letterSpacing: -0.5 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center' },
  heroMetaText: { fontSize: 12, color: '#E4E4E7', marginLeft: 4, fontWeight: '500' },
  
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  link: { fontSize: 13, fontWeight: '500' },
  
  dateRow: { paddingRight: 16, marginBottom: 24 },
  dateChip: { width: 62, height: 76, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  dateDay: { fontSize: 12, fontWeight: '500', marginBottom: 2 },
  dateNumber: { fontSize: 20, fontWeight: '700' },
  
  groundCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  groundImage: { width: '100%', height: 160 },
  saveButton: { position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  priceTag: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  priceTagText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  
  groundInfo: { padding: 16 },
  groundTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  groundLocation: { fontSize: 13, fontWeight: '400', marginTop: 2 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245, 158, 11, 0.1)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8 },
  ratingText: { fontSize: 12, fontWeight: '600', marginLeft: 4 },
  
  divider: { height: 1, marginVertical: 12 },
  
  featuresRow: { flexDirection: 'row', alignItems: 'center' },
  featureItem: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  featureText: { fontSize: 12, fontWeight: '500', marginLeft: 4 },
  slotsBadge: { marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  slotsText: { fontSize: 11, fontWeight: '700' },
});
