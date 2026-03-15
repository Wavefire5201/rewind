import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HouseSimple, Camera, FolderSimple, Play, User } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Sizes, BorderRadius } from '@/constants/theme';

const TABS = [
  { name: 'index', Icon: HouseSimple },
  { name: 'camera', Icon: Camera },
  { name: 'albums', Icon: FolderSimple },
  { name: 'timelapse', Icon: Play },
  { name: 'profile', Icon: User },
];

function TabItem({
  tab,
  isActive,
  onPress,
}: {
  tab: (typeof TABS)[number];
  isActive: boolean;
  onPress: () => void;
}) {
  const iconColor = isActive ? Colors.textPrimary : Colors.textTertiary;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={styles.tabItem}
    >
      <tab.Icon size={22} color={iconColor} weight={isActive ? 'bold' : 'regular'} />
    </Pressable>
  );
}

export default function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 21) }]}>
      <View style={styles.pill}>
        {TABS.map((tab, index) => (
          <TabItem
            key={tab.name}
            tab={tab}
            isActive={state.index === index}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: state.routes[index].key,
                canPreventDefault: true,
              });
              if (!event.defaultPrevented) {
                navigation.navigate(state.routes[index].name);
              }
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 21,
    paddingTop: 12,
    backgroundColor: 'transparent',
  },
  pill: {
    flexDirection: 'row',
    height: Sizes.tabBarHeight,
    backgroundColor: Colors.bgPage,
    borderRadius: BorderRadius.tabBar,
    padding: 4,
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    height: '100%',
  },
});
