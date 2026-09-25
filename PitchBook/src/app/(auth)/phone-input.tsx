import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { appDialog } from '@/components/ui/app-dialog';

export default function PhoneInputScreen() {
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { sendOTP, signInWithGoogle, error, clearError } = useAuthStore();

  useEffect(() => {
    if (error) clearError();
  }, [phone]);

  const formatPhone = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 7) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    if (cleaned.length <= 10) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7, 10)}`;
    }
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7, 10)}`;
  };

  const handlePhoneChange = (text: string) => {
    const numericOnly = text.replace(/\D/g, '');
    if (numericOnly.length <= 10) {
      setPhone(formatPhone(numericOnly));
    }
  };

  const handleSendCode = async () => {
    const cleanPhone = phone.replace(/\s/g, '');

    if (cleanPhone.length < 10) {
      appDialog.alert('Invalid Number', 'Please enter a valid 10-digit phone number');
      return;
    }

    setIsLoading(true);
    const { error: sendError } = await sendOTP(`92${cleanPhone}`);
    setIsLoading(false);

    if (sendError) {
      appDialog.alert('Error', sendError.message);
    } else {
      router.push({
        pathname: '/(auth)/otp-verification',
        params: { phone: cleanPhone }
      });
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    
    const { error } = await signInWithGoogle();
    
    setIsGoogleLoading(false);

    if (error && error.code !== 'redirect') {
      appDialog.alert('Error', error.message);
    } else {
      if (Platform.OS !== 'web') {
        const { isAuthenticated, isNewUser } = useAuthStore.getState();
        if (isAuthenticated) {
          if (isNewUser) {
            router.replace('/(auth)/profile-setup');
          } else {
            router.replace('/(player)');
          }
        }
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.content}>
          
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="football" size={32} color="#10B981" />
            </View>
            <Text style={styles.title}>Welcome to TurfBookPK</Text>
            <Text style={styles.subtitle}>
              Enter your phone number to continue
            </Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.inputWrapper}>
              <View style={styles.prefixContainer}>
                <Text style={styles.prefixText}>+92</Text>
              </View>
              <View style={styles.divider} />
              <TextInput
                style={styles.input}
                placeholder="331 5139044"
                placeholderTextColor="#64748B"
                value={phone}
                onChangeText={handlePhoneChange}
                keyboardType="phone-pad"
                maxLength={13}
                autoFocus={Platform.OS === 'ios'}
                editable={!isLoading}
                keyboardAppearance="dark"
              />
            </View>
            
            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color="#F43F5E" />
                <Text style={styles.errorText}>{error.message}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleSendCode}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Continue with Phone</Text>
              )}
            </TouchableOpacity>

            <View style={styles.orDivider}>
              <View style={styles.line} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.line} />
            </View>

            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleSignIn}
              disabled={isGoogleLoading}
              activeOpacity={0.8}
            >
              {isGoogleLoading ? (
                <ActivityIndicator color="#FAFAFA" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color="#FAFAFA" />
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#12130F' },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 28 },
  
  header: { alignItems: 'center', marginBottom: 30 },
  iconContainer: { width: 60, height: 60, borderRadius: 20, backgroundColor: 'rgba(62,175,76,.12)', borderWidth: 1, borderColor: 'rgba(62,175,76,.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { fontSize: 27, lineHeight: 29, fontFamily: 'BigShouldersDisplay_800ExtraBold', color: '#F5F5F0', letterSpacing: 0.2, marginBottom: 6, textTransform: 'uppercase' },
  subtitle: { fontSize: 14, color: '#A1A39D', fontFamily: 'SpaceGrotesk_400Regular' },
  
  formContainer: { flex: 1 },
  label: { fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold', color: '#F5F5F0', marginBottom: 10, paddingLeft: 4 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1C16', borderWidth: 1, borderColor: '#34382E', borderRadius: 14, height: 60, paddingHorizontal: 16 },
  prefixContainer: { justifyContent: 'center' },
  prefixText: { color: '#F5F5F0', fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' },
  divider: { width: 1, height: 24, backgroundColor: '#34382E', marginHorizontal: 12 },
  input: { flex: 1, color: '#F5F5F0', fontSize: 16, fontFamily: 'SpaceGrotesk_500Medium', height: '100%' },
  
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(244, 63, 94, 0.1)', padding: 12, borderRadius: 12, marginTop: 12, borderWidth: 1, borderColor: 'rgba(244, 63, 94, 0.2)' },
  errorText: { color: '#F43F5E', fontSize: 13, fontWeight: '500', marginLeft: 8 },

  primaryButton: { backgroundColor: '#3EAF4C', height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold' },
  
  orDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 32 },
  line: { flex: 1, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  orText: { color: '#A1A39D', paddingHorizontal: 16, fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 1 },
  
  googleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 56, borderRadius: 999, backgroundColor: '#1A1C16', borderWidth: 1, borderColor: '#34382E' },
  googleButtonText: { color: '#F5F5F0', fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold', marginLeft: 12 },
});
