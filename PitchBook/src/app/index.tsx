import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/store/authStore';
import { useVendorStore } from '@/store/vendorStore';
import { Ionicons } from '@expo/vector-icons';
import { hasSeenOnboarding } from '@/lib/onboarding';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const { isAuthenticated, isNewUser, isLoading, user, lastMode } = useAuthStore();
  const { isVendor } = useVendorStore();
  const [onboardingReady, setOnboardingReady] = useState(false);
  const [onboardingSeen, setOnboardingSeen] = useState(false);

  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [scaleAnim] = useState(() => new Animated.Value(0.95));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();

  }, []);
  useEffect(() => { hasSeenOnboarding().then((seen) => { setOnboardingSeen(seen); setOnboardingReady(true); }); }, []);

  useEffect(() => {
    if (isLoading || !onboardingReady) return;

    const timer = setTimeout(() => {
      if (!isAuthenticated && !onboardingSeen) { router.replace('/(auth)/onboarding'); }
      else if (isAuthenticated && user) {
        // Get the latest role and vendor status
        if (lastMode === 'vendor' && isVendor) {
          router.replace('/(vendor)');
        } else if (isNewUser) {
          router.replace('/(auth)/profile-setup');
        } else {
          router.replace('/(player)');
        }
      } else {
        router.replace('/(auth)/phone-input');
      }
    }, 2000); // slightly longer to appreciate the splash

    return () => clearTimeout(timer);
  }, [isAuthenticated, isNewUser, isLoading, isVendor, lastMode, user, onboardingReady, onboardingSeen]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Background glow effects */}
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.iconContainer}>
          <Ionicons name="football" size={48} color="#10B981" />
        </View>
        <View style={styles.wordmark}><Text style={[styles.title, styles.titleGreen]}>TURF</Text><Text style={styles.title}>BOOKPK</Text></View>
        <View style={styles.divider} />
        <Text style={styles.subtitle}>Find your ground. Book your game.</Text>
      </Animated.View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12130F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowTop: {
    position: 'absolute',
    top: -height * 0.2,
    left: -width * 0.2,
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: 'rgba(62, 175, 76, 0.12)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -height * 0.1,
    right: -width * 0.2,
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: width * 0.45,
    backgroundColor: 'rgba(62, 175, 76, 0.08)',
  },
  content: {
    alignItems: 'center',
    zIndex: 10,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    color: '#F5F5F0', fontSize: 36, lineHeight: 36, fontFamily: 'BigShouldersDisplay_800ExtraBold', letterSpacing: 0.7,
  },
  wordmark: { flexDirection: 'row', alignItems: 'center' },
  titleGreen: { color: '#3EAF4C' },
  divider: {
    width: 40,
    height: 4,
    backgroundColor: '#3EAF4C',
    borderRadius: 2,
    marginTop: 16,
    marginBottom: 16,
  },
  subtitle: {
    color: '#A1A39D', fontSize: 14, fontFamily: 'SpaceGrotesk_500Medium',
    letterSpacing: 1.5,
  }
});
