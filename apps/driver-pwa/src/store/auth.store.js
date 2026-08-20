import { create } from 'zustand';
export const useAuthStore = create((set, get) => ({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isInitializing: true,
    setAuth: (user, accessToken) => set({ user, accessToken, isAuthenticated: true }),
    clearAuth: () => set({ user: null, accessToken: null, isAuthenticated: false }),
    setInitializing: (value) => set({ isInitializing: value }),
    updateUser: (partial) => {
        const current = get().user;
        if (current)
            set({ user: { ...current, ...partial } });
    },
}));
//# sourceMappingURL=auth.store.js.map