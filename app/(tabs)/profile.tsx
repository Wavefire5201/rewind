import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { useAppContext } from '@/context/AppContext';
import { usePhotos } from '@/hooks/usePhotos';
import { useStreak } from '@/hooks/useStreak';
import ProfileHeader from '@/components/profile/ProfileHeader';
import LifetimeStats from '@/components/profile/LifetimeStats';
import SettingsList from '@/components/profile/SettingsList';
import EditNameModal from '@/components/profile/EditNameModal';

export default function ProfileScreen() {
  const { profile, settings, updateProfile, updateSettings } = useAppContext();
  const { totalPhotos } = usePhotos();
  const { currentStreak, consistency } = useStreak();
  const [showEditName, setShowEditName] = useState(false);

  function handleSaveName(name: string) {
    if (name.trim()) {
      updateProfile({ name: name.trim() });
    }
    setShowEditName(false);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ProfileHeader
          name={profile.name}
          avatarUri={profile.avatarUri}
          joinDate={profile.joinDate}
          onNamePress={() => setShowEditName(true)}
        />

        <LifetimeStats
          totalPhotos={totalPhotos}
          currentStreak={currentStreak}
          consistency={consistency}
        />

        <SettingsList
          settings={settings}
          updateSettings={updateSettings}
        />
      </ScrollView>

      <EditNameModal
        visible={showEditName}
        currentName={profile.name}
        onSave={handleSaveName}
        onClose={() => setShowEditName(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bgPage,
  },
  content: {
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 32,
  },
});
