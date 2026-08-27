export class MegaBlockApiError extends Error {
  constructor(status, payload) {
    const backendErrorType = getBackendErrorType(payload);
    const errorCode = payload?.errorCode ?? null;

    super(getApiErrorMessage(payload, backendErrorType, errorCode));
    this.name = 'MegaBlockApiError';
    this.backendErrorType = backendErrorType;
    this.errorCode = errorCode;
    this.fields = payload?.fields ?? {};
    this.status = status;
  }
}

export class MegaBlockApiClient {
  constructor(config) {
    const options = typeof config === 'string' ? { baseUrl: config } : config;
    this.token = null;
    this.apiBaseUrl = options.baseUrl.replace(/\/$/, '');
    this.endpoints = options.endpoints;
  }

  async launch(request) {
    const response = await this.post('launch', request, false);
    this.token = response.token;
    return response;
  }

  getSettings() {
    return this.get('settings');
  }

  getUnfinishedBet() {
    return this.get('unfinishedBet');
  }

  placeBet(request) {
    return this.post('placeBet', request);
  }

  dropBlock(betId) {
    return this.post('dropBlock', { betId: String(betId) });
  }

  cashOut(betId) {
    return this.post('cashOut', { betId: String(betId) });
  }

  getBets(page = 1, perPage = 10) {
    const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
    return this.requestUrl(appendQuery(this.urlFor('bets'), params), { method: 'GET' });
  }

  getBetById(betId) {
    return this.get('betById', { betId });
  }

  getProvablyFairState() {
    return this.get('provablyFairState');
  }

  rotateProvablyFairSeed() {
    return this.post('provablyFairRotateSeed', {});
  }

  verifyProvablyFairBet(betId, gameKey = 'mega-block') {
    return this.post('provablyFairVerify', { betId: String(betId), gameKey });
  }

  get(endpointName, pathParams = {}) {
    return this.requestUrl(this.urlFor(endpointName, pathParams), { method: 'GET' });
  }

  post(endpointName, body, includeAuth = true, pathParams = {}) {
    return this.requestUrl(
      this.urlFor(endpointName, pathParams),
      {
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      },
      includeAuth,
    );
  }

  async requestUrl(url, init, includeAuth = true) {
    const headers = new Headers(init.headers);

    if (includeAuth) {
      if (!this.token) {
        throw new Error('MegaBlock session has not launched yet.');
      }

      headers.set('Authorization', `AccessToken=${this.token}`);
    }

    const response = await fetch(url, {
      ...init,
      headers,
    });

    let envelope;

    try {
      envelope = await response.json();
    } catch {
      throw new Error(`MegaBlock API returned ${response.status} without JSON.`);
    }

    if (!response.ok || (envelope.errors?.length ?? 0) > 0) {
      throw new MegaBlockApiError(response.status, envelope.errors?.[0]);
    }

    return envelope.data;
  }

  urlFor(endpointName, pathParams = {}) {
    const endpoint = this.endpoints?.[endpointName];

    if (!endpoint) {
      throw new Error(`Missing MegaBlock endpoint config for ${endpointName}.`);
    }

    let resolvedEndpoint = endpoint;

    for (const [key, value] of Object.entries(pathParams)) {
      resolvedEndpoint = resolvedEndpoint.replace(`:${key}`, encodeURIComponent(String(value)));
    }

    if (/^https?:\/\//i.test(resolvedEndpoint)) {
      return resolvedEndpoint;
    }

    return `${this.apiBaseUrl}${resolvedEndpoint.startsWith('/') ? '' : '/'}${resolvedEndpoint}`;
  }
}

function appendQuery(url, params) {
  const query = params.toString();

  if (!query) {
    return url;
  }

  return `${url}${url.includes('?') ? '&' : '?'}${query}`;
}

function getApiErrorMessage(payload, backendErrorType, errorCode) {
  if (backendErrorType) {
    return backendErrorType;
  }

  if (payload?.message) {
    return payload.message;
  }

  return errorCode ? `MegaBlock API error ${errorCode}` : 'MegaBlock API request failed.';
}

function getBackendErrorType(payload) {
  const fields = payload?.fields;
  const candidates = [
    payload?.type,
    payload?.name,
    fields?.errorType,
    fields?.type,
    fields?.name,
    fields?.error,
    fields?.code,
    payload?.message,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.endsWith('ErrorType')) {
      return candidate;
    }
  }

  return null;
}
