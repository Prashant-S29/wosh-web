import { create } from 'zustand';

interface ActiveProjectState {
  activeProjectId: string | null;
  setActiveProjectId: (id: string) => void;
}

export const useActiveProject = create<ActiveProjectState>((set) => ({
  activeProjectId: null,
  setActiveProjectId: (id: string) => set({ activeProjectId: id }),
}));
