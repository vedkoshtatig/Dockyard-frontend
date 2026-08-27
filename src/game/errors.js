import { MegaBlockApiError } from '../services/megaBlockApi.js';

const BACKEND_ERROR_TYPES = [
  'OperatorSessionInvalidErrorType',
  'OriginalGameNotFoundErrorType',
  'OriginalGameNotAvailableErrorType',
  'BetAmountOutOfRangeErrorType',
  'InsufficientBalanceErrorType',
  'OpenBetExistsErrorType',
  'NoOpenBetErrorType',
  'MegaBlockNoFloorsCompletedErrorType',
  'WalletServiceUnavailableErrorType',
];

export function getBackendErrorType(error) {
  if (error instanceof MegaBlockApiError) {
    return error.backendErrorType;
  }

  if (!(error instanceof Error)) {
    return null;
  }

  return BACKEND_ERROR_TYPES.find((errorType) => error.message.includes(errorType)) ?? null;
}

export function getDisplayError(error) {
  return error instanceof Error ? error.message : 'MegaBlock request failed.';
}
