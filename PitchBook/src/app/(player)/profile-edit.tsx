import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform, StatusBar, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import * as ImagePicker from 'expo-image-picker';

export default function ProfileEdit() {
  const { user } = useAuthStore();
  const [name, setName] = useState(user?.name || 'Zayn Ahmed');
  const [phone, setPhone] = useState(user?.phone || '0300 1234567');
  const [avatar, setAvatar] = useState<string | null>(null);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setAvatar(result.assets[0].uri);
    }
  };

  const handleSave = () => {
    Alert.alert('Success', 'Profile updated successfully!');
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      
      <View className="bg-white px-6 pt-4 pb-4 border-b border-[#E5E5E5] flex-row items-center">
        <TouchableOpacity 
          className="w-10 h-10 rounded-full bg-[#F5F5F5] items-center justify-center"
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#1A1A2E" />
        </TouchableOpacity>
        <Text className="text-xl font-bold font-bold text-[#1A1A2E] ml-3">EDIT PROFILE</Text>
      </View>

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View className="items-center mt-6">
          <TouchableOpacity onPress={handlePickImage} activeOpacity={0.7}>
            <View className="relative">
              {avatar ? (
                <Image source={{ uri: avatar }} className="w-24 h-24 rounded-full" />
              ) : (
                <View className="w-24 h-24 rounded-full bg-[#4CAF50] items-center justify-center">
                  <Text className="text-4xl font-bold font-bold text-white">
                    {name.charAt(0) || 'A'}
                  </Text>
                </View>
              )}
              <View className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#4CAF50] items-center justify-center border-2 border-white">
                <Ionicons name="camera" size={16} color="white" />
              </View>
            </View>
          </TouchableOpacity>
          <Text className="text-[#4CAF50] font-medium font-medium mt-2">Change Photo</Text>
        </View>

        {/* Form */}
        <View className="mt-6 space-y-4">
          <View>
            <Text className="text-[#1A1A2E] font-medium font-medium mb-2">FULL NAME</Text>
            <TextInput
              className="bg-white rounded-xl px-4 py-4 text-[#1A1A2E] text-base font-regular border border-[#E5E5E5]"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
              placeholder="Enter your full name"
              placeholderTextColor="#A3A3A3"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View>
            <Text className="text-[#1A1A2E] font-medium font-medium mb-2">PHONE NUMBER</Text>
            <View className="flex-row items-center bg-white rounded-xl px-4 border border-[#E5E5E5]"
                 style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
              <Text className="text-[#1A1A2E] font-medium font-medium py-4">+92</Text>
              <View className="w-px h-6 bg-[#D4D4D4] mx-3" />
              <TextInput
                className="flex-1 py-4 text-[#1A1A2E] text-base font-regular"
                placeholder="300 1234567"
                placeholderTextColor="#A3A3A3"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </View>

        <TouchableOpacity
          className="bg-[#4CAF50] py-4 rounded-full mt-8 mb-8"
          style={{ shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
          onPress={handleSave}
          activeOpacity={0.7}
        >
          <Text className="text-white text-center font-bold font-bold">Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}