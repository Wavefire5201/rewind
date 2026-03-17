import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { haptics } from '@/utils/haptics';
import { Colors, Fonts } from '@/constants/theme';
import { getImageSource } from '@/utils/imageSource';

interface ProfileHeaderProps {
  name: string;
  avatarUri: string | null;
  joinDate: string;
  onNamePress?: () => void;
}

function formatJoinDate(joinDate: string): string {
  const [year, month] = joinDate.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  const monthName = date.toLocaleString('en-US', { month: 'long' });
  return `capturing since ${monthName.toLowerCase()} ${year}`;
}

export default function ProfileHeader({ name, avatarUri, joinDate, onNamePress }: ProfileHeaderProps) {
  const initial = name.trim().charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <View style={styles.avatarWrapper}>
        {avatarUri ? (
          <Image source={getImageSource(avatarUri)} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )}
      </View>

      <Pressable onPress={() => { haptics.tap(); onNamePress?.(); }} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
        <Text style={styles.name}>{name}</Text>
      </Pressable>

      <Text style={styles.joinDate}>{formatJoinDate(joinDate)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  avatarWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
  },
  avatar: {
    width: 80,
    height: 80,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: Colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: Fonts.mono.regular,
    fontSize: 32,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  name: {
    fontFamily: Fonts.mono.regular,
    fontSize: 24,
    letterSpacing: -0.5,
    color: Colors.textPrimary,
    marginTop: 12,
    textAlign: 'center',
  },
  joinDate: {
    fontFamily: Fonts.mono.regular,
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
});
