const SOUND_URLS = {
  containerImpact: '/sounds/container-drop-sound.mp3',
  horn: '/sounds/main-ship-horn.mp3',
  sea: '/sounds/sea-alltime-bg.mp3',
  seagull: '/sounds/seagul.mp3',
};

// Edit these values (0 = silent, 1 = full volume) to tune each sound.
export const DOCKYARD_AUDIO_VOLUMES = {
  containerImpact: 0.05,
  horn: 0.28,
  seaBase: 0.07,
  seaSwell: 0.14,
  seagull: 0.18,
};

// Edit these values (in seconds) to control sound length and frequency.
export const DOCKYARD_AUDIO_TIMING_SECONDS = {
  hornIntervalMin: 28,
  hornIntervalMax: 58,
  queuedSoundGap: 0.9,
  seaSwellDurationMin: 3.5,
  seaSwellDurationMax: 10,
  seaSwellIntervalMin: 18,
  seaSwellIntervalMax: 42,
  seagullDurationMin: 4,
  seagullDurationMax: 10,
  seagullIntervalMin: 15,
  seagullIntervalMax: 30,
};

export function createDockyardAudioSystem() {
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextClass) return createSilentAudioSystem();

  const context = new AudioContextClass();
  const buffers = new Map();
  const pendingAmbientSounds = [];
  let ambientSource = null;
  let ambientStarting = false;
  let ambientTimer = null;
  let seaSource = null;
  let seaGain = null;
  let seaSwellTimer = null;
  let seagullSource = null;
  let seagullTimer = null;
  let isDisposed = false;
  let isUnlocked = false;

  for (const [name, url] of Object.entries(SOUND_URLS)) {
    buffers.set(name, loadAudioBuffer(context, url));
  }

  async function unlock() {
    if (isUnlocked || isDisposed) return;
    await context.resume();
    isUnlocked = context.state === 'running';
    if (!isUnlocked) return;
    void startSeaAmbience();
    scheduleSeagullSound();
    playNextPendingAmbientOrSchedule();
  }

  async function playContainerImpact() {
    if (!isUnlocked || context.state !== 'running' || isDisposed) return;
    const buffer = await buffers.get('containerImpact');
    if (buffer) playBuffer(context, buffer, DOCKYARD_AUDIO_VOLUMES.containerImpact);
  }

  function playHorn() {
    requestEventAmbient('horn');
  }

  function requestEventAmbient(soundName) {
    if (isDisposed) return;
    window.clearTimeout(ambientTimer);
    ambientTimer = null;
    if (!isUnlocked || ambientSource || ambientStarting) {
      if (pendingAmbientSounds.at(-1) !== soundName) pendingAmbientSounds.push(soundName);
      return;
    }
    void startAmbientSound(soundName);
  }

  function scheduleRandomAmbientSound() {
    if (isDisposed || !isUnlocked || ambientSource || ambientStarting || pendingAmbientSounds.length) return;
    window.clearTimeout(ambientTimer);
    ambientTimer = window.setTimeout(() => {
      ambientTimer = null;
      if (document.hidden) {
        scheduleRandomAmbientSound();
        return;
      }
      void startAmbientSound('horn');
    }, randomSecondsAsMilliseconds(
      DOCKYARD_AUDIO_TIMING_SECONDS.hornIntervalMin,
      DOCKYARD_AUDIO_TIMING_SECONDS.hornIntervalMax,
    ));
  }

  async function startAmbientSound(soundName) {
    if (!isUnlocked || isDisposed || ambientSource || ambientStarting) {
      if (!isDisposed && pendingAmbientSounds.at(-1) !== soundName) pendingAmbientSounds.push(soundName);
      return;
    }
    ambientStarting = true;
    const buffer = await buffers.get(soundName);
    ambientStarting = false;
    if (!buffer || ambientSource || isDisposed) {
      playNextPendingAmbientOrSchedule();
      return;
    }

    ambientSource = playBuffer(context, buffer, DOCKYARD_AUDIO_VOLUMES.horn);
    ambientSource.addEventListener('ended', () => {
      ambientSource = null;
      window.setTimeout(
        playNextPendingAmbientOrSchedule,
        DOCKYARD_AUDIO_TIMING_SECONDS.queuedSoundGap * 1000,
      );
    }, { once: true });
  }

  function playNextPendingAmbientOrSchedule() {
    if (isDisposed || !isUnlocked || ambientSource || ambientStarting) return;
    const nextSound = pendingAmbientSounds.shift();
    if (nextSound) void startAmbientSound(nextSound);
    else scheduleRandomAmbientSound();
  }

  async function startSeaAmbience() {
    if (seaSource || isDisposed) return;
    const buffer = await buffers.get('sea');
    if (!buffer || seaSource || isDisposed) return;

    seaSource = context.createBufferSource();
    seaGain = context.createGain();
    seaSource.buffer = buffer;
    seaSource.loop = true;
    seaGain.gain.value = DOCKYARD_AUDIO_VOLUMES.seaBase;
    seaSource.connect(seaGain).connect(context.destination);
    seaSource.start();
    scheduleSeaSwell();
  }

  function scheduleSeaSwell() {
    window.clearTimeout(seaSwellTimer);
    seaSwellTimer = window.setTimeout(() => {
      if (!seaGain || isDisposed) return;
      const now = context.currentTime;
      const swellSeconds = randomBetween(
        DOCKYARD_AUDIO_TIMING_SECONDS.seaSwellDurationMin,
        DOCKYARD_AUDIO_TIMING_SECONDS.seaSwellDurationMax,
      );
      seaGain.gain.cancelScheduledValues(now);
      seaGain.gain.setValueAtTime(seaGain.gain.value, now);
      seaGain.gain.linearRampToValueAtTime(DOCKYARD_AUDIO_VOLUMES.seaSwell, now + 1.2);
      seaGain.gain.linearRampToValueAtTime(DOCKYARD_AUDIO_VOLUMES.seaBase, now + swellSeconds);
      scheduleSeaSwell();
    }, randomSecondsAsMilliseconds(
      DOCKYARD_AUDIO_TIMING_SECONDS.seaSwellIntervalMin,
      DOCKYARD_AUDIO_TIMING_SECONDS.seaSwellIntervalMax,
    ));
  }

  function scheduleSeagullSound() {
    window.clearTimeout(seagullTimer);
    seagullTimer = window.setTimeout(() => {
      if (document.hidden || seagullSource || isDisposed) {
        scheduleSeagullSound();
        return;
      }
      void playShortSeagullSound();
    }, randomSecondsAsMilliseconds(
      DOCKYARD_AUDIO_TIMING_SECONDS.seagullIntervalMin,
      DOCKYARD_AUDIO_TIMING_SECONDS.seagullIntervalMax,
    ));
  }

  async function playShortSeagullSound() {
    const buffer = await buffers.get('seagull');
    if (!buffer || seagullSource || isDisposed || !isUnlocked) {
      scheduleSeagullSound();
      return;
    }

    seagullSource = playBuffer(context, buffer, DOCKYARD_AUDIO_VOLUMES.seagull);
    const playSeconds = Math.min(buffer.duration, randomBetween(
      DOCKYARD_AUDIO_TIMING_SECONDS.seagullDurationMin,
      DOCKYARD_AUDIO_TIMING_SECONDS.seagullDurationMax,
    ));
    seagullSource.stop(context.currentTime + playSeconds);
    seagullSource.addEventListener('ended', () => {
      seagullSource = null;
      scheduleSeagullSound();
    }, { once: true });
  }

  function dispose() {
    isDisposed = true;
    window.clearTimeout(ambientTimer);
    window.clearTimeout(seaSwellTimer);
    window.clearTimeout(seagullTimer);
    ambientSource?.stop();
    seaSource?.stop();
    seagullSource?.stop();
    ambientSource = null;
    seaSource = null;
    seagullSource = null;
    void context.close();
  }

  return { dispose, playContainerImpact, playHorn, unlock };
}

async function loadAudioBuffer(context, url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Audio request returned ${response.status}`);
    return await context.decodeAudioData(await response.arrayBuffer());
  } catch (error) {
    console.warn(`Unable to load ${url}.`, error);
    return null;
  }
}

function playBuffer(context, buffer, volume) {
  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  gain.gain.value = volume;
  source.connect(gain).connect(context.destination);
  source.start();
  return source;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomSecondsAsMilliseconds(minSeconds, maxSeconds) {
  return randomBetween(minSeconds, maxSeconds) * 1000;
}

function createSilentAudioSystem() {
  return {
    dispose() {},
    playContainerImpact() {},
    playHorn() {},
    unlock() {},
  };
}
