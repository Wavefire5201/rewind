import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import HomeHeader from '@/components/home/HomeHeader';
import TodayCard from '@/components/home/TodayCard';
import StreakCards from '@/components/home/StreakCards';
import WeekProgress from '@/components/home/WeekProgress';

export default function HomeScreen() {
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
