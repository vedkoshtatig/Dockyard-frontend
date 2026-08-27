const MOCK_SETTINGS = {
  defaultDifficulty: 'easy',
  difficulties: {
    easy: { maxFloor: 24 },
    medium: { maxFloor: 22 },
    hard: { maxFloor: 20 },
    hardcore: { maxFloor: 15 },
  },
  maxBet: 100,
  maxProfit: 1000,
  minBet: 0.1,
};

export class MockMegaBlockClient {
  constructor() {
    this.activeRound = null;
    this.balance = 1000;
    this.betCounter = 41;
    this.currency = 'SC';
    this.history = [];
  }

  async launch(request) {
    await delay(180);
    return {
      currency: this.currency,
      gameKey: request?.gameKey ?? 'mega-block',
      token: 'mock-mega-block-token',
    };
  }

  async getSettings() {
    await delay(120);
    return MOCK_SETTINGS;
  }

  async getUnfinishedBet() {
    await delay(120);
    return {
      hasUnfinishedBet: Boolean(this.activeRound),
      unfinishedBet: this.activeRound ? withoutOpenCrashFloor(this.activeRound) : null,
    };
  }

  async placeBet(request) {
    await delay(220);

    if (this.activeRound) {
      throw new Error('OpenBetExistsErrorType');
    }

    const maxFloor = MOCK_SETTINGS.difficulties[request.difficulty].maxFloor;
    const betAmount = clampCurrency(request.amount);

    if (betAmount < MOCK_SETTINGS.minBet || betAmount > MOCK_SETTINGS.maxBet) {
      throw new Error('BetAmountOutOfRangeErrorType');
    }

    if (betAmount > this.balance) {
      throw new Error('InsufficientBalanceErrorType');
    }

    this.balance = clampCurrency(this.balance - betAmount);
    this.betCounter += 1;

    const id = String(this.betCounter);
    const nonce = this.betCounter - 39;
    const crashFloor = chooseCrashFloor(maxFloor);
    const now = new Date().toISOString();

    this.activeRound = {
      betAmount: formatDecimal(betAmount),
      clientSeed: request.clientSeed,
      createdAt: now,
      crashFloor,
      currency: this.currency,
      currentFloorCount: 0,
      gameDifficulty: request.difficulty,
      id,
      maxFloor,
      nonce,
      payoutMultiplier: 1,
      playerId: 'mock-player',
      result: null,
      roundId: globalThis.crypto?.randomUUID?.() ?? `mock-round-${id}`,
      serverSeedHash: `mock-server-seed-hash-${nonce}`,
      updatedAt: now,
      walletCreditRef: null,
      walletDebitRef: `mock-wallet-debit-${id}`,
      winningAmount: formatDecimal(0),
    };

    return {
      betAmount,
      betId: id,
      clientSeed: request.clientSeed,
      currency: this.currency,
      currentFloorCount: 0,
      difficulty: request.difficulty,
      maxFloor,
      nonce,
      serverSeedHash: this.activeRound.serverSeedHash,
    };
  }

  async dropBlock(betId) {
    await delay(260);
    const round = this.getActiveRound(betId);
    const attemptedFloor = round.currentFloorCount + 1;

    if (attemptedFloor === round.crashFloor) {
      round.result = 'lost';
      round.winningAmount = formatDecimal(0);
      round.payoutMultiplier = 0;
      round.updatedAt = new Date().toISOString();
      this.completeRound(round);

      return {
        attemptedFloor,
        betId,
        clientSeed: round.clientSeed,
        completedFloorCount: round.currentFloorCount,
        crashFloor: round.crashFloor,
        maxFloor: round.maxFloor,
        nonce: round.nonce,
        payoutMultiplier: 0,
        result: 'lost',
        serverSeedHash: round.serverSeedHash,
        winningAmount: 0,
      };
    }

    round.currentFloorCount = attemptedFloor;
    round.payoutMultiplier = multiplierForFloor(round.currentFloorCount, round.maxFloor);
    round.updatedAt = new Date().toISOString();

    if (round.currentFloorCount >= round.maxFloor) {
      const winningAmount = clampCurrency(Number(round.betAmount) * Number(round.payoutMultiplier));
      round.result = 'won';
      round.winningAmount = formatDecimal(winningAmount);
      this.balance = clampCurrency(this.balance + winningAmount);
      round.walletCreditRef = `mock-wallet-credit-${betId}`;
      this.completeRound(round);

      return {
        balance: this.balance,
        betId,
        clientSeed: round.clientSeed,
        completedFloorCount: round.currentFloorCount,
        crashFloor: round.maxFloor + 1,
        maxFloor: round.maxFloor,
        nonce: round.nonce,
        payoutMultiplier: Number(round.payoutMultiplier),
        result: 'won',
        serverSeedHash: round.serverSeedHash,
        winningAmount,
      };
    }

    return {
      betId,
      completedFloorCount: round.currentFloorCount,
      maxFloor: round.maxFloor,
      payoutMultiplier: Number(round.payoutMultiplier),
      result: null,
    };
  }

  async cashOut(betId) {
    await delay(240);
    const round = this.getActiveRound(betId);

    if (round.currentFloorCount === 0) {
      throw new Error('MegaBlockNoFloorsCompletedErrorType');
    }

    const winningAmount = clampCurrency(Number(round.betAmount) * Number(round.payoutMultiplier));
    round.result = 'won';
    round.updatedAt = new Date().toISOString();
    round.walletCreditRef = `mock-wallet-credit-${betId}`;
    round.winningAmount = formatDecimal(winningAmount);
    this.balance = clampCurrency(this.balance + winningAmount);
    this.completeRound(round);

    return {
      balance: this.balance,
      betAmount: round.betAmount,
      betId,
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
    await delay(120);
    const offset = (page - 1) * perPage;
    const data = this.history.slice(offset, offset + perPage);

    return {
      currentPage: page,
      data,
      totalCount: this.history.length,
      totalPages: Math.max(Math.ceil(this.history.length / perPage), 1),
    };
  }

  async getBetById(betId) {
    await delay(100);
    const bet = this.history.find(({ id }) => id === betId) ?? this.activeRound;

    if (!bet) {
      throw new Error('NoOpenBetErrorType');
    }

    return {
      ...bet,
      seedRevealed: false,
    };
  }

  getActiveRound(betId) {
    if (!this.activeRound || this.activeRound.id !== betId) {
      throw new Error('NoOpenBetErrorType');
    }

    return this.activeRound;
  }

  completeRound(round) {
    this.history.unshift(toBetHistoryRow(round));
    this.activeRound = null;
  }
}

function chooseCrashFloor(maxFloor) {
  return maxFloor;
}

function multiplierForFloor(floor, maxFloor) {
  const progress = floor / maxFloor;
  return Number((1 + progress * progress * 23.25).toFixed(6));
}

function withoutOpenCrashFloor(round) {
  const { crashFloor: _crashFloor, ...safeRound } = round;
  return { ...safeRound };
}

function clampCurrency(value) {
  return Number(value.toFixed(2));
}

function formatDecimal(value) {
  return Number(value).toFixed(8);
}

function toBetHistoryRow(round) {
  return {
    ...round,
    betAmount: formatDecimal(round.betAmount),
    payoutMultiplier: formatDecimal(round.payoutMultiplier),
    winningAmount: formatDecimal(round.winningAmount),
  };
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}
