import axios from 'axios';
import * as Sentry from '@sentry/react';
import { setClient } from '@grandxl/api-client';
import { useAuthStore } from '../store/auth.store';
import { loadRiderToken, saveRiderToken, clearRiderToken } from './riderAuth';
const instance = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true, // sends httpOnly refresh-token cookie on every request
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
});
instance.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token)
        config.headers.Authorization = `Bearer ${token}`;
    return config;
});
let isRefreshing = false;
let failedQueue = [];
function processQueue(error, token = null) {
    failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
    failedQueue = [];
}
instance.interceptors.response.use((res) => {
    const requestId = res.headers['x-request-id'];
    if (requestId)
        Sentry.setTag('lastRequestId', requestId);
    return res;
}, async (error) => {
    const original = error.config;
    // Treat 401 (expired) and 403 (wrong-account token after cookie-clobber) the same way:
    // try to silently refresh using the localStorage-stored rider refresh token first.
    const isAuthError = (error.response?.status === 401 || error.response?.status === 403) && !original._retry;
    if (isAuthError) {
        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                failedQueue.push({
                    resolve: (token) => {
                        original.headers.Authorization = `Bearer ${token}`;
                        resolve(instance(original));
                    },
                    reject,
                });
            });
        }
        original._retry = true;
        isRefreshing = true;
        try {
            const storedRefreshToken = loadRiderToken();
            let newToken = '';
            let refreshedUser = null;
            if (storedRefreshToken) {
                // Use mobile-style refresh to stay independent of the shared httpOnly cookie
                const res = await axios.post(`${import.meta.env.VITE_API_URL}/auth/refresh/mobile`, { refreshToken: storedRefreshToken });
                newToken = res.data.data.accessToken;
                refreshedUser = res.data.data.user;
                if (res.data.data.refreshToken)
                    saveRiderToken(res.data.data.refreshToken);
            }
            else {
                // Fallback: cookie-based refresh (used before first localStorage token is set)
                const res = await axios.post(`${import.meta.env.VITE_API_URL}/auth/refresh`, {}, { withCredentials: true });
                newToken = res.data.data.accessToken;
                refreshedUser = res.data.data.user ?? null;
            }
            const currentUser = useAuthStore.getState().user;
            useAuthStore.getState().setAuth(refreshedUser ?? currentUser, newToken);
            original.headers.Authorization = `Bearer ${newToken}`;
            processQueue(null, newToken);
            return instance(original);
        }
        catch (err) {
            processQueue(err);
            clearRiderToken();
            useAuthStore.getState().clearAuth();
            window.location.href = '/login';
            return Promise.reject(err);
        }
        finally {
            isRefreshing = false;
        }
    }
    const requestId = error.response?.headers?.['x-request-id'];
    if (requestId)
        Sentry.setTag('requestId', requestId);
    return Promise.reject(error);
});
setClient(instance);
export default instance;
//# sourceMappingURL=axios.js.map