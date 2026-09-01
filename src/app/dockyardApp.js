import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { appEnv } from '../config/env.js';
import {
  BAD_LANDING_TILT_DEGREES,
  CAMERA_TOP_PADDING,
  COLLAPSE_GRAVITY,
  DESTROY_BELOW_GROUND_DISTANCE,
  FALLBACK_STACK_ANCHOR,
  STACK_BLOCK_DEFINITIONS,
  STACK_BLOCK_SCALE,
  STACK_CONTACT_PROGRESS,
  STACK_DROP_HEIGHT,
  STACK_DROP_SECONDS,
  STACK_IMPACT_COMPRESSION,
  STACK_RANDOM_DEVIATION_RAMP_BLOCKS,
  STACK_RANDOM_EDGE_BIAS,
  STACK_RANDOM_MAX_X_RANGE,
  STACK_RANDOM_MIN_PREVIOUS_X_DELTA,
  STACK_RANDOM_MIN_X_OFFSET,
  STACK_RANDOM_MIN_Y_ROTATION_DEGREES,
  STACK_RANDOM_X_RANGE,
  STACK_RANDOM_Y_ROTATION_DEGREES,
  STACK_RANDOM_Z_RANGE,
  STACK_SWING_DEGREES,
  STACK_VERTICAL_OVERLAP,
  TOTAL_STACK_BLOCKS,
  initialGameState,
} from '../core/constants.js';
import { getBackendErrorType, getDisplayError } from '../game/errors.js';
import {
  applyManualTextures,
  getAssetUrl,
  hideImportedSkyDomes,
  preferReliableGltfTextureLoader,
} from '../scene/assets.js';
import { createAmbientLifeSystem } from '../scene/ambientLifeSystem.js';
import { createCameraSystem } from '../scene/cameraSystem.js';
import { createEffectsSystem } from '../scene/effectsSystem.js';
import { createFloatingShipSystem } from '../scene/floatingShipSystem.js';
import { createHangingLoadSystem } from '../scene/hangingLoadSystem.js';
import {
  createFallingBlockTemplate,
  getObjectBottomCenter,
  getObjectParentSpaceBox,
  measureDockyardStackAnchor,
  placeObjectParentBottomCenter,
  placeObjectWorldBottomCenter,
  prepareFallingBlockObject,
} from '../scene/stackGeometry.js';
import { setupImportedSkybox, updateImportedSkybox } from '../scene/skybox.js';
import { createThreeScene } from '../scene/threeScene.js';
import { createTruckFollowerSystem } from '../scene/truckFollowers.js';
import { setupWater, updateWater } from '../scene/water.js';
import { createMegaBlockClient, getMegaBlockDataMode } from '../services/megaBlockClient.js';
import { connectOriginalGamesBalanceSocket } from '../services/originalGamesSocket.js';
import { createDockyardAudioSystem } from '../services/dockyardAudio.js';
import { getUiElements } from '../ui/elements.js';
import { formatAmount, formatPanelAmount, hasAtMostTwoDecimalPlaces } from '../ui/format.js';

export function startDockyardApp() {

  const {
    amountElement,
    balanceElement,
    cameraHeightElement,
    canvas,
    cashOutButton,
    clientSeedElement,
    dataModeElement,
    difficultyElement,
    fpsElement,
    fullscreenButton,
    howToPlayCloseButton,
    howToPlayDialog,
    howToPlayDifficultyGuide,
    howToPlayLimits,
    howToPlayOpenButton,
    loaderEl,
    resetButton,
    resetRoundButton,
    roundDetailsElement,
    stackButton,
    statusElement,
  } = getUiElements();

  const {
    camera,
    controls,
    renderer,
    scene,
    sunLight,
  } = createThreeScene({ canvas, cameraHeightElement });

  const loadingManager = new THREE.LoadingManager();
  loadingManager.onStart = (url) => {
    setLoaderMessage(`Loading ${url.split('/').pop()}`);
  };
  loadingManager.onProgress = (url, loaded, total) => {
    setLoaderMessage(`Loading assets ${loaded}/${total}`);
  };
  loadingManager.onError = (url) => {
    setLoaderMessage(`Failed to load ${url}`, true);
  };

  let modelRoot = null;
  let truckFollowerSystem = null;
  let water = null;
  let importedSkybox = null;
  let stackParts = [];
  let activeDrop = null;
  let mountedStackPart = null;
  let blockHandoffInProgress = false;
  let collapsingBlocks = [];
  let stackAnchor = {
    center: FALLBACK_STACK_ANCHOR.clone(),
    halfWidthX: STACK_RANDOM_X_RANGE,
    halfWidthZ: STACK_RANDOM_Z_RANGE,
    topY: 0,
  };
  let stackIndex = 0;
  let currentStackTopY = 0;
  let introControlsLocked = true;
  let resetInProgress = false;
  let collapseSettled = null;
  let collapseRecoveryPending = false;
  let settings = null;
  const gameClient = createMegaBlockClient();
  let disconnectBalanceSocket = null;
  let gameState = { ...initialGameState };
  let unfinishedGatePending = true;
  let frameCount = 0;
  let fpsTimer = 0;
  const textureLoader = new THREE.TextureLoader();
  const clock = new THREE.Clock();
  const effectsSystem = createEffectsSystem({
    scene,
    getStackAnchor: () => stackAnchor,
    getWater: () => water,
  });
  const audioSystem = createDockyardAudioSystem();
  const ambientLifeSystem = createAmbientLifeSystem({
    scene,
    getModelRoot: () => modelRoot,
    getWater: () => water,
  });
  let cameraSystem = null;
  const floatingShipSystem = createFloatingShipSystem({
    getIntroCameraAnimation: () => cameraSystem?.getIntroAnimation() ?? null,
    getModelRoot: () => modelRoot,
    getWater: () => water,
  });
  const hangingLoadSystem = createHangingLoadSystem({
    getMountedBlockTopPoint: getMountedHangingBlockTopPoint,
    getNextPart: () => stackParts[stackIndex] ?? null,
    getProjectedY: (point) => cameraSystem?.getProjectedY(point) ?? Number.NaN,
    getStackBlockHeight,
    getStackWorldPoint,
    hasStackAnchor: () => Boolean(stackAnchor.group),
    mountNextStackPart,
    onIntroControlsUnlocked: unlockIntroControls,
    setGameStatus,
  });
  cameraSystem = createCameraSystem({
    camera,
    cameraHeightElement,
    controls,
    getActiveDrop: () => activeDrop,
    getCurrentStackTopY: () => currentStackTopY,
    getFirstStackTopY: () => stackParts[0]?.topY ?? stackAnchor.topY,
    getIntroStackTopY: getIntroCameraStackTopY,
    getShipIntroStartOffset: () => floatingShipSystem.getIntroStartOffset(),
    getStackAnchor: () => stackAnchor,
    getStackBlockHeight,
    getStackWorldPoint,
    onBaseReturnComplete: handleCameraBaseReturnComplete,
    onIntroCameraFinished: () => hangingLoadSystem.startIntroDescend(),
    onShipIntroFrame: () => floatingShipSystem.update(clock.elapsedTime, 0),
    onShipIntroStarted: audioSystem.playHorn,
    onStackBrowseActiveChange: (isBrowsing) => hangingLoadSystem.setCameraStackBrowsing(isBrowsing),
    renderer,
  });

  function setLoaderMessage(message, isError = false) {
    loaderEl.textContent = message;
    loaderEl.classList.toggle('error', isError);
  }

  function hideLoader() {
    loaderEl.classList.add('hidden');
    loaderEl.setAttribute('aria-hidden', 'true');
  }

  async function initializeGameSession() {
    setDataMode();

    try {
      const launch = await gameClient.launch(getLaunchRequest());
      gameState.currency = launch.currency;
      removeCasinoSessionFromUrl();
      connectBalanceSocket(launch.token);

      settings = await gameClient.getSettings();
      applySettings(settings);

      const hasUnfinishedBet = await syncUnfinishedBet({
        resetStackWhenNone: true,
        preserveResolvedWhenNone: false,
      });

      if (!hasUnfinishedBet) {
        setGameStatus(stackParts.length ? 'Ready to place bet' : 'Loading stack blocks');
      }
    } catch (error) {
      gameState.status = 'error';
      gameState.error = getDisplayError(error);
      setGameStatus(gameState.error);
    } finally {
      updateControls();
    }
  }

  function connectBalanceSocket(token) {
    disconnectBalanceSocket?.();
    disconnectBalanceSocket = null;

    if (getMegaBlockDataMode() === 'mock') return;

    disconnectBalanceSocket = connectOriginalGamesBalanceSocket({
      namespace: appEnv.socketNamespace,
      onBalance: ({ balance, currency }) => {
        gameState = {
          ...gameState,
          balance,
          currency: currency || gameState.currency,
        };
        updateControls();
      },
      onConnectionError: () => {
        // REST responses remain authoritative, so a socket outage must not
        // interrupt an active round. Socket.IO will continue reconnecting.
      },
      origin: appEnv.socketOrigin,
      token,
    });
  }

  function getLaunchRequest() {
    const params = new URLSearchParams(window.location.search);
    const casinoSessionId = params.get('casinoSessionId');
    const gameKey = params.get('gameKey') ?? appEnv.gameKey;
    const isMockMode = getMegaBlockDataMode() === 'mock';
    const effectiveSessionId = casinoSessionId ?? appEnv.a1StubSessionId;

    if (gameKey !== appEnv.gameKey) {
      throw new Error(`MegaBlock must launch with gameKey=${appEnv.gameKey}.`);
    }

    if (!effectiveSessionId && !isMockMode) {
      throw new Error('Launch URL is missing casinoSessionId and no development stub session is configured.');
    }

    return {
      casinoSessionId: effectiveSessionId ?? 'mock-casino-session',
      device: window.innerWidth <= 768 ? 'MOBILE' : 'DESKTOP',
      gameKey: appEnv.gameKey,
      lang: document.documentElement.lang || 'en',
    };
  }

  function removeCasinoSessionFromUrl() {
    const url = new URL(window.location.href);

    if (!url.searchParams.has('casinoSessionId')) {
      return;
    }

    url.searchParams.delete('casinoSessionId');
    window.history.replaceState(window.history.state, document.title, `${url.pathname}${url.search}${url.hash}`);
  }

  function setDataMode() {
    if (dataModeElement) {
      dataModeElement.textContent = getMegaBlockDataMode() === 'mock' ? 'Mock data' : 'API data';
    }
  }

  function applySettings(nextSettings) {
    gameState.difficulty = nextSettings.defaultDifficulty;
    gameState.maxFloor = nextSettings.difficulties[nextSettings.defaultDifficulty].maxFloor;

    if (amountElement) {
      amountElement.min = String(nextSettings.minBet);
      amountElement.max = String(nextSettings.maxBet);
      amountElement.value = String(Math.max(nextSettings.minBet, Number(amountElement.value) || 1));
    }

    if (difficultyElement) {
      difficultyElement.value = nextSettings.defaultDifficulty;
    }

    updateHowToPlay(nextSettings);
  }

  function updateHowToPlay(nextSettings) {
    if (howToPlayLimits) {
      howToPlayLimits.textContent = `${formatAmount(nextSettings.minBet, gameState.currency)} to ${formatAmount(
        nextSettings.maxBet,
        gameState.currency,
      )}`;
    }

    if (howToPlayDifficultyGuide) {
      const difficultyLabels = {
        easy: 'Easy',
        medium: 'Medium',
        hard: 'Hard',
      };
      howToPlayDifficultyGuide.replaceChildren(
        ...['easy', 'medium', 'hard'].filter((difficulty) => nextSettings.difficulties[difficulty]).map((difficulty) => {
          const config = nextSettings.difficulties[difficulty];
          const item = document.createElement('div');
          const label = document.createElement('strong');
          const blocks = document.createElement('span');
          label.textContent = difficultyLabels[difficulty] ?? difficulty;
          blocks.textContent = `${Number(config.maxFloor)} blocks`;
          item.append(label, blocks);
          return item;
        }),
      );
    }
  }

  function restoreUnfinishedBet(response) {
    const unfinishedBet = response.unfinishedBet;

    if (!response.hasUnfinishedBet || !unfinishedBet) {
      restoreCompletedStack(0);
      return;
    }

    gameState = {
      ...gameState,
      betAmount: Number(unfinishedBet.betAmount),
      betId: String(unfinishedBet.id),
      clientSeed: unfinishedBet.clientSeed,
      completedFloorCount: Number(unfinishedBet.currentFloorCount),
      crashFloor: null,
      currency: unfinishedBet.currency,
      difficulty: unfinishedBet.gameDifficulty,
      error: null,
      maxFloor: Number(unfinishedBet.maxFloor),
      nonce: Number(unfinishedBet.nonce),
      payoutMultiplier: Number(unfinishedBet.payoutMultiplier),
      serverSeedHash: unfinishedBet.serverSeedHash,
      status: 'active',
      winningAmount: Number(unfinishedBet.winningAmount ?? 0),
    };

    if (amountElement) {
      amountElement.value = String(Number(unfinishedBet.betAmount));
    }

    if (difficultyElement) {
      difficultyElement.value = unfinishedBet.gameDifficulty;
    }

    if (clientSeedElement) {
      clientSeedElement.value = unfinishedBet.clientSeed;
    }

    restoreCompletedStack(Number(unfinishedBet.currentFloorCount));
    setGameStatus(`Restored round ${unfinishedBet.id}`);
  }

  async function syncUnfinishedBet(options) {
    unfinishedGatePending = true;
    updateControls();

    try {
      const unfinishedBet = await gameClient.getUnfinishedBet();

      if (unfinishedBet.hasUnfinishedBet) {
        restoreUnfinishedBet(unfinishedBet);
        unfinishedGatePending = false;
        return true;
      }

      if (options.resetStackWhenNone) {
        restoreCompletedStack(0);
      }

      gameState = {
        ...gameState,
        betId: null,
        completedFloorCount: options.preserveResolvedWhenNone ? gameState.completedFloorCount : 0,
        crashFloor: options.preserveResolvedWhenNone ? gameState.crashFloor : null,
        error: options.preserveResolvedWhenNone ? gameState.error : null,
        payoutMultiplier: options.preserveResolvedWhenNone ? gameState.payoutMultiplier : 1,
        status: options.preserveResolvedWhenNone ? gameState.status : 'idle',
        winningAmount: options.preserveResolvedWhenNone ? gameState.winningAmount : 0,
      };
      unfinishedGatePending = false;
      return false;
    } catch (error) {
      gameState.error = getDisplayError(error);
      setGameStatus(gameState.error);
      return true;
    } finally {
      updateControls();
    }
  }

  async function refreshSettings() {
    try {
      settings = await gameClient.getSettings();
      applySettings(settings);
    } catch (error) {
      gameState.error = getDisplayError(error);
      setGameStatus(gameState.error);
    }
  }

  async function confirmResolvedRound() {
    const statusBeforeConfirmation = gameState.status;
    const statusText = statusElement?.textContent ?? '';

    await syncUnfinishedBet({
      resetStackWhenNone: false,
      preserveResolvedWhenNone: true,
    });

    if (!gameState.betId && (statusBeforeConfirmation === 'won' || statusBeforeConfirmation === 'lost')) {
      gameState.status = statusBeforeConfirmation;
      setGameStatus(statusText);
    }
  }

  function handlePrimaryAction() {
    cameraSystem.resumeAutomaticFollow();
    if (gameState.betId) {
      void dropBlock();
      return;
    }

    void placeBet();
  }

  async function placeBet() {
    if (!settings || unfinishedGatePending || gameState.status === 'placing' || gameState.betId || !stackParts.length) {
      return;
    }

    const amountInput = amountElement?.value.trim() ?? '';
    const amount = Number(amountInput);
    const difficulty = getSelectedDifficulty();
    const clientSeed = clientSeedElement?.value.trim() ?? '';

    if (!Number.isFinite(amount) || amount <= 0) {
      highlightAmountInput();
      showError('Enter a valid bet amount.');
      return;
    }

    if (!hasAtMostTwoDecimalPlaces(amountInput)) {
      highlightAmountInput();
      showError('Bet amount can use at most two decimal places.');
      return;
    }

    if (amount < settings.minBet || amount > settings.maxBet) {
      highlightAmountInput();
      showError(
        `Bet amount must be ${formatAmount(settings.minBet, gameState.currency)}-${formatAmount(
          settings.maxBet,
          gameState.currency,
        )}.`,
      );
      return;
    }

    if (clientSeed.length < 1 || clientSeed.length > 32) {
      showError('Client seed must be 1-32 characters.');
      return;
    }

    gameState = {
      ...gameState,
      betAmount: amount,
      clientSeed,
      crashFloor: null,
      difficulty,
      error: null,
      maxFloor: settings.difficulties[difficulty].maxFloor,
      status: 'placing',
      winningAmount: 0,
    };
    updateControls();
    setGameStatus('Placing bet');

    try {
      const bet = await gameClient.placeBet({ amount, clientSeed, difficulty });
      applyPlacedBet(bet);
      restoreCompletedStack(0);
      setGameStatus(`Bet ${bet.betId} placed`);
    } catch (error) {
      const backendErrorType = getBackendErrorType(error);

      if (backendErrorType === 'BetAmountOutOfRangeErrorType') {
        highlightAmountInput();
        await refreshSettings();
      }

      if (backendErrorType === 'OpenBetExistsErrorType') {
        setGameStatus('Restoring open round');
        const restoredRound = await syncUnfinishedBet({
          resetStackWhenNone: false,
          preserveResolvedWhenNone: false,
        });

        if (!restoredRound) {
          showError('Open round exists, but it could not be restored.');
        }
        return;
      }

      const hasUnfinishedBet = await syncUnfinishedBet({
        resetStackWhenNone: false,
        preserveResolvedWhenNone: false,
      });

      if (!hasUnfinishedBet) {
        showError(getDisplayError(error));
      }
    } finally {
      updateControls();
    }
  }

  async function dropBlock() {
    if (unfinishedGatePending || !gameState.betId || gameState.status !== 'active' || activeDrop) {
      return;
    }

    gameState.status = 'dropping';
    gameState.error = null;
    updateControls();
    setGameStatus('Block in motion');

    try {
      const response = await gameClient.dropBlock(gameState.betId);
      const shouldCollapse = response.result === 'lost';

      await animateNextBlock(shouldCollapse);
      applyDropResponse(response);
      if (response.result === 'won' || response.result === 'lost') {
        await confirmResolvedRound();
      }
    } catch (error) {
      const hasUnfinishedBet = await syncUnfinishedBet({
        resetStackWhenNone: false,
        preserveResolvedWhenNone: false,
      });

      if (hasUnfinishedBet) {
        showError(getDisplayError(error));
      } else if (getBackendErrorType(error) !== 'NoOpenBetErrorType') {
        showError(getDisplayError(error));
      }
    } finally {
      updateControls();
    }
  }

  async function cashOut() {
    if (
      unfinishedGatePending ||
      collapseRecoveryPending ||
      !gameState.betId ||
      gameState.status !== 'active' ||
      gameState.completedFloorCount === 0
    ) {
      return;
    }

    gameState.status = 'cashingOut';
    gameState.error = null;
    updateControls();
    setGameStatus('Cashing out');

    try {
      const response = await gameClient.cashOut(gameState.betId);
      gameState = {
        ...gameState,
        balance: response.balance ?? gameState.balance,
        betId: null,
        clientSeed: response.clientSeed ?? gameState.clientSeed,
        completedFloorCount: response.completedFloorCount,
        crashFloor: response.crashFloor,
        currency: response.currency ?? gameState.currency,
        maxFloor: response.maxFloor,
        nonce: response.nonce ?? gameState.nonce,
        payoutMultiplier: Number(response.payoutMultiplier),
        serverSeedHash: response.serverSeedHash ?? gameState.serverSeedHash,
        status: 'won',
        winningAmount: Number(response.winningAmount),
      };
      resetStackPool({ clearSettledTransforms: true });
      collapseRecoveryPending = true;
      hangingLoadSystem.hideAssembly();
      cameraSystem.requestBaseReturn();
      setGameStatus(`Cashed out ${formatAmount(response.winningAmount, response.currency)}`);
      await confirmResolvedRound();
    } catch (error) {
      const hasUnfinishedBet = await syncUnfinishedBet({
        resetStackWhenNone: false,
        preserveResolvedWhenNone: false,
      });

      if (hasUnfinishedBet) {
        showError(getDisplayError(error));
      } else if (getBackendErrorType(error) !== 'NoOpenBetErrorType') {
        showError(getDisplayError(error));
      }
    } finally {
      updateControls();
    }
  }

  function resetRound() {
    collapsingBlocks.length = 0;
    resetInProgress = true;
    cameraSystem.requestBaseReturn();
    restoreCompletedStack(gameState.betId ? gameState.completedFloorCount : 0);

    if (!gameState.betId && (gameState.status === 'won' || gameState.status === 'lost')) {
      gameState = {
        ...gameState,
        completedFloorCount: 0,
        crashFloor: null,
        error: null,
        payoutMultiplier: 1,
        status: 'idle',
        winningAmount: 0,
      };
    }

    updateControls();
    setGameStatus('Resetting round');
  }

  function applyPlacedBet(bet) {
    gameState = {
      ...gameState,
      balance: bet.balance ?? gameState.balance,
      betAmount: Number(bet.betAmount),
      betId: bet.betId,
      clientSeed: bet.clientSeed,
      completedFloorCount: bet.currentFloorCount,
      crashFloor: null,
      currency: bet.currency,
      difficulty: bet.difficulty,
      error: null,
      maxFloor: bet.maxFloor,
      nonce: bet.nonce,
      payoutMultiplier: 1,
      serverSeedHash: bet.serverSeedHash,
      status: 'active',
      winningAmount: 0,
    };
  }

  function applyDropResponse(response) {
    if (response.result === 'lost') {
      gameState = {
        ...gameState,
        betId: null,
        clientSeed: response.clientSeed ?? gameState.clientSeed,
        completedFloorCount: response.completedFloorCount,
        crashFloor: response.crashFloor ?? response.attemptedFloor ?? null,
        maxFloor: response.maxFloor,
        nonce: response.nonce ?? gameState.nonce,
        payoutMultiplier: Number(response.payoutMultiplier),
        serverSeedHash: response.serverSeedHash ?? gameState.serverSeedHash,
        status: 'lost',
        winningAmount: Number(response.winningAmount ?? 0),
      };
      setGameStatus(`Crashed on floor ${response.attemptedFloor ?? response.crashFloor ?? '?'}`);
      return;
    }

    if (response.result === 'won') {
      gameState = {
        ...gameState,
        balance: response.balance ?? gameState.balance,
        betId: null,
        clientSeed: response.clientSeed ?? gameState.clientSeed,
        completedFloorCount: response.completedFloorCount,
        crashFloor: response.crashFloor ?? null,
        maxFloor: response.maxFloor,
        nonce: response.nonce ?? gameState.nonce,
        payoutMultiplier: Number(response.payoutMultiplier),
        serverSeedHash: response.serverSeedHash ?? gameState.serverSeedHash,
        status: 'won',
        winningAmount: Number(response.winningAmount ?? 0),
      };
      setGameStatus(`Auto won ${formatAmount(gameState.winningAmount, gameState.currency)}`);
      return;
    }

    gameState = {
      ...gameState,
      completedFloorCount: response.completedFloorCount,
      maxFloor: response.maxFloor,
      payoutMultiplier: Number(response.payoutMultiplier),
      status: 'active',
    };
    setGameStatus(`Floor ${response.completedFloorCount} safe`);
  }

  function updateControls() {
    const hasActiveBet = Boolean(gameState.betId);
    const isResolvedRound = !hasActiveBet && (gameState.status === 'won' || gameState.status === 'lost');
    const isBusy =
      introControlsLocked ||
      collapseRecoveryPending ||
      gameState.status === 'placing' ||
      gameState.status === 'dropping' ||
      gameState.status === 'cashingOut' ||
      unfinishedGatePending ||
      Boolean(activeDrop) ||
      collapsingBlocks.length > 0;
    const canPlace = Boolean(settings) && stackParts.length > 0 && !hasActiveBet && !isBusy && gameState.status !== 'error';
    const canDrop =
      hasActiveBet &&
      gameState.status === 'active' &&
      !isBusy &&
      stackIndex < gameState.maxFloor &&
      stackIndex < stackParts.length;
    const canCashOut =
      hasActiveBet &&
      gameState.status === 'active' &&
      gameState.completedFloorCount > 0 &&
      !isBusy;

    if (stackButton) {
      stackButton.disabled = hasActiveBet ? !canDrop : !canPlace;
      const isDropAction = hasActiveBet && (gameState.status === 'active' || gameState.status === 'dropping');
      stackButton.textContent = isDropAction ? 'Go' : 'Play';
    }

    if (cashOutButton) {
      cashOutButton.disabled = !canCashOut;
      const cashOutAmount = gameState.betAmount * gameState.payoutMultiplier;

      if (gameState.status === 'cashingOut') {
        cashOutButton.textContent = 'Cashing Out';
      } else if (hasActiveBet && gameState.completedFloorCount) {
        const amount = document.createElement('span');
        amount.className = 'cashout-button__amount';
        amount.textContent = formatPanelAmount(cashOutAmount, gameState.currency);
        const multiplier = document.createElement('span');
        multiplier.className = 'cashout-button__multiplier';
        multiplier.textContent = `(${gameState.payoutMultiplier.toFixed(3)}x)`;
        cashOutButton.replaceChildren(document.createTextNode('Cash Out'), amount, multiplier);
      } else {
        cashOutButton.textContent = 'Cash Out';
      }
    }

    if (resetRoundButton) {
      resetRoundButton.disabled = introControlsLocked || (resetInProgress && !isResolvedRound);
    }

    if (amountElement) {
      amountElement.disabled = hasActiveBet || isBusy;
    }

    if (difficultyElement) {
      difficultyElement.disabled = hasActiveBet || isBusy;
    }

    if (clientSeedElement) {
      clientSeedElement.disabled = hasActiveBet || isBusy;
    }

    if (cameraHeightElement) {
      cameraHeightElement.disabled = introControlsLocked;
    }

    if (resetButton) {
      resetButton.disabled = introControlsLocked;
    }

    if (fullscreenButton) {
      fullscreenButton.disabled = introControlsLocked;
    }

    if (balanceElement) {
      balanceElement.textContent =
        gameState.balance === null
          ? `${gameState.currency} --`
          : formatPanelAmount(gameState.balance, gameState.currency);
    }

    if (roundDetailsElement) {
      roundDetailsElement.textContent = getRoundDetailsText();
    }
  }

  function getRoundDetailsText() {
    if (gameState.error) {
      return gameState.error;
    }

    if (!gameState.betId && gameState.status !== 'won' && gameState.status !== 'lost') {
      return `Limits ${settings?.minBet ?? 0.1}-${settings?.maxBet ?? 100} ${gameState.currency}`;
    }

    const floorText = `${gameState.completedFloorCount}/${gameState.maxFloor} blocks`;

    if (gameState.status === 'lost') {
      return `${floorText} | Lost on block ${gameState.crashFloor ?? '?'} | ${gameState.currency}`;
    }

    if (gameState.status === 'won') {
      return `${floorText} | Won ${formatAmount(gameState.winningAmount, gameState.currency)}`;
    }

    return `${floorText} | ${gameState.payoutMultiplier.toFixed(3)}x | Bet ${formatAmount(
      gameState.betAmount,
      gameState.currency,
    )}`;
  }

  function getSelectedDifficulty() {
    const value = difficultyElement?.value;

    if (value === 'medium' || value === 'hard') {
      return value;
    }

    return 'easy';
  }

  function handleDifficultyChange() {
    if (!settings || gameState.betId) {
      return;
    }

    const difficulty = getSelectedDifficulty();
    gameState = {
      ...gameState,
      difficulty,
      maxFloor: settings.difficulties[difficulty].maxFloor,
    };
    updateControls();
  }

  function handleAmountInput() {
    amountElement?.classList.remove('field__input--error');
    updateControls();
  }

  function highlightAmountInput() {
    amountElement?.classList.add('field__input--error');
  }

  function showError(message) {
    gameState = {
      ...gameState,
      error: message,
      status: gameState.betId ? 'active' : 'idle',
    };
    setGameStatus(message);
    updateControls();
  }

  function setGameStatus(status) {
    if (statusElement) {
      statusElement.textContent = status;
    }
  }

  function handleCameraBaseReturnComplete() {
    if (collapseRecoveryPending) {
      mountNextStackPart();
      hangingLoadSystem.startIntroDescend(() => {
        collapseRecoveryPending = false;
        setGameStatus('Ready to place bet');
        updateControls();
      });
      setGameStatus('Next block incoming');
      updateControls();
      return;
    }

    if (resetInProgress) {
      resetInProgress = false;
      updateControls();
      setGameStatus(gameState.betId ? 'Ready for next block' : 'Ready to place bet');
      if (resetRoundButton) {
        resetRoundButton.disabled = false;
      }
      return;
    }

    updateControls();
  }

  function unlockIntroControls() {
    if (!introControlsLocked) {
      return;
    }

    introControlsLocked = false;
    updateControls();
  }

  async function setupFallingBlockStack(templatePromise) {
    stackParts = [];
    stackIndex = 0;
    activeDrop = null;

    const templateResults = await templatePromise;
    const failedTemplate = templateResults.find((result) => result.status === 'rejected');
    if (failedTemplate) {
      throw failedTemplate.reason;
    }

    const templates = templateResults
      .map((result) => result.value)
      .filter((template) => Boolean(template.object));

    if (!templates.length) {
      throw new Error('No usable falling block meshes were found.');
    }

    let nextTopY = stackAnchor.topY;

    for (let index = 0; index < TOTAL_STACK_BLOCKS; index += 1) {
      const template = templates[index % templates.length];
      const object = template.object.clone(true);
      const label = `Block ${index + 1} (${template.definition.label})`;

      object.name = label;
      prepareFallingBlockObject(object);
      getStackParent().add(object);
      object.visible = false;

      const finalY = placePartOnStack(object, nextTopY - STACK_VERTICAL_OVERLAP);
      const finalBox = getObjectParentSpaceBox(object);
      nextTopY = finalBox.max.y;

      stackParts.push({
        baseRotationX: object.rotation.x,
        baseRotationY: object.rotation.y,
        baseRotationZ: object.rotation.z,
        baseScale: object.scale.clone(),
        baseX: object.position.x,
        baseZ: object.position.z,
        finalY,
        label,
        object,
        topY: finalBox.max.y,
      });
    }

    resetStackPool({ clearSettledTransforms: true });
    if (gameState.completedFloorCount > 0) {
      restoreCompletedStack(gameState.completedFloorCount);
    } else {
      mountNextStackPart();
    }
    installStackDebugHelpers();
  }

  function placePartOnStack(object, targetBottomY) {
    return placeObjectParentBottomCenter(object, stackAnchor.center.x, stackAnchor.center.z, targetBottomY);
  }

  function getStackParent() {
    return stackAnchor.group ?? scene;
  }

  function attachPartToStack(part) {
    const parent = getStackParent();

    if (part.object.parent === parent) {
      return;
    }

    if (part.object.parent) {
      parent.attach(part.object);
    } else {
      parent.add(part.object);
    }
  }

  function getStackWorldPoint(localX, localY, localZ) {
    const point = new THREE.Vector3(localX, localY, localZ);
    return stackAnchor.group ? stackAnchor.group.localToWorld(point) : point;
  }

  function getMountedHangingBlockTopPoint() {
    if (!mountedStackPart || activeDrop) {
      return null;
    }

    mountedStackPart.object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mountedStackPart.object);

    if (box.isEmpty()) {
      return null;
    }

    const center = box.getCenter(new THREE.Vector3());
    return new THREE.Vector3(center.x, box.max.y, center.z);
  }

  function restoreCompletedStack(completedBlockCount) {
    const visibleCount = THREE.MathUtils.clamp(
      completedBlockCount,
      0,
      Math.min(gameState.maxFloor, stackParts.length),
    );
    let restoredTopY = stackAnchor.topY;

    resetStackPool({ clearSettledTransforms: visibleCount === 0 });

    for (let index = 0; index < visibleCount; index += 1) {
      const part = stackParts[index];
      const variation = getRestoredBlockVariation(index);
      attachPartToStack(part);
      part.object.visible = true;
      currentStackTopY = Math.max(currentStackTopY, applyCompletedPartTransform(part, index));
    }

    currentStackTopY = restoredTopY;

    stackIndex = visibleCount;
    mountNextStackPart();
    updateControls();
  }

  function resetStackPool({ clearSettledTransforms = false } = {}) {
    mountedStackPart = null;

    for (const part of stackParts) {
      attachPartToStack(part);
      if (clearSettledTransforms) {
        part.settledTransform = null;
      }

      part.object.visible = false;
      part.object.rotation.set(part.baseRotationX, part.baseRotationY, part.baseRotationZ);
      part.object.scale.copy(part.baseScale);
      placePartOnStack(part.object, part.finalY);
      part.object.updateMatrixWorld(true);
    }

    stackIndex = 0;
    activeDrop = null;
    blockHandoffInProgress = false;
    currentStackTopY = stackAnchor.topY;
    hangingLoadSystem.resetToBase();
    hangingLoadSystem.updateCarrierVisibility();
    effectsSystem.clearLandingImpact();
    effectsSystem.clearDustParticles();
    effectsSystem.clearSplashEffects();
  }

  function storeSettledPartTransform(part) {
    const box = getObjectParentSpaceBox(part.object);

    part.settledTransform = {
      position: part.object.position.clone(),
      rotation: part.object.rotation.clone(),
      scale: part.object.scale.clone(),
      topY: box.isEmpty() ? part.topY : box.max.y,
    };
  }

  function createRestoredSettledPartTransform(part, index) {
    const xRange = getLandingXRange(index);
    const finalX = part.baseX + getNonAlignedLandingXOffset(xRange, part.baseX, index);

    part.object.position.set(finalX, part.finalY, part.baseZ);
    part.object.rotation.set(part.baseRotationX, part.baseRotationY + getNonAlignedYRotation(), part.baseRotationZ);
    part.object.scale.copy(part.baseScale);
    part.object.updateMatrixWorld(true);
    storeSettledPartTransform(part);
    return part.settledTransform;
  }

  function applyCompletedPartTransform(part, index) {
    if (!part.settledTransform) {
      createRestoredSettledPartTransform(part, index);
    }

    const transform = part.settledTransform;

    if (transform) {
      part.object.position.copy(transform.position);
      part.object.rotation.copy(transform.rotation);
      part.object.scale.copy(transform.scale);
      part.object.updateMatrixWorld(true);
      return transform.topY;
    }

    return part.topY;
  }

  function mountNextStackPart({ snapHangingLoadToBase = true } = {}) {
    if (
      !hangingLoadSystem.hasLoad() ||
      activeDrop ||
      collapsingBlocks.length > 0 ||
      stackIndex >= stackParts.length ||
      stackIndex >= gameState.maxFloor
    ) {
      mountedStackPart = null;
      hangingLoadSystem.updateCarrierVisibility();
      return null;
    }

    const part = stackParts[stackIndex];
    if (mountedStackPart && mountedStackPart !== part && hangingLoadSystem.isHoldingObject(mountedStackPart.object)) {
      mountedStackPart.object.visible = false;
      attachPartToStack(mountedStackPart);
    }

    hangingLoadSystem.prepareForStackMount({ snapHangingLoadToBase });
    hangingLoadSystem.attachObject(part.object);

    part.object.visible = true;
    part.object.position.copy(hangingLoadSystem.getMountLocalPosition());
    part.object.rotation.set(part.baseRotationX, part.baseRotationY, part.baseRotationZ);
    part.object.scale.copy(part.baseScale);
    part.object.updateMatrixWorld(true);
    hangingLoadSystem.alignObjectToMagnetOrigin(part.object);
    mountedStackPart = part;
    hangingLoadSystem.updateCarrierVisibility();

    return part;
  }

  function detachMountedStackPart(part) {
    if (mountedStackPart === part) {
      mountedStackPart = null;
      hangingLoadSystem.updateCarrierVisibility();
    }

    if (part.object.parent !== scene) {
      scene.attach(part.object);
    }

    part.object.updateMatrixWorld(true);
    return getObjectBottomCenter(part.object);
  }

  function animateNextBlock(shouldCollapse) {
    if (activeDrop || stackIndex >= stackParts.length || stackIndex >= gameState.maxFloor) {
      return Promise.resolve();
    }

    const part = stackParts[stackIndex];
    const xRange = getLandingXRange();
    const finalX = part.baseX + getNonAlignedLandingXOffset(xRange, part.baseX);
    const finalZ = part.baseZ;

    return new Promise((resolve) => {
      blockHandoffInProgress = true;
      hangingLoadSystem.updateCarrierVisibility();
      const mountedPart = mountedStackPart === part ? mountedStackPart : mountNextStackPart();
      let startBottomCenter = null;

      if (mountedPart) {
        startBottomCenter = detachMountedStackPart(mountedPart);
      } else {
        const fallbackStartPoint = getStackWorldPoint(finalX, part.finalY + STACK_DROP_HEIGHT, finalZ);
        part.object.visible = true;
        placeObjectWorldBottomCenter(part.object, fallbackStartPoint.x, fallbackStartPoint.z, fallbackStartPoint.y);
        startBottomCenter = getObjectBottomCenter(part.object);
      }

      const startRotationX = part.object.rotation.x;
      const startRotationY = part.object.rotation.y;
      const startRotationZ = part.object.rotation.z;
      const finalRotationY = part.baseRotationY + getNonAlignedYRotation();
      currentStackTopY = Math.max(currentStackTopY, part.topY);
      activeDrop = {
        baseRotationX: part.baseRotationX,
        baseRotationZ: part.baseRotationZ,
        baseScale: part.object.scale.clone(),
        elapsed: 0,
        finalRotationY,
        finalX,
        finalZ,
        hasImpacted: false,
        onSettled: resolve,
        part,
        phase: 'falling',
        shouldCollapse,
        startBottomY: startBottomCenter.y,
        startRotationX,
        startRotationY,
        startRotationZ,
        startX: startBottomCenter.x,
        startZ: startBottomCenter.z,
        swingDirection: Math.random() < 0.5 ? -1 : 1,
        swingPhase: Math.random() * Math.PI * 2,
      };
      blockHandoffInProgress = false;
      stackIndex += 1;
      hangingLoadSystem.startRetract();
      hangingLoadSystem.updateCarrierVisibility();
      updateControls();
      setGameStatus('Block in motion');
    });
  }

  function getLandingXRange(partIndex = stackIndex) {
    const progress = THREE.MathUtils.clamp(
      partIndex / Math.max(STACK_RANDOM_DEVIATION_RAMP_BLOCKS, 1),
      0,
      1,
    );
    const rampedRange = THREE.MathUtils.lerp(
      STACK_RANDOM_X_RANGE,
      STACK_RANDOM_MAX_X_RANGE,
      progress,
    );
    const anchorRange = Number.isFinite(stackAnchor.halfWidthX) && stackAnchor.halfWidthX > 0
      ? stackAnchor.halfWidthX * 0.92
      : STACK_RANDOM_MAX_X_RANGE;

    return Math.min(rampedRange, anchorRange);
  }

  function randomThrillingXOffset(range) {
    const centeredOffset = THREE.MathUtils.randFloatSpread(range * 2);

    if (Math.random() > STACK_RANDOM_EDGE_BIAS) {
      return centeredOffset;
    }

    const direction = centeredOffset < 0 ? -1 : 1;
    const edgeAmount = THREE.MathUtils.lerp(0.62, 1, Math.random());
    return direction * range * edgeAmount;
  }

  function getNonAlignedLandingXOffset(range, baseX, partIndex = stackIndex) {
    const minOffset = Math.min(STACK_RANDOM_MIN_X_OFFSET, range * 0.75);
    const previousPart = stackParts[partIndex - 1];
    const previousX = previousPart?.settledTransform?.position?.x ?? previousPart?.object.position.x;
    const minPreviousDelta = Math.min(STACK_RANDOM_MIN_PREVIOUS_X_DELTA, range * 0.65);
    let bestOffset = randomThrillingXOffset(range);
    let bestScore = getLandingAlignmentScore(bestOffset, baseX, previousX, minOffset, minPreviousDelta);

    for (let attempt = 0; attempt < 18; attempt += 1) {
      const candidateOffset = randomThrillingXOffset(range);
      const candidateScore = getLandingAlignmentScore(candidateOffset, baseX, previousX, minOffset, minPreviousDelta);

      if (candidateScore <= 0) {
        return candidateOffset;
      }

      if (candidateScore < bestScore) {
        bestOffset = candidateOffset;
        bestScore = candidateScore;
      }
    }

    return pushLandingOffsetAwayFromAlignment(bestOffset, range, baseX, previousX, minOffset);
  }

  function getLandingAlignmentScore(offset, baseX, previousX, minOffset, minPreviousDelta) {
    const centerPenalty = Math.max(minOffset - Math.abs(offset), 0);

    if (!Number.isFinite(previousX)) {
      return centerPenalty;
    }

    const previousPenalty = Math.max(minPreviousDelta - Math.abs(baseX + offset - previousX), 0);
    return centerPenalty + previousPenalty;
  }

  function pushLandingOffsetAwayFromAlignment(offset, range, baseX, previousX, minOffset) {
    const previousRelativeX = Number.isFinite(previousX) ? previousX - baseX : 0;
    const fallbackDirection = Math.random() < 0.5 ? -1 : 1;
    const direction = previousRelativeX === 0 ? fallbackDirection : -Math.sign(previousRelativeX);
    const amount = Math.min(range, Math.max(Math.abs(offset), minOffset, range * 0.62));
    return direction * amount;
  }

  function getNonAlignedYRotation() {
    const maxRotation = THREE.MathUtils.degToRad(STACK_RANDOM_Y_ROTATION_DEGREES);
    const minRotation = THREE.MathUtils.degToRad(
      Math.min(STACK_RANDOM_MIN_Y_ROTATION_DEGREES, STACK_RANDOM_Y_ROTATION_DEGREES),
    );
    const direction = Math.random() < 0.5 ? -1 : 1;

    return direction * THREE.MathUtils.randFloat(minRotation, maxRotation);
  }

  function updateStackAnimation(delta) {
    if (!activeDrop) {
      return;
    }

    const drop = activeDrop;
    drop.elapsed += delta;

    const progress = Math.min(drop.elapsed / STACK_DROP_SECONDS, 1);
    const fallProgress = Math.min(progress / STACK_CONTACT_PROGRESS, 1);
    const gravityProgress = fallProgress * fallProgress;
    const finalPoint = getStackWorldPoint(drop.finalX, drop.part.finalY, drop.finalZ);
    const fallX = THREE.MathUtils.lerp(drop.startX, finalPoint.x, fallProgress);
    const fallZ = THREE.MathUtils.lerp(drop.startZ, finalPoint.z, fallProgress);
    const fallBottomY = THREE.MathUtils.lerp(drop.startBottomY, finalPoint.y, gravityProgress);
    const swing =
      THREE.MathUtils.degToRad(STACK_SWING_DEGREES) *
      Math.sin(drop.swingPhase + fallProgress * Math.PI * 2.2) *
      Math.pow(1 - fallProgress, 0.7);
    drop.part.object.rotation.x = THREE.MathUtils.lerp(drop.startRotationX, drop.baseRotationX, fallProgress) + swing;
    drop.part.object.rotation.y = THREE.MathUtils.lerp(drop.startRotationY, drop.finalRotationY, fallProgress);
    drop.part.object.rotation.z =
      THREE.MathUtils.lerp(drop.startRotationZ, drop.baseRotationZ, fallProgress) +
      swing * 0.55 * drop.swingDirection;
    placeObjectWorldBottomCenter(drop.part.object, fallX, fallZ, fallBottomY);

    if (progress >= STACK_CONTACT_PROGRESS) {
      if (!drop.hasImpacted) {
        drop.hasImpacted = true;
        void audioSystem.playContainerImpact();
        effectsSystem.triggerLandingImpact(drop.part, drop.shouldCollapse);
      }

      const impactProgress = (progress - STACK_CONTACT_PROGRESS) / (1 - STACK_CONTACT_PROGRESS);
      const compression = Math.sin(impactProgress * Math.PI) * STACK_IMPACT_COMPRESSION;
      drop.part.object.scale.set(
        drop.baseScale.x * (1 + compression * 0.45),
        drop.baseScale.y * (1 - compression),
        drop.baseScale.z * (1 + compression * 0.45),
      );
    }

    if (progress >= 1) {
      drop.part.object.rotation.x = drop.baseRotationX;
      drop.part.object.rotation.y = drop.finalRotationY;
      drop.part.object.rotation.z = drop.baseRotationZ;
      drop.part.object.scale.copy(drop.baseScale);
      const settledPoint = getStackWorldPoint(drop.finalX, drop.part.finalY, drop.finalZ);
      placeObjectWorldBottomCenter(drop.part.object, settledPoint.x, settledPoint.z, settledPoint.y);
      activeDrop = null;

      if (drop.shouldCollapse) {
        drop.part.object.rotation.z += THREE.MathUtils.degToRad(
          BAD_LANDING_TILT_DEGREES * (Math.random() < 0.5 ? -1 : 1),
        );
        collapseSettled = drop.onSettled;
        startTowerCollapse();
        return;
      }

      attachPartToStack(drop.part);
      drop.part.object.position.set(drop.finalX, drop.part.finalY, drop.finalZ);
      drop.part.object.rotation.set(drop.baseRotationX, drop.finalRotationY, drop.baseRotationZ);
      drop.part.object.scale.copy(drop.baseScale);
      drop.part.object.updateMatrixWorld(true);
      storeSettledPartTransform(drop.part);

      void hangingLoadSystem.settleAfterDrop(
        stackIndex < stackParts.length && stackIndex < gameState.maxFloor,
      ).then(() => {
        drop.onSettled();
        updateControls();
        setGameStatus(
          stackIndex >= stackParts.length || stackIndex >= gameState.maxFloor
            ? 'Blocks stacked'
            : 'Ready for next block',
        );
      });
    }
  }

  function startTowerCollapse() {
    collapsingBlocks.length = 0;
    cameraSystem.startCollapseFollow();

    for (const [index, part] of stackParts.slice(0, stackIndex).entries()) {
      if (!part.object.visible) {
        continue;
      }

      const startBox = new THREE.Box3().setFromObject(part.object);
      collapsingBlocks.push({
        angularVelocity: new THREE.Vector3(
          THREE.MathUtils.randFloatSpread(2.4),
          THREE.MathUtils.randFloatSpread(1.4),
          THREE.MathUtils.randFloatSpread(2.4),
        ),
        delay: (stackIndex - index - 1) * 0.025 + Math.random() * 0.08,
        hasSplashed: false,
        object: part.object,
        previousWaterBottomY: startBox.isEmpty() ? Number.POSITIVE_INFINITY : startBox.min.y,
        startY: part.object.position.y,
        velocity: new THREE.Vector3(
          THREE.MathUtils.randFloatSpread(3.5),
          Math.random() * 1.5,
          THREE.MathUtils.randFloatSpread(3.5),
        ),
      });
    }

    if (stackButton) {
      stackButton.disabled = true;
    }
    setGameStatus(`Block ${stackIndex} landed badly`);
  }

  function updateTowerCollapse(delta) {
    if (!collapsingBlocks.length) {
      return;
    }

    let visibleBlocks = 0;
    let totalFallDistance = 0;

    for (const block of collapsingBlocks) {
      if (!block.object.visible) {
        continue;
      }

      visibleBlocks += 1;
      block.delay -= delta;

      if (block.delay > 0) {
        totalFallDistance += Math.max(block.startY - block.object.position.y, 0);
        continue;
      }

      block.velocity.y -= COLLAPSE_GRAVITY * delta;
      block.object.position.addScaledVector(block.velocity, delta);
      block.object.rotation.x += block.angularVelocity.x * delta;
      block.object.rotation.y += block.angularVelocity.y * delta;
      block.object.rotation.z += block.angularVelocity.z * delta;
      totalFallDistance += Math.max(block.startY - block.object.position.y, 0);
      effectsSystem.maybeTriggerBlockWaterSplash(block);

      if (block.object.position.y < stackAnchor.topY - DESTROY_BELOW_GROUND_DISTANCE) {
        block.object.visible = false;
        block.object.removeFromParent();
      }
    }

    if (visibleBlocks > 0) {
      const averageFallDistance = totalFallDistance / visibleBlocks;
      cameraSystem.updateCollapseFollow(delta, averageFallDistance);
    }

    if (visibleBlocks === 0) {
      collapsingBlocks.length = 0;
      resetStackPool({ clearSettledTransforms: true });
      collapseRecoveryPending = true;
      hangingLoadSystem.hideAssembly();
      cameraSystem.requestBaseReturn();
      setGameStatus('Tower collapsed');
      if (stackButton) {
        stackButton.disabled = true;
        stackButton.textContent = 'Resetting';
      }
      collapseSettled?.();
      collapseSettled = null;
    }
  }

  function getStackBlockHeight() {
    const firstPart = stackParts[0];
    const secondPart = stackParts[1];

    if (firstPart && secondPart) {
      const measuredStep = secondPart.topY - firstPart.topY;

      if (measuredStep > 0) {
        return measuredStep;
      }
    }

    if (firstPart) {
      firstPart.object.updateMatrixWorld(true);
      const firstPartBox = new THREE.Box3().setFromObject(firstPart.object);

      if (!firstPartBox.isEmpty()) {
        return firstPartBox.max.y - firstPartBox.min.y;
      }
    }

    return CAMERA_TOP_PADDING;
  }

  function getIntroCameraStackTopY() {
    const introBlockCount = Math.min(gameState.maxFloor || stackParts.length, stackParts.length);

    if (introBlockCount > 0) {
      return stackParts[introBlockCount - 1].topY;
    }

    return currentStackTopY;
  }

  function updateFps(delta) {
    frameCount += 1;
    fpsTimer += delta;

    if (fpsTimer >= 0.5 && fpsElement) {
      fpsElement.textContent = `${Math.round(frameCount / fpsTimer)} fps`;
      frameCount = 0;
      fpsTimer = 0;
    }
  }

  function installStackDebugHelpers() {
    if (!import.meta.env.DEV) {
      return;
    }

    window.__dockyardDebug = {
      ...(window.__dockyardDebug ?? {}),
      getStackSnapshot: () => ({
        activeDrop: Boolean(activeDrop),
        anchorCenter: getStackWorldPoint(stackAnchor.center.x, stackAnchor.topY, stackAnchor.center.z).toArray(),
        anchorParentName: stackAnchor.group?.parent?.name ?? null,
        anchorTargetName: stackAnchor.targetName,
        blockScale: STACK_BLOCK_SCALE,
        completedBlockCount: gameState.completedFloorCount,
        dropPhase: activeDrop?.phase ?? null,
        hangingLoadPosition: hangingLoadSystem.getPivotPositionArray(),
        mountedBlock: mountedStackPart?.label ?? null,
        stackIndex,
        stackParts: stackParts.map((part) => {
          const worldPosition = new THREE.Vector3();
          part.object.getWorldPosition(worldPosition);

          return {
            label: part.label,
            parentName: part.object.parent?.name ?? null,
            position: part.object.position.toArray(),
            scale: part.object.scale.toArray(),
            topY: part.topY,
            visible: part.object.visible,
            worldPosition: worldPosition.toArray(),
          };
        }),
        status: gameState.status,
      }),
    };
  }

  function animate() {
    const deltaSeconds = clock.getDelta();
    const elapsedSeconds = clock.elapsedTime;
    const isIntroCameraActive = cameraSystem.updateIntro(deltaSeconds);
    truckFollowerSystem?.update(elapsedSeconds);
    floatingShipSystem.update(elapsedSeconds, deltaSeconds);
    hangingLoadSystem.update(elapsedSeconds, deltaSeconds);
    ambientLifeSystem.update(elapsedSeconds, deltaSeconds);
    updateWater(water, elapsedSeconds);
    updateStackAnimation(deltaSeconds);
    updateTowerCollapse(deltaSeconds);
    if (!isIntroCameraActive) {
      cameraSystem.updateBaseReturn(deltaSeconds);
      cameraSystem.updateHeight(deltaSeconds);
    }
    controls.update();
    updateImportedSkybox(importedSkybox, { camera, controls, elapsedSeconds });
    effectsSystem.updateDustParticles(deltaSeconds);
    effectsSystem.updateSplashEffects(deltaSeconds);
    cameraSystem.updateSlider();
    updateFps(deltaSeconds);
    effectsSystem.updateLandingScreenEffect(deltaSeconds);
    const shakeOffset = effectsSystem.getLandingShakeOffset(deltaSeconds);
    camera.position.add(shakeOffset);
    renderer.render(scene, camera);
    camera.position.sub(shakeOffset);
    requestAnimationFrame(animate);
  }

  const modelLoader = new GLTFLoader(loadingManager);
  modelLoader.setPath('/models/');
  preferReliableGltfTextureLoader(modelLoader);

  const craneMagnetPromise = modelLoader.loadAsync('Crane_Magnet.glb')
    .then((gltf) => gltf.scene)
    .catch((error) => {
      console.warn('Crane magnet failed to load; using the imported hanging assembly.', error);
      return null;
    });
  const fallingBlockTemplatePromise = Promise.allSettled(
    STACK_BLOCK_DEFINITIONS.map(async (definition) => {
      const gltf = await modelLoader.loadAsync(getAssetUrl(definition.url));
      return {
        definition,
        object: createFallingBlockTemplate(gltf.scene, definition),
      };
    }),
  );

  modelLoader.load(
    'dockyard.glb',
    async (gltf) => {
      setLoaderMessage('Preparing scene');
      modelRoot = gltf.scene;
      applyManualTextures(modelRoot, textureLoader);
      hideImportedSkyDomes(modelRoot);
      scene.add(modelRoot);
      importedSkybox = setupImportedSkybox(modelRoot, scene);
      cameraSystem.frameObject(modelRoot);
      updateImportedSkybox(importedSkybox, { camera, controls });
      water = setupWater(modelRoot, { scene, sunLight });
      truckFollowerSystem = createTruckFollowerSystem(modelRoot);
      floatingShipSystem.setup(modelRoot);
      const craneMagnet = await craneMagnetPromise;
      hangingLoadSystem.setup(modelRoot, craneMagnet);
      stackAnchor = measureDockyardStackAnchor(modelRoot, scene);
      currentStackTopY = stackAnchor.topY;
      setGameStatus('Loading stack blocks');

      try {
        await Promise.all([
          setupFallingBlockStack(fallingBlockTemplatePromise),
          ambientLifeSystem.load(modelLoader),
        ]);
        cameraSystem.frameBaseStackAtViewPosition();
        cameraSystem.startIntroAnimation();
        setGameStatus(gameState.betId ? 'Ready for next block' : 'Ready to place bet');
      } catch (error) {
        console.warn('Falling blocks failed to load.', error);
        setGameStatus('Dockyard loaded without stack blocks');
        cameraSystem.startIntroAnimation();
      }

      updateControls();
      hideLoader();
    },
    (event) => {
      if (!event.total) return;
      const progress = Math.round((event.loaded / event.total) * 100);
      setLoaderMessage(`Loading dockyard file ${progress}%`);
    },
    (error) => {
      console.error(error);
      setLoaderMessage('Dockyard model failed to load', true);
    }
  );

  resetButton?.addEventListener('click', cameraSystem.moveToStackTop);
  stackButton?.addEventListener('click', handlePrimaryAction);
  cashOutButton?.addEventListener('click', cashOut);
  resetRoundButton?.addEventListener('click', cameraSystem.moveToStackTop);
  cameraHeightElement?.addEventListener('input', cameraSystem.moveFromSlider);
  amountElement?.addEventListener('input', handleAmountInput);
  difficultyElement?.addEventListener('change', handleDifficultyChange);
  clientSeedElement?.addEventListener('input', updateControls);

  fullscreenButton?.addEventListener('click', async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  });

  howToPlayOpenButton?.addEventListener('click', () => howToPlayDialog?.showModal());
  howToPlayCloseButton?.addEventListener('click', () => howToPlayDialog?.close());
  howToPlayDialog?.addEventListener('click', (event) => {
    if (event.target === howToPlayDialog) howToPlayDialog.close();
  });

  window.addEventListener('resize', cameraSystem.resize);
  window.addEventListener('pointerdown', audioSystem.unlock, { once: true });
  window.addEventListener('keydown', audioSystem.unlock, { once: true });
  window.addEventListener('beforeunload', () => disconnectBalanceSocket?.(), { once: true });
  window.addEventListener('beforeunload', audioSystem.dispose, { once: true });
  void initializeGameSession();
  updateControls();
  animate();
}
