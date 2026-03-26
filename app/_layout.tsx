import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, JetBrainsMono_300Light, JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppProvider, useAppContext } from '@/context/AppContext';
import { FontProvider } from '@/context/FontContext';
import { Colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

function AppInner() {
  const { settings } = useAppContext();

  return (
    <FontProvider fontFamily={settings.fontFamily}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.bgPage },
          animation: 'fade_from_bottom',
          gestureEnabled: true,
          navigationBarColor: Colors.bgPage,
        }}
      />
    </FontProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    JetBrainsMono_300Light,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    CommitMono_Light: require('../assets/fonts/CommitMono-Light.otf'),
    CommitMono_Regular: require('../assets/fonts/CommitMono-Regular.otf'),
    CommitMono_Medium: require('../assets/fonts/CommitMono-Medium.otf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <AppInner />
      </AppProvider>
    </GestureHandlerRootView>
  );
}
