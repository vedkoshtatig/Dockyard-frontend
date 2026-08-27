export function getUiElements() {
  return {
    amountElement: document.querySelector('#bet-amount'),
    balanceElement: document.querySelector('#balance'),
    cameraHeightElement: document.querySelector('#camera-height'),
    canvas: document.querySelector('#scene'),
    cashOutButton: document.querySelector('#cash-out'),
    clientSeedElement: document.querySelector('#client-seed'),
    dataModeElement: document.querySelector('#data-mode'),
    difficultyElement: document.querySelector('#difficulty'),
    fpsElement: document.querySelector('#fps'),
    fullscreenButton: document.querySelector('#fullscreen'),
    loaderEl: document.querySelector('#loader'),
    resetButton: document.querySelector('#reset-view'),
    resetRoundButton: document.querySelector('#reset-round'),
    roundDetailsElement: document.querySelector('#round-details'),
    stackButton: document.querySelector('#primary-action'),
    statusElement: document.querySelector('#status'),
  };
}
