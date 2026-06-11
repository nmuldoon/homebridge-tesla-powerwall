/* eslint-env mocha */
// Unit test for PowerwallAccessory.getChargingState — guards against the
// sign inversion reported in issue #10.
const assert = require('assert');

const { PowerwallAccessory } = require('../dist/accessories/powerwall.js');

const ChargingState = {
  NOT_CHARGING: 0,
  CHARGING: 1,
  NOT_CHARGEABLE: 2,
};

function makeService() {
  const svc = {
    setCharacteristic() { return svc; },
    getCharacteristic() {
      const chain = { onGet() { return chain; }, onSet() { return chain; } };
      return chain;
    },
    updateCharacteristic() { return svc; },
  };
  return svc;
}

function buildAccessoryWithPower(batteryPower) {
  const platform = {
    Service: { AccessoryInformation: {}, Battery: {}, Lightbulb: {} },
    Characteristic: {
      Manufacturer: 'Manufacturer',
      Model: 'Model',
      SerialNumber: 'SerialNumber',
      Name: 'Name',
      BatteryLevel: 'BatteryLevel',
      ChargingState,
      StatusLowBattery: { BATTERY_LEVEL_NORMAL: 0, BATTERY_LEVEL_LOW: 1 },
      On: 'On',
      Brightness: 'Brightness',
    },
    httpClient: {
      async getMetersAggregates() {
        return { battery: { instant_power: batteryPower } };
      },
    },
    log: { debug() {}, error() {} },
    config: {},
  };

  const accessory = {
    UUID: 'test-uuid',
    displayName: 'Powerwall',
    getService() { return makeService(); },
    addService() { return makeService(); },
  };

  const pw = new PowerwallAccessory(platform, accessory);
  // Stop the polling timer started in the constructor so mocha can exit.
  pw.destroy();
  return pw;
}

describe('PowerwallAccessory.getChargingState (issue #10)', function () {
  it('reports CHARGING when battery power is sufficiently negative', async function () {
    const pw = buildAccessoryWithPower(-2350);
    assert.strictEqual(await pw.getChargingState(), ChargingState.CHARGING);
  });

  it('reports NOT_CHARGING when battery power is positive (discharging)', async function () {
    const pw = buildAccessoryWithPower(2350);
    assert.strictEqual(await pw.getChargingState(), ChargingState.NOT_CHARGING);
  });

  it('reports NOT_CHARGING within the +/-50W noise band', async function () {
    for (const power of [-50, -10, 0, 10, 50]) {
      const pw = buildAccessoryWithPower(power);
      assert.strictEqual(
        await pw.getChargingState(),
        ChargingState.NOT_CHARGING,
        `expected NOT_CHARGING at ${power}W`,
      );
    }
  });

  it('reports CHARGING just past the -50W threshold', async function () {
    const pw = buildAccessoryWithPower(-51);
    assert.strictEqual(await pw.getChargingState(), ChargingState.CHARGING);
  });
});
