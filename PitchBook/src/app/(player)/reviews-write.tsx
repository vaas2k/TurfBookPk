import { View, Text, TouchableOpacity, TextInput, ScrollView, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

export default function WriteReview() {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = () => {
    if (rating === 0) {
      Alert.alert('Error', 'Please select a rating');
      return;
    }
    if (!comment.trim()) {
      Alert.alert('Error', 'Please write a review');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      Alert.alert(
        'Review Submitted!',
        'Thank you for sharing your experience.',
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
        <Text className="text-xl font-bold font-bold text-[#1A1A2E] ml-3">REVIEWS</Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-6" showsVerticalScrollIndicator={false}>
        {/* Ground Info */}
        <View className="bg-white rounded-2xl p-4 items-center" 
             style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
          <Text className="text-lg font-bold font-bold text-[#1A1A2E]">KICKOFF ARENA</Text>
          <View className="flex-row items-center mt-1">
            <Text className="text-2xl font-bold font-bold text-[#1A1A2E]">4.8</Text>
            <View className="flex-row ml-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons key={star} name="star" size={16} color="#F59E0B" />
              ))}
            </View>
            <Text className="text-[#737373] text-sm font-regular ml-2">(92 ratings)</Text>
          </View>
        </View>

        {/* Rating Section */}
        <View className="mt-6">
          <Text className="text-[#1A1A2E] text-base font-bold font-bold text-center mb-4">
            RATE YOUR EXPERIENCE
          </Text>
          <Text className="text-[#737373] text-sm font-regular text-center mb-6">
            How was your game at Kickoff Arena?
          </Text>

          <View className="flex-row justify-center items-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                className="mx-2 p-1"
                onPress={() => setRating(star)}
                onPressIn={() => setHoverRating(star)}
                onPressOut={() => setHoverRating(0)}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={(hoverRating || rating) >= star ? 'star' : 'star-outline'} 
                  size={40} 
                  color="#F59E0B" 
                />
              </TouchableOpacity>
            ))}
          </View>

          <Text className="text-[#737373] text-sm font-regular text-center mt-4">
            {rating > 0 ? `${rating}.0 stars` : 'Tap a star to rate'}
          </Text>
        </View>

        {/* Comment Section */}
        <View className="mt-6">
          <Text className="text-[#1A1A2E] font-medium font-medium mb-2">Share your experience at this ground...</Text>
          <TextInput
            className="bg-white rounded-2xl p-4 text-[#1A1A2E] text-base font-regular border border-[#E5E5E5]"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
            placeholder="Write your review here..."
            placeholderTextColor="#A3A3A3"
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          className={`py-4 rounded-full mt-6 mb-8 ${isSubmitting ? 'bg-[#E5E5E5]' : 'bg-[#4CAF50]'}`}
          style={!isSubmitting ? { shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 } : {}}
          onPress={handleSubmit}
          disabled={isSubmitting}
          activeOpacity={0.7}
        >
          <Text className={`text-center font-bold font-bold ${isSubmitting ? 'text-[#737373]' : 'text-white'}`}>
            {isSubmitting ? 'Submitting...' : 'Submit review'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}