import AsyncStorage from '@react-native-async-storage/async-storage';

const PIN_KEY = '@rewind/app-pin';

export async function hasPin(): Promise<boolean> {
  const pin = await AsyncStorage.getItem(PIN_KEY);
  return pin !== null;
}

export async function savePin(pin: string): Promise<void> {
  await AsyncStorage.setItem(PIN_KEY, pin);
}

export async function verifyPin(input: string): Promise<boolean> {
  const stored = await AsyncStorage.getItem(PIN_KEY);
  return stored === input;
}

export async function clearPin(): Promise<void> {
  await AsyncStorage.removeItem(PIN_KEY);
}
