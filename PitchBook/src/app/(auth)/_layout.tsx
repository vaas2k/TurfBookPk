import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack 
      screenOptions={{ 
        headerShown: false,
        contentStyle: { backgroundColor: '#FFFFFF' }
      }}
    >
      <Stack.Screen name="onboarding-discovery" />
      <Stack.Screen name="onboarding-booking" />
      <Stack.Screen name="onboarding-community" />
      <Stack.Screen name="signup-phone" />
      {/* <Stack.Screen name="signup-otp" /> */}
      <Stack.Screen name="profile-setup" />
      <Stack.Screen name="login" />
      <Stack.Screen name="otp-verification" />
      <Stack.Screen name="role-selection" />
    </Stack>
  );
}