/** Root navigator. Screens draw their own purple header to match the current app. */
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PhoneFrame } from '../components/PhoneFrame';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <PhoneFrame>
        <Stack screenOptions={{ headerShown: false }} />
      </PhoneFrame>
    </SafeAreaProvider>
  );
}
