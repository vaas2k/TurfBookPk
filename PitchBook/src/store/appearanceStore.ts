import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AppAppearance = 'dark' | 'light';

interface AppearanceState {
  appearance: AppAppearance;
  setAppearance: (appearance: AppAppearance) => void;
  toggleAppearance: () => void;
}

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      appearance: 'dark',
      setAppearance: (appearance) => set({ appearance }),
      toggleAppearance: () => set((state) => ({ appearance: state.appearance === 'dark' ? 'light' : 'dark' })),
    }),
    {
      name: 'appearance-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
