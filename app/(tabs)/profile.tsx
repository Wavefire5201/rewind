import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretLeft } from 'phosphor-react-native';
import { Colors, Fonts } from '@/constants/theme';
import { useAppContext } from '@/context/AppContext';
import { useFont } from '@/context/FontContext';
import { usePhotos } from '@/hooks/usePhotos';
import { useStreak } from '@/hooks/useStreak';
import { haptics } from '@/utils/haptics';
import LifetimeStats from '@/components/profile/LifetimeStats';
import SettingsList from '@/components/profile/SettingsList';

export default function ProfileScreen() {
  const router = useRouter();
  const { settings, updateSettings, resetAllData, seedMockPhotos } = useAppContext();
  const { totalPhotos } = usePhotos();
  const { currentStreak, consistency } = useStreak();
  const { fonts } = useFont();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => { haptics.tap(); router.canGoBack() ? router.back() : router.replace('/'); }}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <CaretLeft size={20} color={Colors.textPrimary} weight="regular" />
        </Pressable>
        <Text style={[styles.title, { fontFamily: fonts.regular }]}>profile</Text>
        <View style={styles.backBtn} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <LifetimeStats
          totalPhotos={totalPhotos}
          currentStreak={currentStreak}
          consistency={consistency}
        />

        <SettingsList
          settings={settings}
          updateSettings={updateSettings}
          onClearData={resetAllData}
          onSeedMock={seedMockPhotos}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bgPage,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingVertical: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.mono.regular,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  content: {
    paddingHorizontal: 28,
    paddingBottom: 40,
    gap: 32,
  },
});
