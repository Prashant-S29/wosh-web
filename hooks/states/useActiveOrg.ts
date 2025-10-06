import { create } from 'zustand';

interface ActiveOrgState {
  activeOrgId: string | null;
  setActiveOrgId: (id: string) => void;
}

export const useActiveOrg = create<ActiveOrgState>((set) => ({
  activeOrgId: null,
  setActiveOrgId: (id: string) => set({ activeOrgId: id }),
}));
