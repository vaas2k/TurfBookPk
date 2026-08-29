import { View, Text, TouchableOpacity, ScrollView, TextInput, StatusBar, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

const faqs = [
  {
    id: '1',
    question: 'How do I cancel my booking?',
    answer: 'You can cancel your booked slot directly from "My Bookings" up to 6 hours before the game starts. A full refund will be automatically credited to your original payment method or wallet instantly.',
  },
  {
    id: '2',
    question: 'What forms of payments are supported?',
    answer: 'We currently support JazzCash, Easypaisa, and Bank Transfer. More payment options will be added soon.',
  },
  {
    id: '3',
    question: 'Can I shift my booking to another pitch?',
    answer: 'Yes, you can reschedule your booking up to 24 hours before the match. Contact support for assistance.',
  },
  {
    id: '4',
    question: 'Are cleats or shoes provided?',
    answer: 'No, players are required to bring their own equipment including cleats, shin guards, and appropriate sports attire.',
  },
];

export default function HelpSupport() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  const filteredFAQs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleContactSupport = () => {
    Alert.alert(
      'Contact Support',
      'Choose how you\'d like to reach us',
      [
        { text: 'Call', onPress: () => Linking.openURL('tel:+923001234567') },
        { text: 'Email', onPress: () => Linking.openURL('mailto:support@kickoff.com') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleReportIssue = () => {
    router.push('/(player)/report-issue');
  };

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      
      {/* Header */}
      <View className="bg-white px-6 pt-4 pb-4 border-b border-[#E5E5E5] flex-row items-center">
        <TouchableOpacity 
          className="w-10 h-10 rounded-full bg-[#F5F5F5] items-center justify-center"
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#1A1A2E" />
        </TouchableOpacity>
        <Text className="text-xl font-bold font-bold text-[#1A1A2E] ml-3">HELP CENTER</Text>
      </View>

      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Search */}
        <View className="px-4 pt-4">
          <View className="flex-row items-center bg-white rounded-2xl px-4 py-3 border border-[#E5E5E5]"
               style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
            <Ionicons name="search-outline" size={20} color="#737373" />
            <TextInput
              className="flex-1 ml-3 text-[#1A1A2E] text-base font-regular"
              placeholder="Search for help..."
              placeholderTextColor="#A3A3A3"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* FAQ Section */}
        <View className="px-4 mt-4">
          <Text className="text-[#1A1A2E] text-base font-bold font-bold mb-3">POPULAR QUESTIONS</Text>
          
          {filteredFAQs.map((faq) => (
            <View key={faq.id} className="bg-white rounded-2xl mb-3 overflow-hidden border border-[#E5E5E5]"
                 style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
              <TouchableOpacity
                className="flex-row items-center justify-between p-4"
                onPress={() => toggleFAQ(faq.id)}
                activeOpacity={0.7}
              >
                <Text className="text-[#1A1A2E] text-sm font-medium font-medium flex-1">
                  {faq.question}
                </Text>
                <Ionicons 
                  name={expandedFAQ === faq.id ? 'chevron-up' : 'chevron-down'} 
                  size={20} 
                  color="#737373" 
                />
              </TouchableOpacity>
              
              {expandedFAQ === faq.id && (
                <View className="px-4 pb-4">
                  <View className="h-px bg-[#F5F5F5] mb-3" />
                  <Text className="text-[#737373] text-sm font-regular leading-5">
                    {faq.answer}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Action Buttons */}
        <View className="px-4 mt-6 space-y-3">
          <Text className="text-[#1A1A2E] text-base font-bold font-bold mb-2">Still need help?</Text>
          
          <TouchableOpacity
            className="flex-row items-center justify-center bg-[#4CAF50] py-4 rounded-full"
            style={{ shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
            onPress={handleContactSupport}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="white" />
            <Text className="text-white font-bold font-bold ml-2">Contact Support</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center justify-center bg-white py-4 rounded-full border border-[#E5E5E5]"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
            onPress={handleReportIssue}
            activeOpacity={0.7}
          >
            <Ionicons name="flag-outline" size={20} color="#EF4444" />
            <Text className="text-[#EF4444] font-medium font-medium ml-2">Report an issue</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}