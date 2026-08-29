import { View, Text, TextInput, TouchableOpacity, ScrollView, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

const issueTypes = ['Booking Issue', 'Payment Problem', 'Ground Complaint', 'Technical Issue', 'Other'];

export default function ReportIssue() {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = () => {
    if (!selectedType || !description.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      Alert.alert(
        'Report Submitted',
        'Thank you for your report. Our team will review it and get back to you within 24 hours.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }, 1500);
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
        <Text className="text-xl font-bold font-bold text-[#1A1A2E] ml-3">REPORT ISSUE</Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-6" showsVerticalScrollIndicator={false}>
        <Text className="text-[#737373] text-sm font-regular text-center mb-6">
          Let us know what went wrong and we'll help you resolve it.
        </Text>

        <Text className="text-[#1A1A2E] font-medium font-medium mb-3">Issue Type</Text>
        <View className="flex-row flex-wrap mb-4">
          {issueTypes.map((type) => (
            <TouchableOpacity
              key={type}
              className={`px-4 py-2 rounded-full mr-2 mb-2 ${
                selectedType === type ? 'bg-[#4CAF50]' : 'bg-white border border-[#E5E5E5]'
              }`}
              onPress={() => setSelectedType(type)}
              activeOpacity={0.7}
            >
              <Text className={selectedType === type ? 'text-white font-medium font-medium' : 'text-[#737373] font-regular'}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text className="text-[#1A1A2E] font-medium font-medium mb-3">Description</Text>
        <TextInput
          className="bg-white rounded-2xl p-4 text-[#1A1A2E] text-base font-regular border border-[#E5E5E5]"
          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
          placeholder="Describe the issue in detail..."
          placeholderTextColor="#A3A3A3"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />

        <TouchableOpacity
          className={`py-4 rounded-full mt-6 mb-8 ${isSubmitting ? 'bg-[#E5E5E5]' : 'bg-[#4CAF50]'}`}
          style={!isSubmitting ? { shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 } : {}}
          onPress={handleSubmit}
          disabled={isSubmitting}
          activeOpacity={0.7}
        >
          <Text className={`text-center font-bold font-bold ${isSubmitting ? 'text-[#737373]' : 'text-white'}`}>
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}