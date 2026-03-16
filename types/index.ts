export interface PhotoEntry {
  id: string;
  date: string; // YYYY-MM-DD
  imageUri: string;
  caption: string;
  capturedAt: string; // ISO timestamp
  cameraDirection: 'front' | 'back';
}

export interface UserProfile {
  name: string;
  avatarUri: string | null;
  joinDate: string; // YYYY-MM-DD
}

export interface AppSettings {
  reminderEnabled: boolean;
  reminderTime: string; // HH:MM
  photoQuality: 'low' | 'medium' | 'high';
  cloudBackupEnabled: boolean;
  mirrorSelfies: boolean;
}

export interface AppState {
  photos: PhotoEntry[];
  profile: UserProfile;
  settings: AppSettings;
  isLoading: boolean;
}

export type DayStatus = 'captured' | 'missed' | 'upcoming' | 'today-done' | 'today-pending' | 'disabled';

export interface WeekDay {
  date: string;
  dayLabel: string;
  dayNumber: number;
  status: DayStatus;
}
