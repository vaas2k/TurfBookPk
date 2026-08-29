import { View, Text, Image, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const groundImages = [
  {
    id: 1,
    uri: 'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800',
    title: 'Total Football Arena',
    location: 'Lahore • Pitch 2',
    size: '5-A-Side',
    rating: 4.8,
    reviews: 124,
  },
  {
    id: 2,
    uri: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800',
    title: 'Green Valley Ground',
    location: 'Islamabad • Pitch 1',
    size: '7-A-Side',
    rating: 4.5,
    reviews: 89,
  },
  {
    id: 3,
    uri: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800',
    title: 'City Sports Complex',
    location: 'Rawalpindi • Pitch 3',
    size: '11-A-Side',
    rating: 4.7,
    reviews: 203,
  },
];

export default function OnboardingDiscovery() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: 'GROUNDS NEAR YOU, LIVE',
      subtitle: 'See real-time availability at verified grounds in your city — no more calling around.',
      location: 'Karachi & Lahore',
    },
    {
      title: 'BOOK IN SECONDS',
      subtitle: 'Pick your ground, choose a slot, pay via JazzCash or Easypaisa — done.',
      location: 'Islamabad & Rawalpindi',
    },
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      router.push('/(auth)/signup-phone');
    }
  };

  const handleSkip = () => {
    router.push('/(auth)/signup-phone');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar style="dark" />
      
      <View className="flex-row items-center justify-between px-6 pt-2">
        <Text className="text-2xl font-bold text-[#1A1A2E]">KICKOFF</Text>
        <TouchableOpacity onPress={handleSkip}>
          <Text className="text-[#737373] text-base font-medium">Skip</Text>
        </TouchableOpacity>
      </View>

      <View className="mt-4" style={{ height: height * 0.38 }}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={(e) => {
            const offset = e.nativeEvent.contentOffset.x;
            const index = Math.round(offset / (width - 48));
            setCurrentSlide(index);
          }}
          scrollEventThrottle={16}
          className="px-6"
        >
          {groundImages.map((item) => (
            <View 
              key={item.id}
              style={{ width: width - 48, marginRight: 16 }}
              className="rounded-2xl overflow-hidden bg-[#F5F5F5] shadow-lg shadow-black/10"
            >
              <Image 
                source={{ uri: item.uri }}
                className="w-full h-full"
                resizeMode="cover"
              />
              
              <View className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              
              <View className="absolute bottom-0 left-0 right-0 p-5">
                <View className="flex-row items-center mb-1">
                  <View className="bg-yellow-400/90 px-2 py-0.5 rounded flex-row items-center">
                    <Ionicons name="star" size={12} color="white" />
                    <Text className="text-white text-xs font-bold ml-0.5">{item.rating}</Text>
                  </View>
                  <Text className="text-white/70 text-xs ml-2">
                    {item.reviews} reviews
                  </Text>
                </View>

                <Text className="text-white text-xl font-bold">{item.title}</Text>
                
                <View className="flex-row items-center mt-0.5">
                  <Ionicons name="location-outline" size={14} color="#fff" />
                  <Text className="text-white/80 text-sm ml-1">{item.location}</Text>
                </View>

                <View className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full mt-2 self-start">
                  <Text className="text-white text-xs font-medium">{item.size}</Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        <View className="flex-row justify-center mt-3 space-x-2">
          {groundImages.map((_, index) => (
            <View
              key={index}
              className={`h-1.5 rounded-full ${
                index === currentSlide ? 'w-6 bg-[#4CAF50]' : 'w-1.5 bg-[#D4D4D4]'
              }`}
            />
          ))}
        </View>
      </View>

      <View className="flex-row items-center justify-center mt-3 px-6">
        <View className="bg-[#F5F5F5] px-4 py-2 rounded-full">
          <View className="flex-row items-center">
            <Ionicons name="location-outline" size={16} color="#4CAF50" />
            <Text className="text-[#1A1A2E] font-medium ml-1">
              {slides[currentSlide]?.location || 'Karachi & Lahore'}
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-1 px-6 mt-6">
        <Text className="text-2xl font-bold text-[#1A1A2E] text-center">
          {slides[currentSlide]?.title || 'GROUNDS NEAR YOU, LIVE'}
        </Text>
        <Text className="text-[#737373] text-center mt-2 text-base leading-6">
          {slides[currentSlide]?.subtitle || 'See real-time availability at verified grounds in your city — no more calling around.'}
        </Text>
      </View>

      <View className="px-6 pb-8">
        <TouchableOpacity
          className="bg-[#4CAF50] py-4 rounded-full shadow-lg shadow-[#4CAF50]/30"
          onPress={handleNext}
        >
          <Text className="text-white text-center text-base font-semibold">
            {currentSlide === slides.length - 1 ? 'Get Started' : 'Next >'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}