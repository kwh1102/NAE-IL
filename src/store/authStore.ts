import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  user: User | null;
  userRole: 'owner' | 'customer' | null;
  storeName: string | null;
  storeRegion: string | null;
  storeIndustry: string | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setUserRole: (role: 'owner' | 'customer' | null) => void;
  setStoreName: (name: string | null) => void;
  setStoreRegion: (region: string | null) => void;
  setStoreIndustry: (industry: string | null) => void;
  setIsLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  userRole: null,
  storeName: null,
  storeRegion: null,
  storeIndustry: null,
  isLoading: true,
  setSession: (session) => set({ session }),
  setUser: (user) => set({ user }),
  setUserRole: (role) => set({ userRole: role }),
  setStoreName: (name) => set({ storeName: name }),
  setStoreRegion: (region) => set({ storeRegion: region }),
  setStoreIndustry: (industry) => set({ storeIndustry: industry }),
  setIsLoading: (isLoading) => set({ isLoading }),
}));
