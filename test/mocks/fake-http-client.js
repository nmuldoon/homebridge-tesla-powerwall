/* eslint-env node */
// Fixture-driven double for HttpClient. The plugin uses duck-typed access
// through `platform.httpClient.<method>()`, so we only need to implement the
// methods the accessories call.
'use strict';

const path = require('path');
const fs = require('fs');

function loadFixture(name) {
  const file = path.join(__dirname, '..', 'fixtures', name);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function createFakeHttpClient(overrides = {}) {
  const data = {
    metersAggregates: loadFixture('meters-aggregates.json'),
    systemStatus: loadFixture('system-status-soe.json'),
    gridStatus: loadFixture('grid-status.json'),
    connected: true,
    ...overrides,
  };

  // Track calls so tests can assert traffic when relevant.
  const calls = { getSystemStatus: 0, getMetersAggregates: 0, getGridStatus: 0, testConnection: 0 };

  return {
    _calls: calls,
    _data: data,
    async testConnection() { calls.testConnection += 1; return data.connected; },
    async getSystemStatus() { calls.getSystemStatus += 1; return data.systemStatus; },
    async getMetersAggregates() { calls.getMetersAggregates += 1; return data.metersAggregates; },
    async getGridStatus() { calls.getGridStatus += 1; return data.gridStatus; },
    async getSiteMaster() { return {}; },
    destroy() {},
  };
}

module.exports = { createFakeHttpClient, loadFixture };
