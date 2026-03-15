import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { PhotoEntry, UserProfile, AppSettings } from '@/types';
import { savePhotos, loadPhotos, saveProfile, loadProfile, saveSettings, loadSettings, getDefaultSettings } from '@/utils/storage';
import { USE_MOCK_DATA, MOCK_PHOTOS, MOCK_PROFILE, MOCK_SETTINGS } from '@/constants/mockData';

interface AppContextValue {
  photos: PhotoEntry[];
  profile: UserProfile;
  settings: AppSettings;
  isLoading: boolean;
  addPhoto: (entry: PhotoEntry) => void;
  updatePhoto: (id: string, updates: Partial<PhotoEntry>) => void;
  deletePhoto: (id: string) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
}

const defaultProfile: UserProfile = { name: 'You', avatarUri: null, joinDate: new Date().toISOString().split('T')[0] };

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [settings, setSettings] = useState<AppSettings>(getDefaultSettings());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const [storedPhotos, storedProfile, storedSettings] = await Promise.all([
          loadPhotos(),
          loadProfile(),
          loadSettings(),
        ]);

        if (storedPhotos.length > 0) {
          setPhotos(storedPhotos);
          setProfile(storedProfile ?? defaultProfile);
          setSettings(storedSettings);
        } else if (USE_MOCK_DATA) {
          // Seed with mock data on first launch
          setPhotos(MOCK_PHOTOS);
          setProfile(MOCK_PROFILE);
          setSettings(MOCK_SETTINGS);
          await Promise.all([
            savePhotos(MOCK_PHOTOS),
            saveProfile(MOCK_PROFILE),
            saveSettings(MOCK_SETTINGS),
          ]);
        }
      } catch (e) {
        console.error('Failed to load app data:', e);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const addPhoto = useCallback((entry: PhotoEntry) => {
    setPhotos(prev => {
      // Replace if same date exists
      const filtered = prev.filter(p => p.date !== entry.date);
      const next = [...filtered, entry].sort((a, b) => a.date.localeCompare(b.date));
      savePhotos(next);
      return next;
    });
  }, []);

  const updatePhoto = useCallback((id: string, updates: Partial<PhotoEntry>) => {
    setPhotos(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...updates } : p);
      savePhotos(next);
      return next;
    });
  }, []);

  const deletePhoto = useCallback((id: string) => {
    setPhotos(prev => {
      const next = prev.filter(p => p.id !== id);
      savePhotos(next);
      return next;
    });
  }, []);

  const handleUpdateProfile = useCallback((updates: Partial<UserProfile>) => {
    setProfile(prev => {
      const next = { ...prev, ...updates };
      saveProfile(next);
      return next;
    });
  }, []);

  const handleUpdateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...updates };
      saveSettings(next);
      return next;
    });
  }, []);

  return (
    <AppContext.Provider
      value={{
        photos,
        profile,
        settings,
        isLoading,
        addPhoto,
        updatePhoto,
        deletePhoto,
        updateProfile: handleUpdateProfile,
        updateSettings: handleUpdateSettings,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
