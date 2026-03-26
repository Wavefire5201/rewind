import React, { useRef, useEffect, useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { getImageSource } from '@/utils/imageSource';
import type { PhotoEntry } from '@/types';

interface FilmstripProps {
  photos: PhotoEntry[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

const ITEM_WIDTH = 42; // 38 thumb + 4 margin

const FilmstripItem = React.memo(function FilmstripItem({
  item,
  index,
  isActive,
  onSelect,
}: {
  item: PhotoEntry;
  index: number;
  isActive: boolean;
  onSelect: (index: number) => void;
}) {
  return (
    <Pressable onPress={() => onSelect(index)} style={styles.itemWrapper}>
      <View style={[styles.thumb, isActive ? styles.activeThumb : styles.inactiveThumb]}>
        <Image
          source={getImageSource(item.imageUri)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          recyclingKey={item.id}
        />
      </View>
    </Pressable>
  );
});

function Filmstrip({ photos, currentIndex, onSelect }: FilmstripProps) {
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (photos.length === 0) return;
    listRef.current?.scrollToIndex({
      index: currentIndex,
      animated: false,
      viewPosition: 0.5,
    });
  }, [currentIndex, photos.length]);

  const getItemLayout = useCallback((_: unknown, index: number) => ({
    length: ITEM_WIDTH,
    offset: ITEM_WIDTH * index,
    index,
  }), []);

  const renderItem = useCallback(({ item, index }: { item: PhotoEntry; index: number }) => (
    <FilmstripItem
      item={item}
      index={index}
      isActive={index === currentIndex}
      onSelect={onSelect}
    />
  ), [currentIndex, onSelect]);

  const keyExtractor = useCallback((item: PhotoEntry) => item.id, []);

  return (
    <FlatList
      ref={listRef}
      data={photos}
      keyExtractor={keyExtractor}
      horizontal
      showsHorizontalScrollIndicator={false}
      onScrollToIndexFailed={() => {}}
      getItemLayout={getItemLayout}
      renderItem={renderItem}
      extraData={currentIndex}
      windowSize={5}
      maxToRenderPerBatch={10}
      initialNumToRender={10}
      removeClippedSubviews
    />
  );
}

export default React.memo(Filmstrip);

const styles = StyleSheet.create({
  itemWrapper: {
    marginHorizontal: 2,
  },
  thumb: {
    width: 38,
    height: 48,
    borderRadius: 0,
    overflow: 'hidden',
  },
  activeThumb: {
    opacity: 1,
  },
  inactiveThumb: {
    opacity: 0.4,
  },
});
