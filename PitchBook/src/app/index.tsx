import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/store/authStore';
import { useVendorStore } from '@/store/vendorStore';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const { isAuthenticated, isNewUser, isLoading, user, lastMode } = useAuthStore();
  const { isVendor } = useVendorStore();

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

  useEffect(() => {
    if (isLoading) return;

    const timer = setTimeout(() => {
      if (isAuthenticated && user) {
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
  }, [isAuthenticated, isNewUser, isLoading, isVendor, lastMode, user]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Background glow effects */}
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.iconContainer}>
          <Ionicons name="football" size={48} color="#10B981" />
        </View>
        <Text style={styles.title}>KICKOFF</Text>
        <View style={styles.divider} />
        <Text style={styles.subtitle}>Premium Turf Booking</Text>
      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B', // Deep black/gray base
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
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    filter: 'blur(40px)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -height * 0.1,
    right: -width * 0.2,
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: width * 0.45,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    filter: 'blur(50px)',
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
    color: '#FAFAFA',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 4,
  },
  divider: {
    width: 40,
    height: 4,
    backgroundColor: '#10B981',
    borderRadius: 2,
    marginTop: 16,
    marginBottom: 16,
  },
  subtitle: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1.5,
  }
});
