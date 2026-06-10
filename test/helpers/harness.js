/* eslint-env node */
// Drives TeslaPowerwallPlatform through one full construct -> discover cycle
// against the homebridge API mock and a fake HttpClient. Returns a snapshot of
// what the platform registered with homebridge so tests can assert.
'use strict';

const { createMockApi, Service, Characteristic } = require('../mocks/homebridge-api.js');
const { createFakeHttpClient } = require('../mocks/fake-http-client.js');

const { TeslaPowerwallPlatform } = require('../../dist/platform.js');

function silentLog() {
  const log = () => {};
  log.debug = () => {};
  log.info = () => {};
  log.warn = () => {};
  log.error = () => {};
  return log;
}

async function buildPlatform({ config = {}, fixtureOverrides = {}, log = silentLog() } = {}) {
  const api = createMockApi();
  const fakeHttpClient = createFakeHttpClient(fixtureOverrides);

  const resolvedConfig = {
    name: 'TeslaPowerwall',
    ip: '127.0.0.1',
    password: 'test-password',
    pollingInterval: 3600, // keep accessory polling timers from firing during tests
    ...config,
  };

  const platform = new TeslaPowerwallPlatform(log, resolvedConfig, api);

  // The real HttpClient starts a periodic auth setInterval inside its
  // constructor; tear it down and swap in the fake before discovery runs.
  if (platform.httpClient && typeof platform.httpClient.destroy === 'function') {
    platform.httpClient.destroy();
  }
  platform.httpClient = fakeHttpClient;

  await platform.discoverDevices();

  return { platform, api, fakeHttpClient, registered: api._registered };
}

function findAccessoryByDisplayName(api, displayName) {
  const hit = api._registered.find(({ accessory }) => accessory.displayName === displayName);
  return hit ? hit.accessory : undefined;
}

module.exports = {
  buildPlatform,
  findAccessoryByDisplayName,
  Service,
  Characteristic,
  silentLog,
};
