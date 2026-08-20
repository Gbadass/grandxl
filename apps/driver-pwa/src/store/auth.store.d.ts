import type { User } from '@grandxl/types';
interface AuthState {
    user: User | null;
    accessToken: string | null;
    isAuthenticated: boolean;
    isInitializing: boolean;
}
interface AuthActions {
    setAuth: (user: User, accessToken: string) => void;
    clearAuth: () => void;
    setInitializing: (value: boolean) => void;
    updateUser: (partial: Partial<User>) => void;
}
export declare const useAuthStore: import("zustand").UseBoundStore<import("zustand").StoreApi<AuthState & AuthActions>>;
export {};
//# sourceMappingURL=auth.store.d.ts.map