import { Tabs } from 'expo-router';
import { Colors } from '@/constants/theme';
import TabBar from '@/components/TabBar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: Colors.bgPage },
        animation: 'shift',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'home' }} />
      <Tabs.Screen name="camera" options={{ title: 'capture' }} />
      <Tabs.Screen name="albums" options={{ title: 'albums' }} />
      <Tabs.Screen name="timelapse" options={{ title: 'timelapse' }} />
      <Tabs.Screen name="profile" options={{ title: 'profile' }} />
    </Tabs>
  );
}
