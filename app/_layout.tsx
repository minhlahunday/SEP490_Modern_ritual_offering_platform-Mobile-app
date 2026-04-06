import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { initAuth } from '@/services/auth';

export default function RootLayout() {
  useFrameworkReady();

  useEffect(() => {
    initAuth();
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="vendor/[id]" />
        <Stack.Screen name="chat/index" />
        <Stack.Screen name="notifications/index" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <Toast />
      <StatusBar style="auto" />
    </>
  );
}
