import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const PIN_KEY = '@rewind/app-pin';
const PIN_SALT_KEY = '@rewind/app-pin-salt';
const PIN_ATTEMPTS_KEY = '@rewind/app-pin-attempts';
const PIN_LOCKOUT_KEY = '@rewind/app-pin-lockout';

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 1000; // 30 seconds

async function generateSalt(): Promise<string> {
  const bytes = Crypto.getRandomBytes(16);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    salt + pin,
  );
}

export async function hasPin(): Promise<boolean> {
  const [hash, salt] = await Promise.all([
    AsyncStorage.getItem(PIN_KEY),
    AsyncStorage.getItem(PIN_SALT_KEY),
  ]);
  if (hash && !salt) {
    // Legacy plaintext PIN — clear it
    await AsyncStorage.removeItem(PIN_KEY);
    return false;
  }
  return hash !== null && salt !== null;
}

export async function savePin(pin: string): Promise<void> {
  const salt = await generateSalt();
  const hash = await hashPin(pin, salt);
  await AsyncStorage.multiSet([
    [PIN_KEY, hash],
    [PIN_SALT_KEY, salt],
  ]);
}

export interface VerifyPinResult {
  success: boolean;
  locked?: boolean;
  remainingAttempts?: number;
}

export async function verifyPin(input: string): Promise<VerifyPinResult> {
  // Check lockout
  const lockoutStr = await AsyncStorage.getItem(PIN_LOCKOUT_KEY);
  if (lockoutStr) {
    const lockoutUntil = parseInt(lockoutStr, 10);
    if (Date.now() < lockoutUntil) {
      return { success: false, locked: true };
    }
    // Lockout expired — clear it
    await AsyncStorage.multiRemove([PIN_LOCKOUT_KEY, PIN_ATTEMPTS_KEY]);
  }

  const [stored, salt] = await Promise.all([
    AsyncStorage.getItem(PIN_KEY),
    AsyncStorage.getItem(PIN_SALT_KEY),
  ]);

  if (!stored || !salt) {
    // No valid PIN exists — clear stale data
    await clearPin();
    return { success: false, remainingAttempts: 0 };
  }

  const hash = await hashPin(input, salt);
  if (hash === stored) {
    // Correct — clear attempts
    await AsyncStorage.multiRemove([PIN_ATTEMPTS_KEY, PIN_LOCKOUT_KEY]);
    return { success: true };
  }

  // Increment failed attempts
  const attemptsStr = await AsyncStorage.getItem(PIN_ATTEMPTS_KEY);
  const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;
  const newAttempts = attempts + 1;

  if (newAttempts >= MAX_ATTEMPTS) {
    const lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
    await AsyncStorage.multiSet([
      [PIN_ATTEMPTS_KEY, String(newAttempts)],
      [PIN_LOCKOUT_KEY, String(lockoutUntil)],
    ]);
    return { success: false, locked: true };
  }

  await AsyncStorage.setItem(PIN_ATTEMPTS_KEY, String(newAttempts));
  return { success: false, remainingAttempts: MAX_ATTEMPTS - newAttempts };
}

export interface AttemptInfo {
  locked: boolean;
  remainingAttempts: number;
  lockoutUntil?: number;
}

export async function getAttemptInfo(): Promise<AttemptInfo> {
  const [attemptsStr, lockoutStr] = await Promise.all([
    AsyncStorage.getItem(PIN_ATTEMPTS_KEY),
    AsyncStorage.getItem(PIN_LOCKOUT_KEY),
  ]);

  const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;

  if (lockoutStr) {
    const lockoutUntil = parseInt(lockoutStr, 10);
    if (Date.now() < lockoutUntil) {
      return { locked: true, remainingAttempts: 0, lockoutUntil };
    }
    // Expired
    await AsyncStorage.multiRemove([PIN_LOCKOUT_KEY, PIN_ATTEMPTS_KEY]);
  }

  return { locked: false, remainingAttempts: MAX_ATTEMPTS - attempts };
}

export async function clearPin(): Promise<void> {
  await AsyncStorage.multiRemove([
    PIN_KEY,
    PIN_SALT_KEY,
    PIN_ATTEMPTS_KEY,
    PIN_LOCKOUT_KEY,
  ]);
}
