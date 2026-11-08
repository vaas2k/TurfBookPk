import { create } from 'zustand';
import { getMyManagerAssignments } from '@/lib/api/managers';

type ManagerAccessState = {
  userId: string | null;
  hasAcceptedAssignment: boolean;
  refresh: (userId: string | null) => Promise<void>;
  setAccepted: (userId: string) => void;
};

let accessRequestVersion = 0;

export const useManagerAccessStore = create<ManagerAccessState>((set) => ({
  userId: null,
  hasAcceptedAssignment: false,
  refresh: async (userId) => {
    const version = ++accessRequestVersion;
    if (!userId) {
      set({ userId: null, hasAcceptedAssignment: false });
      return;
    }
    if (useManagerAccessStore.getState().userId !== userId) {
      set({ userId, hasAcceptedAssignment: false });
    }
    try {
      const assignments = await getMyManagerAssignments();
      if (version === accessRequestVersion && useManagerAccessStore.getState().userId === userId) {
        set({ hasAcceptedAssignment: assignments.some((item) => Boolean(item.accepted_at)) });
      }
    } catch {
      // Keep the last known state while offline; the server still enforces access.
    }
  },
  setAccepted: (userId) => {
    accessRequestVersion += 1;
    set({ userId, hasAcceptedAssignment: true });
  },
}));
