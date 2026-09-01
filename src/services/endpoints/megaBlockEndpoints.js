/**
 * Mega Block API paths.
 *
 * Keep API paths in source control, alongside the feature that uses them. Only
 * deployment-specific values (origins, sockets, mock mode) belong in .env.
 */
export const MEGA_BLOCK_ENDPOINTS = Object.freeze({
  bets: '/api/v1/original-games/mega-block/bets',
  betById: '/api/v1/original-games/mega-block/bets/:betId',
  cashOut: '/api/v1/original-games/mega-block/cash-out',
  dropBlock: '/api/v1/original-games/mega-block/drop-block',
  launch: '/api/v1/original-games/launch',
  placeBet: '/api/v1/original-games/mega-block/place-bet',
  provablyFairRotateSeed: '/api/v1/original-games/provably-fair/rotate-seed',
  provablyFairState: '/api/v1/original-games/provably-fair/state',
  provablyFairVerify: '/api/v1/original-games/provably-fair/verify',
  settings: '/api/v1/original-games/mega-block/settings',
  unfinishedBet: '/api/v1/original-games/mega-block/unfinished-bet',
});
