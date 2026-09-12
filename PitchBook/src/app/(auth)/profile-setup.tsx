import { 
  View, Text, TextInput, TouchableOpacity, 
  ScrollView, Platform, ActivityIndicator,
  KeyboardAvoidingView 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { appDialog } from '@/components/ui/app-dialog';
import { goBackOrReplace } from '@/lib/navigation';

export default function ProfileSetupScreen() {
  const { profile, completeProfile } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  
  // Form fields
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [city, setCity] = useState(profile?.city || '');
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const cities = [
    'Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 
    'Faisalabad', 'Multan', 'Peshawar', 'Quetta',
    'Gujranwala', 'Sialkot', 'Sargodha', 'Bahawalpur'
  ];

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (fullName.trim().length < 2) {
      newErrors.fullName = 'Name must be at least 2 characters';
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!city) {
      newErrors.city = 'Please select your city';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleComplete = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    const profileData = {
      full_name: fullName.trim(),
      email: email.trim() || null,
      phone: phone.replace(/\s/g, '') || null,
      city: city,
    };

    const { error } = await completeProfile(profileData);
    setIsLoading(false);

    if (error) {
      appDialog.alert('Error', error.message);
    } else {
      appDialog.alert(
        'Profile Complete!',
        'Your account has been set up successfully.',
        [{ text: 'Continue', onPress: () => router.replace('/(player)') }]
      );
    }
  };

  const handleSkip = () => {
    appDialog.alert(
      'Skip Profile Setup',
      'You can complete your profile later from settings.',
      [
        { text: 'Skip', onPress: () => router.replace('/(player)') },
        { text: 'Stay', style: 'cancel' }
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <StatusBar style="dark" />
      
      <View className="bg-white px-6 pt-4 pb-4 border-b border-[#E5E5E5] flex-row items-center">
        <TouchableOpacity 
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="w-11 h-11 rounded-full bg-[#F5F5F5] items-center justify-center"
          onPress={() => goBackOrReplace('/(auth)/phone-input')}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#1A1A2E" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-[#1A1A2E] ml-3">Complete Your Profile</Text>
      </View>

      <KeyboardAvoidingView 
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >
        <ScrollView 
          className="flex-1" 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <View className="px-6 pt-6">
            <Text className="text-2xl font-bold text-[#1A1A2E] text-center">Tell us about yourself</Text>
            <Text className="text-[#737373] text-center mt-1 text-sm">
              Complete your profile to get the best experience
            </Text>

            {/* Form Fields */}
            <View className="mt-6 space-y-4">
              {/* Full Name */}
              <View>
                <Text className="text-[#1A1A2E] font-medium mb-1.5">
                  Full Name <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  className={`bg-white rounded-xl px-4 py-3.5 text-[#1A1A2E] text-base border ${
                    errors.fullName ? 'border-red-500' : 'border-[#E5E5E5]'
                  }`}
                  placeholder="Enter your full name"
                  placeholderTextColor="#A3A3A3"
                  value={fullName}
                  onChangeText={(text) => {
                    setFullName(text);
                    if (errors.fullName) {
                      setErrors(prev => ({ ...prev, fullName: '' }));
                    }
                  }}
                  style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
                />
                {errors.fullName && (
                  <Text className="text-red-500 text-xs mt-1">{errors.fullName}</Text>
                )}
              </View>

              {/* Email */}
              <View>
                <Text className="text-[#1A1A2E] font-medium mb-1.5">Email Address</Text>
                <TextInput
                  className={`bg-white rounded-xl px-4 py-3.5 text-[#1A1A2E] text-base border ${
                    errors.email ? 'border-red-500' : 'border-[#E5E5E5]'
                  }`}
                  placeholder="Enter your email address (optional)"
                  placeholderTextColor="#A3A3A3"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email) {
                      setErrors(prev => ({ ...prev, email: '' }));
                    }
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
                />
                {errors.email && (
                  <Text className="text-red-500 text-xs mt-1">{errors.email}</Text>
                )}
              </View>

              {/* Phone Number - Only show for Google users who don't have phone */}
              {!profile?.phone && (
                <View>
                  <Text className="text-[#1A1A2E] font-medium mb-1.5">Phone Number (Optional)</Text>
                  <TextInput
                    className="bg-white rounded-xl px-4 py-3.5 text-[#1A1A2E] text-base border border-[#E5E5E5]"
                    placeholder="331 5139044"
                    placeholderTextColor="#A3A3A3"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    maxLength={13}
                    style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
                  />
                  <Text className="text-[#737373] text-xs mt-1">Optional - you can add your phone number later</Text>
                </View>
              )}

              {/* City */}
              <View>
                <Text className="text-[#1A1A2E] font-medium mb-1.5">
                  City <Text className="text-red-500">*</Text>
                </Text>
                <TouchableOpacity
                  className={`bg-white rounded-xl px-4 py-3.5 flex-row items-center justify-between border ${
                    errors.city ? 'border-red-500' : 'border-[#E5E5E5]'
                  }`}
                  style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
                  onPress={() => setShowCityDropdown(!showCityDropdown)}
                  activeOpacity={0.7}
                >
                  <Text className={city ? 'text-[#1A1A2E] text-base' : 'text-[#A3A3A3] text-base'}>
                    {city || 'Select your city'}
                  </Text>
                  <Ionicons name={showCityDropdown ? 'chevron-up' : 'chevron-down'} size={20} color="#737373" />
                </TouchableOpacity>
                {errors.city && (
                  <Text className="text-red-500 text-xs mt-1">{errors.city}</Text>
                )}

                {showCityDropdown && (
                  <View className="bg-white rounded-xl mt-1 border border-[#E5E5E5] max-h-48 overflow-hidden"
                       style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 }}>
                    <ScrollView showsVerticalScrollIndicator={false}>
                      {cities.map((c) => (
                        <TouchableOpacity
                          key={c}
                          className={`px-4 py-3 ${city === c ? 'bg-[#E8F5E9]' : ''}`}
                          onPress={() => {
                            setCity(c);
                            setShowCityDropdown(false);
                            if (errors.city) {
                              setErrors(prev => ({ ...prev, city: '' }));
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Text className={city === c ? 'text-[#4CAF50] font-medium' : 'text-[#1A1A2E]'}>
                            {c}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            <View className="mt-8">
              <TouchableOpacity
                className="bg-[#4CAF50] py-4 rounded-full"
                style={{ shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
                onPress={handleComplete}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white text-center font-bold text-base">Complete Profile</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                className="py-3 mt-2"
                onPress={handleSkip}
                activeOpacity={0.7}
              >
                <Text className="text-[#737373] text-center font-medium">Skip for now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
