/* eslint-env mocha */
// Unit test for PowerwallAccessory lightbulb onSet handlers — guards against
// user changes to the read-only battery visualization reported in issue #21.
const assert = require('assert');

const { PowerwallAccessory } = require('../dist/accessories/powerwall.js');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeRecordingService(updates) {
  const svc = {
    setCharacteristic() { return svc; },
    getCharacteristic() {
      const chain = {
        onGet() { return chain; },
        onSet() { return chain; },
      };
      return chain;
    },
    updateCharacteristic(char, value) {
      updates.push({ char, value });
      return svc;
    },
  };
  return svc;
}

function buildAccessory() {
  const updates = [];
  const platform = {
    Service: { AccessoryInformation: {}, Battery: {}, Lightbulb: {} },
    Characteristic: {
      Manufacturer: 'Manufacturer',
      Model: 'Model',
      SerialNumber: 'SerialNumber',
      Name: 'Name',
      BatteryLevel: 'BatteryLevel',
      ChargingState: { NOT_CHARGING: 0, CHARGING: 1, NOT_CHARGEABLE: 2 },
      StatusLowBattery: { BATTERY_LEVEL_NORMAL: 0, BATTERY_LEVEL_LOW: 1 },
      On: 'On',
      Brightness: 'Brightness',
    },
    httpClient: {
      async getSystemStatus() { return { percentage: 73 }; },
      async getMetersAggregates() { return { battery: { instant_power: 0 } }; },
    },
    log: { debug() {}, error() {} },
    config: {},
  };

  const accessory = {
    UUID: 'test-uuid',
    displayName: 'Powerwall',
    getService() { return makeRecordingService(updates); },
    addService() { return makeRecordingService(updates); },
  };

  const pw = new PowerwallAccessory(platform, accessory);
  // Stop the polling timer started in the constructor so mocha can exit.
  pw.destroy();
  return { pw, updates };
}

describe('PowerwallAccessory lightbulb is read-only (issue #21)', function () {
  it('restores On=true when the user turns the lightbulb off', async function () {
    const { pw, updates } = buildAccessory();
    await pw.setLightbulbOn(false);
    await wait(150);
    assert.ok(
      updates.some((u) => u.char === 'On' && u.value === true),
      'expected On to be restored to true',
    );
  });

  it('does not push an update when On is set to true', async function () {
    const { pw, updates } = buildAccessory();
    await pw.setLightbulbOn(true);
    await wait(150);
    assert.ok(
      !updates.some((u) => u.char === 'On'),
      'expected no On update when value is already true',
    );
  });

  it('restores Brightness to the cached battery level when the user changes it', async function () {
    const { pw, updates } = buildAccessory();
    // Prime the cached battery level via the getter.
    await pw.getBatteryLevel();
    await pw.setLightbulbBrightness(10);
    await wait(150);
    assert.ok(
      updates.some((u) => u.char === 'Brightness' && u.value === 73),
      'expected Brightness to be restored to the battery level (73)',
    );
  });
});
