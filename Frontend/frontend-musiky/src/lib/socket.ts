import { io, type Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? '';

/**
 * In development the Vite proxy forwards /socket.io to the Flask server, so no
 * URL is needed. Set VITE_SOCKET_URL when the API lives on another origin.
 */
export function createRoomSocket(): Socket {
  return SOCKET_URL
    ? io(SOCKET_URL, { transports: ['websocket', 'polling'] })
    : io({ transports: ['websocket', 'polling'] });
}
