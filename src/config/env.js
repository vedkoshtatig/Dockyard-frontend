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

function readEndpointEnv(name, fallback) {
  return readEnv(name) ?? fallback;
}

const apiBaseUrl =
  readEnv('VITE_BASE_URL') ??
  readEnv('VITE_API_BASE_URL') ??
  readEnv('VITE_ORIGINAL_GAMES_BASE_URL') ??
  readEnv('NEXT_PUBLIC_BASE_URL') ??
  'http://localhost:9004';

export const appEnv = {
  a1StubSessionId: env.DEV ? readEnv('VITE_A1_STUB_SESSION_ID') : undefined,
  apiBaseUrl,
  endpoints: {
    bets: readEndpointEnv('VITE_MEGABLOCK_BETS_ENDPOINT', '/api/v1/original-games/mega-block/bets'),
    betById: readEndpointEnv('VITE_MEGABLOCK_BET_BY_ID_ENDPOINT', '/api/v1/original-games/mega-block/bets/:betId'),
    cashOut: readEndpointEnv('VITE_MEGABLOCK_CASH_OUT_ENDPOINT', '/api/v1/original-games/mega-block/cash-out'),
    dropBlock: readEndpointEnv('VITE_MEGABLOCK_DROP_BLOCK_ENDPOINT', '/api/v1/original-games/mega-block/drop-block'),
    launch: readEndpointEnv('VITE_ORIGINAL_GAMES_LAUNCH_ENDPOINT', '/api/v1/original-games/launch'),
    placeBet: readEndpointEnv('VITE_MEGABLOCK_PLACE_BET_ENDPOINT', '/api/v1/original-games/mega-block/place-bet'),
    provablyFairRotateSeed: readEndpointEnv(
      'VITE_PROVABLY_FAIR_ROTATE_SEED_ENDPOINT',
      '/api/v1/original-games/provably-fair/rotate-seed',
    ),
    provablyFairState: readEndpointEnv(
      'VITE_PROVABLY_FAIR_STATE_ENDPOINT',
      '/api/v1/original-games/provably-fair/state',
    ),
    provablyFairVerify: readEndpointEnv(
      'VITE_PROVABLY_FAIR_VERIFY_ENDPOINT',
      '/api/v1/original-games/provably-fair/verify',
    ),
    settings: readEndpointEnv('VITE_MEGABLOCK_SETTINGS_ENDPOINT', '/api/v1/original-games/mega-block/settings'),
    unfinishedBet: readEndpointEnv(
      'VITE_MEGABLOCK_UNFINISHED_BET_ENDPOINT',
      '/api/v1/original-games/mega-block/unfinished-bet',
    ),
  },
  gameKey: readEnv('VITE_MEGABLOCK_GAME_KEY') ?? 'mega-block',
  socketNamespace: readEnv('VITE_ORIGINAL_GAMES_SOCKET_NAMESPACE') ?? '/original-games',
  socketOrigin: readEnv('VITE_SOCKET_ORIGIN') ?? apiBaseUrl,
  useMockData: readBooleanEnv(
    'VITE_USE_MOCK_DATA',
    readBooleanEnv('VITE_USEMOCKDATA', readBooleanEnv('NEXT_PUBLIC_USE_MOCK_DATA', false)),
  ),
};
