// Client-side simulation of the MegaBlock API contract documented in
// MEGABLOCK_MODES_INTEGRATION.md. It uses the production floor odds and data
// fields so mock mode exercises the same UI paths as the real API.

const RTP = 0.97;
const MOCK_PLAYER_ID = 'mock-player-7f3c2a';
const MOCK_SETTINGS = Object.freeze({
  defaultDifficulty: 'easy',
  difficulties: {
    easy: { maxFloor: 24 },
    medium: { maxFloor: 18 },
    hard: { maxFloor: 14 },
    hardcore: { maxFloor: 15 },
  },
  maxBet: 100,
  maxProfit: 1000,
  minBet: 0.1,
});

export class MockMegaBlockClient {
  constructor({ random = Math.random } = {}) {
    this.random = random;
    this.activeRound = null;
    this.balance = randomCurrencyAmount(random, 850, 1_250);
    this.betCounter = randomInteger(random, 100_000, 999_999);
    this.currency = 'SC';
    this.history = createHistory(random, this.currency, this.betCounter);
    this.nonce = this.history.length + 1;
    this.serverSeed = randomHash(random);
    this.serverSeedHash = hashLabel(this.serverSeed);
  }

  async launch(request) {
    await delay(this.random);
    return {
      currency: this.currency,
      gameKey: request?.gameKey ?? 'mega-block',
      token: `mock-mega-block-${randomToken(this.random)}`,
    };
  }

  async getSettings() {
    await delay(this.random);
    return clone(MOCK_SETTINGS);
  }

  async getUnfinishedBet() {
    await delay(this.random);
    return {
      hasUnfinishedBet: Boolean(this.activeRound),
      unfinishedBet: this.activeRound ? toOpenBet(this.activeRound) : null,
    };
  }

  async placeBet(request) {
    await delay(this.random);
    if (this.activeRound) throw backendError('OpenBetExistsErrorType');

    const difficulty = request?.difficulty;
    const config = MOCK_SETTINGS.difficulties[difficulty];
    const betAmount = clampCurrency(Number(request?.amount));
    if (!config || !Number.isFinite(betAmount) || betAmount < MOCK_SETTINGS.minBet || betAmount > MOCK_SETTINGS.maxBet) {
      throw backendError('BetAmountOutOfRangeErrorType');
    }
    if (betAmount > this.balance) throw backendError('InsufficientBalanceErrorType');

    this.balance = clampCurrency(this.balance - betAmount);
    this.betCounter += 1;
    this.nonce += 1;

    const now = new Date().toISOString();
    const id = String(this.betCounter);
    const crashFloor = randomInteger(this.random, 1, config.maxFloor + 1);
    const round = {
      betAmount: formatDecimal(betAmount),
      clientSeed: String(request.clientSeed ?? ''),
      createdAt: now,
      crashFloor,
      currency: this.currency,
      currentFloorCount: 0,
      gameDifficulty: difficulty,
      id,
      maxFloor: config.maxFloor,
      nonce: this.nonce,
      payoutMultiplier: formatDecimal(1),
      playerId: MOCK_PLAYER_ID,
      result: null,
      roundId: `mock-round-${randomToken(this.random)}`,
      serverSeed: this.serverSeed,
      serverSeedHash: this.serverSeedHash,
      updatedAt: now,
      walletCreditRef: null,
      walletDebitRef: `mock-wallet-debit-${id}`,
      winningAmount: formatDecimal(0),
    };

    this.activeRound = round;
    return {
      betAmount,
      betId: id,
      clientSeed: round.clientSeed,
      currency: round.currency,
      currentFloorCount: 0,
      difficulty,
      maxFloor: round.maxFloor,
      nonce: round.nonce,
      serverSeedHash: round.serverSeedHash,
    };
  }

  async dropBlock(betId) {
    await delay(this.random);
    const round = this.getActiveRound(betId);
    const attemptedFloor = round.currentFloorCount + 1;

    if (attemptedFloor === round.crashFloor) {
      round.result = 'lost';
      round.payoutMultiplier = formatDecimal(0);
      round.updatedAt = new Date().toISOString();
      this.completeRound(round);
      return toResolvedDropResponse(round, attemptedFloor);
    }

    round.currentFloorCount = attemptedFloor;
    round.payoutMultiplier = formatDecimal(multiplierForFloor(round.currentFloorCount, round.maxFloor));
    round.updatedAt = new Date().toISOString();

    // Crash floor maxFloor + 1 represents clearing every playable block.
    if (round.currentFloorCount === round.maxFloor) {
      round.result = 'won';
      const winningAmount = clampCurrency(Number(round.betAmount) * Number(round.payoutMultiplier));
      round.winningAmount = formatDecimal(winningAmount);
      round.walletCreditRef = `mock-wallet-credit-${round.id}`;
      this.balance = clampCurrency(this.balance + winningAmount);
      this.completeRound(round);
      return toResolvedDropResponse(round, attemptedFloor, this.balance);
    }

    return {
      betId: round.id,
      completedFloorCount: round.currentFloorCount,
      maxFloor: round.maxFloor,
      payoutMultiplier: Number(round.payoutMultiplier),
      result: null,
    };
  }

  async cashOut(betId) {
    await delay(this.random);
    const round = this.getActiveRound(betId);
    if (round.currentFloorCount === 0) throw backendError('MegaBlockNoFloorsCompletedErrorType');

    const winningAmount = clampCurrency(Number(round.betAmount) * Number(round.payoutMultiplier));
    round.result = 'won';
    round.updatedAt = new Date().toISOString();
    round.walletCreditRef = `mock-wallet-credit-${round.id}`;
    round.winningAmount = formatDecimal(winningAmount);
    this.balance = clampCurrency(this.balance + winningAmount);
    this.completeRound(round);

    return {
      balance: this.balance,
      betAmount: round.betAmount,
      betId: round.id,
      clientSeed: round.clientSeed,
      completedFloorCount: round.currentFloorCount,
      crashFloor: round.crashFloor,
      currency: round.currency,
      maxFloor: round.maxFloor,
      nonce: round.nonce,
      payoutMultiplier: Number(round.payoutMultiplier),
      result: 'won',
      serverSeedHash: round.serverSeedHash,
      winningAmount,
    };
  }

  async getBets(page = 1, perPage = 10) {
    await delay(this.random);
    const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
    const safePerPage = Math.max(1, Math.min(100, Number.parseInt(perPage, 10) || 10));
    const offset = (safePage - 1) * safePerPage;
    return {
      currentPage: safePage,
      data: this.history.slice(offset, offset + safePerPage).map(toHistoryBet),
      totalCount: this.history.length,
      totalPages: Math.max(Math.ceil(this.history.length / safePerPage), 1),
    };
  }

  async getBetById(betId) {
    await delay(this.random);
    const id = String(betId);
    if (this.activeRound?.id === id) return { ...toOpenBet(this.activeRound), seedRevealed: false };

    const bet = this.history.find((item) => item.id === id);
    if (!bet) throw backendError('NoOpenBetErrorType');
    return { ...toHistoryBet(bet), seedRevealed: true, serverSeed: bet.serverSeed };
  }

  async getProvablyFairState() {
    await delay(this.random);
    return {
      clientSeed: this.activeRound?.clientSeed ?? 'mock-client-seed',
      nonce: this.nonce,
      serverSeedHash: this.serverSeedHash,
    };
  }

  async rotateProvablyFairSeed() {
    await delay(this.random);
    if (this.activeRound) throw backendError('OpenBetExistsErrorType');

    const previousServerSeed = this.serverSeed;
    this.serverSeed = randomHash(this.random);
    this.serverSeedHash = hashLabel(this.serverSeed);
    this.nonce = 0;
    return { nonce: this.nonce, previousServerSeed, serverSeedHash: this.serverSeedHash };
  }

  async verifyProvablyFairBet(betId, gameKey = 'mega-block') {
    await delay(this.random);
    const bet = this.history.find((item) => item.id === String(betId));
    if (!bet) throw backendError('MegaBlockBetNotFoundErrorType');
    return {
      betId: bet.id,
      clientSeed: bet.clientSeed,
      gameKey,
      nonce: bet.nonce,
      serverSeed: bet.serverSeed,
      serverSeedHash: bet.serverSeedHash,
      verified: true,
    };
  }

  getActiveRound(betId) {
    if (!this.activeRound || this.activeRound.id !== String(betId)) throw backendError('NoOpenBetErrorType');
    return this.activeRound;
  }

  completeRound(round) {
    this.history.unshift({ ...round });
    this.activeRound = null;
  }
}

function createHistory(random, currency, betCounter) {
  return Array.from({ length: 16 }, (_, index) => {
    const difficulty = ['easy', 'medium', 'hard'][randomInteger(random, 0, 2)];
    const maxFloor = MOCK_SETTINGS.difficulties[difficulty].maxFloor;
    const crashFloor = randomInteger(random, 1, maxFloor + 1);
    const canCashOutAt = Math.min(crashFloor - 1, maxFloor);
    const won = canCashOutAt > 0 && (crashFloor === maxFloor + 1 || random() >= 0.45);
    // A losing history row must have crashed on the very next attempted floor.
    const completedFloorCount = won ? randomInteger(random, 1, canCashOutAt) : canCashOutAt;
    const payoutMultiplier = won ? multiplierForFloor(completedFloorCount, maxFloor) : 0;
    const betAmount = randomCurrencyAmount(random, 0.1, 50);
    const timestamp = new Date(Date.now() - (index + 1) * randomInteger(random, 18, 180) * 60_000).toISOString();
    const id = String(betCounter - index - 1);
    const serverSeed = randomHash(random);
    return {
      betAmount: formatDecimal(betAmount), clientSeed: `mock-client-${randomToken(random)}`, createdAt: timestamp,
      crashFloor, currency, currentFloorCount: completedFloorCount, gameDifficulty: difficulty, id, maxFloor,
      nonce: index + 1, payoutMultiplier: formatDecimal(payoutMultiplier), playerId: MOCK_PLAYER_ID,
      result: won ? 'won' : 'lost', roundId: `mock-round-history-${id}`, serverSeed,
      serverSeedHash: hashLabel(serverSeed), updatedAt: timestamp, walletCreditRef: won ? `mock-wallet-credit-${id}` : null,
      walletDebitRef: `mock-wallet-debit-${id}`, winningAmount: formatDecimal(won ? clampCurrency(betAmount * payoutMultiplier) : 0),
    };
  });
}

function toOpenBet({ crashFloor: _crashFloor, serverSeed: _serverSeed, ...round }) { return { ...round }; }
function toHistoryBet(round) {
  return { ...round, betAmount: formatDecimal(round.betAmount), payoutMultiplier: formatDecimal(round.payoutMultiplier), winningAmount: formatDecimal(round.winningAmount) };
}
function toResolvedDropResponse(round, attemptedFloor, balance) {
  return {
    ...(balance === undefined ? {} : { balance }), attemptedFloor, betId: round.id, clientSeed: round.clientSeed,
    completedFloorCount: round.currentFloorCount, crashFloor: round.crashFloor, maxFloor: round.maxFloor,
    nonce: round.nonce, payoutMultiplier: Number(round.payoutMultiplier), result: round.result,
    serverSeedHash: round.serverSeedHash, winningAmount: Number(round.winningAmount),
  };
}
function multiplierForFloor(floor, maxFloor) {
  const cumulativeProbability = (maxFloor + 1 - floor) / (maxFloor + 1);
  return Math.floor((RTP / cumulativeProbability) * 1_000_000) / 1_000_000;
}
function backendError(type) { return new Error(type); }
function randomInteger(random, minimum, maximum) { return Math.floor(random() * (maximum - minimum + 1)) + minimum; }
function randomCurrencyAmount(random, minimum, maximum) { return clampCurrency(minimum + random() * (maximum - minimum)); }
function randomHash(random) { return Array.from({ length: 4 }, () => randomToken(random, 8)).join(''); }
function randomToken(random, length = 12) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => alphabet[Math.floor(random() * alphabet.length)]).join('');
}
function hashLabel(seed) { return `mock-sha256-${seed}`; }
function clampCurrency(value) { return Number(value.toFixed(2)); }
function formatDecimal(value) { return Number(value).toFixed(8); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function delay(random) { return new Promise((resolve) => globalThis.setTimeout(resolve, randomInteger(random, 90, 260))); }
