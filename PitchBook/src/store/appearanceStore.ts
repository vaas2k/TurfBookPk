import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AppAppearance = 'dark';

interface AppearanceState {
  appearance: AppAppearance;
  setAppearance: (appearance: AppAppearance) => void;
  toggleAppearance: () => void;
}

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      appearance: 'dark',
      setAppearance: () => set({ appearance: 'dark' }),
      toggleAppearance: () => set({ appearance: 'dark' }),
    }),
    {
      name: 'appearance-storage',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<AppearanceState>),
        appearance: 'dark',
      }),
    },
  ),
);
