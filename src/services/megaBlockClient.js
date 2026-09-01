import { appEnv } from '../config/env.js';
import { MegaBlockApiClient } from './megaBlockApi.js';
import { MockMegaBlockClient } from './mockMegaBlockApi.js';

export function createMegaBlockClient() {
  return appEnv.useMockData
    ? new MockMegaBlockClient()
    : new MegaBlockApiClient({
      baseUrl: appEnv.apiBaseUrl,
      endpoints: appEnv.endpoints,
      timeoutMs: appEnv.apiTimeoutMs,
    });
}

export function getMegaBlockDataMode() {
  return appEnv.useMockData ? 'mock' : 'api';
}
