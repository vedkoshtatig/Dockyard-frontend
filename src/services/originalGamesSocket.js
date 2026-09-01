import { io } from 'socket.io-client';

export function connectOriginalGamesBalanceSocket({ namespace, onBalance, onConnectionError, origin, token }) {
  if (!token) {
    throw new Error('Cannot connect the original-games socket without a session token.');
  }

  const socketUrl = `${origin.replace(/\/$/, '')}/${namespace.replace(/^\//, '')}`;
  const socket = io(socketUrl, {
    auth: { token },
    transports: ['websocket'],
  });

  socket.on('balance', (payload = {}) => {
    const balance = Number(payload.balance);
    if (!Number.isFinite(balance)) return;
    onBalance?.({ balance, currency: payload.currency });
  });

  socket.on('connect_error', (error) => {
    onConnectionError?.(error);
  });

  return () => socket.disconnect();
}
