import { io } from 'socket.io-client';
// Strip /api/v1 — the Socket.IO gateway lives at the server root, not under the REST prefix
const socketUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/api\/v\d+\/?$/, '');
// Not connected on import — useRiderSocket hook manages lifecycle, attaches auth.token before connect
export const socket = io(socketUrl, {
    autoConnect: false,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
});
//# sourceMappingURL=socket.js.map