export interface PhotoEntry {
  id: string;
  albumId: string;
  date: string; // YYYY-MM-DD
  imageUri: string;
  caption: string;
  capturedAt: string; // ISO timestamp
  cameraDirection: 'front' | 'back';
  faceLandmarks?: FaceLandmarks;
}

export interface UserProfile {
  name: string;
  avatarUri: string | null;
  joinDate: string; // YYYY-MM-DD
}

export interface AppSettings {
  photoQuality: 'low' | 'medium' | 'high';
  cloudBackupEnabled: boolean;
  mirrorSelfies: boolean;
  use24hClock: boolean;
}

export interface Album {
  id: string;
  name: string;
  createdAt: string;
  reminderEnabled: boolean;
  reminderTime: string; // HH:MM
  isLocked: boolean;
}

export interface AppState {
  photos: PhotoEntry[];
  profile: UserProfile;
  settings: AppSettings;
  isLoading: boolean;
}

export interface FaceLandmarks {
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  noseTip: { x: number; y: number };
  faceBounds: { x: number; y: number; width: number; height: number };
  rollAngle: number;
  yawAngle: number;
}

export type DayStatus = 'captured' | 'missed' | 'upcoming' | 'today-done' | 'today-pending' | 'disabled';

export interface WeekDay {
  date: string;
  dayLabel: string;
  dayNumber: number;
  status: DayStatus;
}
