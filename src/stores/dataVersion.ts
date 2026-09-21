import { create } from 'zustand'

/** Incremented after every mutation so list screens refetch from Supabase. */
export const useDataVersion = create<{ version: number; bump: () => void }>((set) => ({
  version: 0,
  bump: () => set((state) => ({ version: state.version + 1 })),
}))

export function notifyDataChanged() {
  useDataVersion.getState().bump()
}
