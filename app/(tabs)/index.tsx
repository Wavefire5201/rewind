import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Camera } from 'phosphor-react-native';
import { Colors } from '@/constants/theme';
import { usePhotos } from '@/hooks/usePhotos';
import HomeHeader from '@/components/home/HomeHeader';
import TodayCard from '@/components/home/TodayCard';
import StreakCards from '@/components/home/StreakCards';
import WeekProgress from '@/components/home/WeekProgress';
import EmptyState from '@/components/ui/EmptyState';

export default function HomeScreen() {
  const { totalPhotos } = usePhotos();
  const router = useRouter();

  if (totalPhotos === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <EmptyState
          icon={<Camera size={48} color={Colors.textTertiary} weight="light" />}
          message="Take your first photo to start your journey"
          ctaLabel="Open Camera"
          onCta={() => router.push('/(tabs)/camera')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.content}>
        <HomeHeader />
        <TodayCard />
        <StreakCards />
        <WeekProgress />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPage,
  },
  content: {
    flex: 1,
    paddingTop: 16,
    paddingHorizontal: 28,
    paddingBottom: 100,
    gap: 32,
  },
});
