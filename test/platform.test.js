/* eslint-env mocha */
// End-to-end tests for the TeslaPowerwallPlatform discovery flow. Uses the
// harness under test/helpers to drive the real platform code against a mocked
// homebridge API and a fixture-backed HttpClient.
'use strict';

const assert = require('assert');

const {
  buildPlatform,
  findAccessoryByDisplayName,
  Service,
  Characteristic,
} = require('./helpers/harness.js');

const PLATFORM_NAME = 'TeslaPowerwall';
const PLUGIN_NAME = 'homebridge-tesla-powerwall';

describe('TeslaPowerwallPlatform discovery (default config)', function () {
  let result;

  before(async function () {
    result = await buildPlatform();
  });

  it('connects to the Powerwall before registering accessories', function () {
    assert.strictEqual(result.fakeHttpClient._calls.testConnection, 1);
  });

  it('registers all expected accessories', function () {
    const names = result.registered.map(({ accessory }) => accessory.displayName).sort();
    assert.deepStrictEqual(names, [
      'Tesla Powerwall',
      'Tesla Powerwall Grid',
      'Tesla Powerwall Grid Feeding',
      'Tesla Powerwall Grid Pulling',
      'Tesla Powerwall Grid Status',
      'Tesla Powerwall Load',
      'Tesla Powerwall Solar',
    ]);
  });

  it('registers under the correct plugin and platform names', function () {
    for (const entry of result.registered) {
      assert.strictEqual(entry.pluginName, PLUGIN_NAME);
      assert.strictEqual(entry.platformName, PLATFORM_NAME);
    }
  });
});

describe('Powerwall accessory', function () {
  let accessory;
  let result;

  before(async function () {
    result = await buildPlatform();
    accessory = findAccessoryByDisplayName(result.api, 'Tesla Powerwall');
    assert.ok(accessory, 'Powerwall accessory should be registered');
  });

  it('exposes Battery and Lightbulb services', function () {
    assert.ok(accessory.getService(Service.Battery), 'Battery service missing');
    assert.ok(accessory.getService(Service.Lightbulb), 'Lightbulb service missing');
  });

  it('reports battery level rounded from system_status percentage', async function () {
    const battery = accessory.getService(Service.Battery);
    const level = await battery.readCharacteristic(Characteristic.BatteryLevel);
    // Fixture percentage is 69.1675560298826 -> Math.round -> 69
    assert.strictEqual(level, 69);
  });

  it('reports lightbulb brightness as the raw unrounded percentage', async function () {
    const bulb = accessory.getService(Service.Lightbulb);
    const brightness = await bulb.readCharacteristic(Characteristic.Brightness);
    assert.strictEqual(brightness, 69.1675560298826);
  });

  it('reports lightbulb On as true', async function () {
    const bulb = accessory.getService(Service.Lightbulb);
    const on = await bulb.readCharacteristic(Characteristic.On);
    assert.strictEqual(on, true);
  });

  it('reports BATTERY_LEVEL_NORMAL when above the lowBattery threshold', async function () {
    const battery = accessory.getService(Service.Battery);
    const lowState = await battery.readCharacteristic(Characteristic.StatusLowBattery);
    assert.strictEqual(lowState, Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
  });

  it('reports BATTERY_LEVEL_LOW when below a custom threshold', async function () {
    const r = await buildPlatform({
      config: { lowBattery: 80 },
    });
    const acc = findAccessoryByDisplayName(r.api, 'Tesla Powerwall');
    const battery = acc.getService(Service.Battery);
    const lowState = await battery.readCharacteristic(Characteristic.StatusLowBattery);
    assert.strictEqual(lowState, Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);
  });
});

describe('GridStatus accessory', function () {
  it('reports CONTACT_DETECTED when grid_status is SystemGridConnected', async function () {
    const r = await buildPlatform();
    const acc = findAccessoryByDisplayName(r.api, 'Tesla Powerwall Grid Status');
    const sensor = acc.getService(Service.ContactSensor);
    const state = await sensor.readCharacteristic(Characteristic.ContactSensorState);
    assert.strictEqual(state, Characteristic.ContactSensorState.CONTACT_DETECTED);
  });

  it('reports CONTACT_NOT_DETECTED when grid is islanded', async function () {
    const r = await buildPlatform({
      fixtureOverrides: { gridStatus: { grid_status: 'SystemIslandedActive', grid_services_active: false } },
    });
    const acc = findAccessoryByDisplayName(r.api, 'Tesla Powerwall Grid Status');
    const sensor = acc.getService(Service.ContactSensor);
    const state = await sensor.readCharacteristic(Characteristic.ContactSensorState);
    assert.strictEqual(state, Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
  });
});

describe('Grid power sensors', function () {
  it('feeding sensor triggers when site.instant_power is well below -threshold', async function () {
    const r = await buildPlatform({
      fixtureOverrides: {
        metersAggregates: {
          site: { instant_power: -500 },
          battery: { instant_power: 0 },
          load: { instant_power: 0 },
          solar: { instant_power: 0 },
        },
      },
    });
    const acc = findAccessoryByDisplayName(r.api, 'Tesla Powerwall Grid Feeding');
    const sensor = acc.getService(Service.ContactSensor);
    const state = await sensor.readCharacteristic(Characteristic.ContactSensorState);
    assert.strictEqual(state, Characteristic.ContactSensorState.CONTACT_DETECTED);
  });

  it('pulling sensor triggers when site.instant_power is well above +threshold', async function () {
    const r = await buildPlatform({
      fixtureOverrides: {
        metersAggregates: {
          site: { instant_power: 500 },
          battery: { instant_power: 0 },
          load: { instant_power: 0 },
          solar: { instant_power: 0 },
        },
      },
    });
    const acc = findAccessoryByDisplayName(r.api, 'Tesla Powerwall Grid Pulling');
    const sensor = acc.getService(Service.ContactSensor);
    const state = await sensor.readCharacteristic(Characteristic.ContactSensorState);
    assert.strictEqual(state, Characteristic.ContactSensorState.CONTACT_DETECTED);
  });

  it('neither sensor triggers inside the configured noise band', async function () {
    const r = await buildPlatform({
      config: { gridSensorThreshold: 100 },
      fixtureOverrides: {
        metersAggregates: {
          site: { instant_power: 75 }, // within +/- 100W band
          battery: { instant_power: 0 },
          load: { instant_power: 0 },
          solar: { instant_power: 0 },
        },
      },
    });
    const feeding = findAccessoryByDisplayName(r.api, 'Tesla Powerwall Grid Feeding')
      .getService(Service.ContactSensor);
    const pulling = findAccessoryByDisplayName(r.api, 'Tesla Powerwall Grid Pulling')
      .getService(Service.ContactSensor);
    assert.strictEqual(
      await feeding.readCharacteristic(Characteristic.ContactSensorState),
      Characteristic.ContactSensorState.CONTACT_NOT_DETECTED,
    );
    assert.strictEqual(
      await pulling.readCharacteristic(Characteristic.ContactSensorState),
      Characteristic.ContactSensorState.CONTACT_NOT_DETECTED,
    );
  });
});

describe('Power meters', function () {
  it('maps load/solar/grid power to LightSensor lux at watts/10', async function () {
    const r = await buildPlatform();
    const cases = [
      { name: 'Tesla Powerwall Load', expectedLux: Math.abs(1546.27) / 10 },
      { name: 'Tesla Powerwall Solar', expectedLux: Math.abs(3906.17) / 10 },
      { name: 'Tesla Powerwall Grid', expectedLux: Math.abs(-21.45) / 10 },
    ];
    for (const c of cases) {
      const acc = findAccessoryByDisplayName(r.api, c.name);
      const sensor = acc.getService(Service.LightSensor);
      const lux = await sensor.readCharacteristic(Characteristic.CurrentAmbientLightLevel);
      assert.ok(
        Math.abs(lux - c.expectedLux) < 1e-6,
        `${c.name}: got ${lux}, expected ${c.expectedLux}`,
      );
    }
  });
});

describe('Config gates for optional accessories', function () {
  it('skips grid status when enableGridStatus is false', async function () {
    const r = await buildPlatform({ config: { enableGridStatus: false } });
    assert.strictEqual(findAccessoryByDisplayName(r.api, 'Tesla Powerwall Grid Status'), undefined);
  });

  it('skips grid power sensors when enableGridPowerSensors is false', async function () {
    const r = await buildPlatform({ config: { enableGridPowerSensors: false } });
    assert.strictEqual(findAccessoryByDisplayName(r.api, 'Tesla Powerwall Grid Feeding'), undefined);
    assert.strictEqual(findAccessoryByDisplayName(r.api, 'Tesla Powerwall Grid Pulling'), undefined);
  });

  it('skips power meters when enablePowerMeters is false', async function () {
    const r = await buildPlatform({ config: { enablePowerMeters: false } });
    assert.strictEqual(findAccessoryByDisplayName(r.api, 'Tesla Powerwall Solar'), undefined);
    assert.strictEqual(findAccessoryByDisplayName(r.api, 'Tesla Powerwall Grid'), undefined);
    assert.strictEqual(findAccessoryByDisplayName(r.api, 'Tesla Powerwall Load'), undefined);
  });

  it('still registers the main Powerwall when everything else is disabled', async function () {
    const r = await buildPlatform({
      config: {
        enableGridStatus: false,
        enableGridPowerSensors: false,
        enablePowerMeters: false,
      },
    });
    const names = r.registered.map(({ accessory }) => accessory.displayName);
    assert.deepStrictEqual(names, ['Tesla Powerwall']);
  });
});

describe('Discovery failure handling', function () {
  it('does not register any accessories when the Powerwall is unreachable', async function () {
    const r = await buildPlatform({ fixtureOverrides: { connected: false } });
    assert.strictEqual(r.registered.length, 0);
  });
});
