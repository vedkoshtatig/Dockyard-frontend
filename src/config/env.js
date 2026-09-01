import { MEGA_BLOCK_ENDPOINTS } from '../services/endpoints/megaBlockEndpoints.js';

const env = import.meta.env ?? {};

function readEnv(name) {
  const value = env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readBooleanEnv(name, fallback) {
  const value = readEnv(name);

  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function readIntegerEnv(name, fallback) {
  const value = Number.parseInt(readEnv(name), 10);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

// Origins vary by deployment; API paths do not. See services/endpoints.
const apiBaseUrl = readEnv('VITE_API_BASE_URL') ?? 'http://localhost:9004';

export const appEnv = {
  a1StubSessionId: env.DEV ? readEnv('VITE_A1_STUB_SESSION_ID') : undefined,
  apiBaseUrl,
  apiTimeoutMs: readIntegerEnv('VITE_API_TIMEOUT_MS', 30_000),
  endpoints: MEGA_BLOCK_ENDPOINTS,
  gameKey: readEnv('VITE_MEGABLOCK_GAME_KEY') ?? 'mega-block',
  socketNamespace: readEnv('VITE_ORIGINAL_GAMES_SOCKET_NAMESPACE') ?? '/original-games',
  socketOrigin: readEnv('VITE_APP_SOCKET_URL') ?? apiBaseUrl,
  useMockData: readBooleanEnv('VITE_USE_MOCK_DATA', false),
};
