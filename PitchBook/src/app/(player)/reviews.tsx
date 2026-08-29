import { View, Text, TouchableOpacity, ScrollView, FlatList, StatusBar, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

interface Review {
  id: string;
  name: string;
  rating: number;
  comment: string;
  timeAgo: string;
  avatar?: string;
}

const mockReviews: Review[] = [
  {
    id: '1',
    name: 'Zayn A.',
    rating: 5,
    comment: 'Outstanding turf condition. The field drainage is exceptional. Highly recommend for late evening games as the floodlights are placed perfectly.',
    timeAgo: '2 days ago',
  },
  {
    id: '2',
    name: 'Hina M.',
    rating: 4,
    comment: 'Parking space is secure and changing rooms are clean. Will definitely play here again.',
    timeAgo: '1 week ago',
  },
  {
    id: '3',
    name: 'Omer K.',
    rating: 5,
    comment: 'Very professional staff and smooth check-in process. Booking was super straightforward.',
    timeAgo: '3 weeks ago',
  },
];

const ratingDistribution = {
  5: 32,
  4: 10,
  3: 4,
  2: 1,
  1: 1,
};

export default function ReviewsScreen() {
  const { groundId } = useLocalSearchParams();
  const [expandedReview, setExpandedReview] = useState<string | null>(null);

  const totalReviews = Object.values(ratingDistribution).reduce((a, b) => a + b, 0);
  const averageRating = 4.8;

  const renderReview = ({ item }: { item: Review }) => (
    <View className="bg-white rounded-2xl p-4 mb-3 border border-[#E5E5E5]"
         style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
      <View className="flex-row items-center">
        <View className="w-10 h-10 rounded-full bg-[#4CAF50] items-center justify-center">
          <Text className="text-white font-bold font-bold text-sm">{item.name.charAt(0)}</Text>
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-[#1A1A2E] font-semibold font-semibold">{item.name}</Text>
          <Text className="text-[#737373] text-xs font-regular">{item.timeAgo}</Text>
        </View>
        <View className="flex-row items-center bg-[#F5F5F5] px-2 py-1 rounded-lg">
          <Ionicons name="star" size={14} color="#F59E0B" />
          <Text className="text-[#1A1A2E] font-bold font-bold text-sm ml-0.5">{item.rating}.0</Text>
        </View>
      </View>

      <Text 
        className="text-[#737373] text-sm font-regular mt-3 leading-5"
        numberOfLines={expandedReview === item.id ? undefined : 3}
      >
        {item.comment}
      </Text>

      {item.comment.length > 150 && (
        <TouchableOpacity onPress={() => setExpandedReview(expandedReview === item.id ? null : item.id)} className="mt-2">
          <Text className="text-[#4CAF50] font-medium font-medium text-sm">
            {expandedReview === item.id ? 'Show less' : 'Read more'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

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

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Summary Card */}
        <View className="bg-white rounded-2xl p-6 mt-4 items-center" 
             style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
          <Text className="text-4xl font-bold font-bold text-[#1A1A2E]">{averageRating}</Text>
          <View className="flex-row mt-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons 
                key={star} 
                name={star <= Math.round(averageRating) ? 'star' : 'star-outline'} 
                size={20} 
                color="#F59E0B" 
              />
            ))}
          </View>
          <Text className="text-[#737373] text-sm font-regular mt-1">{totalReviews} reviews</Text>

          {/* Rating Distribution */}
          <View className="w-full mt-4 pt-4 border-t border-[#F5F5F5]">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = ratingDistribution[rating as keyof typeof ratingDistribution] || 0;
              const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
              return (
                <View key={rating} className="flex-row items-center mb-1.5">
                  <Text className="text-[#737373] text-xs font-regular w-8">{rating}</Text>
                  <View className="flex-1 h-2 bg-[#F5F5F5] rounded-full mx-2">
                    <View className="h-2 bg-[#F59E0B] rounded-full" style={{ width: `${percentage}%` }} />
                  </View>
                  <Text className="text-[#737373] text-xs font-regular w-8">{count}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Write Review Button */}
        <TouchableOpacity
          className="flex-row items-center justify-center bg-[#4CAF50] py-4 rounded-full mt-4"
          style={{ shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
          onPress={() => router.push('/(player)/reviews-write')}
          activeOpacity={0.7}
        >
          <Ionicons name="create-outline" size={20} color="white" />
          <Text className="text-white font-bold font-bold ml-2">Write a review</Text>
        </TouchableOpacity>

        {/* Reviews List */}
        <View className="mt-4 pb-8">
          {mockReviews.map((review) => (
            <View key={review.id}>
              {renderReview({ item: review })}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}