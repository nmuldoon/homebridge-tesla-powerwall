/* eslint-env node */
// Minimal homebridge API mock sufficient to drive TeslaPowerwallPlatform end
// to end. Only models the surface actually used by the plugin: hap.Service,
// hap.Characteristic, hap.uuid.generate, platformAccessory, the
// register/unregisterPlatformAccessories pair, and the EventEmitter contract
// for the didFinishLaunching lifecycle event.
'use strict';

const { EventEmitter } = require('events');
const crypto = require('crypto');

// HAP services and characteristics are referenced by identity (===), so we
// just need unique marker objects with .UUID strings.
function makeService(name) {
  function ServiceCtor() {}
  ServiceCtor.UUID = name;
  ServiceCtor.serviceName = name;
  return ServiceCtor;
}

const Service = {
  AccessoryInformation: makeService('AccessoryInformation'),
  Battery: makeService('Battery'),
  Lightbulb: makeService('Lightbulb'),
  ContactSensor: makeService('ContactSensor'),
  LightSensor: makeService('LightSensor'),
};

// Characteristic constants the plugin reads.
const Characteristic = {
  Manufacturer: 'Manufacturer',
  Model: 'Model',
  SerialNumber: 'SerialNumber',
  Name: 'Name',
  BatteryLevel: 'BatteryLevel',
  ChargingState: Object.assign('ChargingState', {
    NOT_CHARGING: 0,
    CHARGING: 1,
    NOT_CHARGEABLE: 2,
  }),
  StatusLowBattery: Object.assign('StatusLowBattery', {
    BATTERY_LEVEL_NORMAL: 0,
    BATTERY_LEVEL_LOW: 1,
  }),
  On: 'On',
  Brightness: 'Brightness',
  ContactSensorState: Object.assign('ContactSensorState', {
    CONTACT_DETECTED: 0,
    CONTACT_NOT_DETECTED: 1,
  }),
  CurrentAmbientLightLevel: 'CurrentAmbientLightLevel',
};

// Characteristic.ChargingState etc. need to be referenced by .CONSTANT and
// also compared as values. String keys with attached constants work because
// Object.assign on a primitive returns a String wrapper.
Object.keys(Characteristic).forEach((k) => {
  const v = Characteristic[k];
  if (typeof v === 'string') {
    Characteristic[k] = v; // already fine
  }
});

class ServiceInstance {
  constructor(serviceType, displayName) {
    this.UUID = serviceType.UUID;
    this.serviceType = serviceType;
    this.displayName = displayName;
    this.characteristics = new Map(); // characteristic key -> { value, getHandler }
  }

  _ensureCharacteristic(key) {
    if (!this.characteristics.has(String(key))) {
      this.characteristics.set(String(key), { value: undefined, getHandler: undefined });
    }
    return this.characteristics.get(String(key));
  }

  setCharacteristic(key, value) {
    const c = this._ensureCharacteristic(key);
    c.value = value;
    return this;
  }

  updateCharacteristic(key, value) {
    const c = this._ensureCharacteristic(key);
    c.value = value;
    return this;
  }

  getCharacteristic(key) {
    const c = this._ensureCharacteristic(key);
    return {
      onGet: (handler) => {
        c.getHandler = handler;
        return this;
      },
      value: c.value,
    };
  }

  async readCharacteristic(key) {
    const c = this._ensureCharacteristic(key);
    if (typeof c.getHandler === 'function') {
      return await c.getHandler();
    }
    return c.value;
  }
}

class PlatformAccessory {
  constructor(displayName, uuid) {
    this.displayName = displayName;
    this.UUID = uuid;
    this.context = {};
    this.services = new Map(); // serviceType.UUID -> ServiceInstance
    // Real homebridge auto-adds AccessoryInformation; mirror that.
    this.services.set(
      Service.AccessoryInformation.UUID,
      new ServiceInstance(Service.AccessoryInformation, displayName),
    );
  }

  getService(serviceType) {
    if (!serviceType) return undefined;
    return this.services.get(serviceType.UUID);
  }

  addService(serviceType) {
    const existing = this.services.get(serviceType.UUID);
    if (existing) return existing;
    const svc = new ServiceInstance(serviceType, this.displayName);
    this.services.set(serviceType.UUID, svc);
    return svc;
  }

  getServiceByType(serviceType) {
    return this.getService(serviceType);
  }
}

function createMockApi() {
  const emitter = new EventEmitter();
  const registered = []; // [{pluginName, platformName, accessory}]
  const unregistered = [];
  let platformRegistration = null;

  const uuid = {
    generate(input) {
      const hash = crypto.createHash('sha1').update(String(input)).digest('hex');
      return [
        hash.slice(0, 8),
        hash.slice(8, 12),
        hash.slice(12, 16),
        hash.slice(16, 20),
        hash.slice(20, 32),
      ].join('-');
    },
  };

  const api = {
    hap: { Service, Characteristic, uuid },
    platformAccessory: PlatformAccessory,
    on(event, listener) { emitter.on(event, listener); return api; },
    off(event, listener) { emitter.off(event, listener); return api; },
    emit(event, ...args) { return emitter.emit(event, ...args); },
    registerPlatform(name, ctor) {
      platformRegistration = { name, ctor };
    },
    registerPlatformAccessories(pluginName, platformName, accessories) {
      for (const accessory of accessories) {
        registered.push({ pluginName, platformName, accessory });
      }
    },
    unregisterPlatformAccessories(pluginName, platformName, accessories) {
      for (const accessory of accessories) {
        unregistered.push({ pluginName, platformName, accessory });
      }
    },
    // Test inspection helpers (prefixed _ to keep them out of the homebridge
    // API surface the plugin code actually relies on).
    _registered: registered,
    _unregistered: unregistered,
    _getPlatformRegistration() { return platformRegistration; },
    _emitDidFinishLaunching() { emitter.emit('didFinishLaunching'); },
  };

  return api;
}

module.exports = {
  createMockApi,
  Service,
  Characteristic,
  PlatformAccessory,
  ServiceInstance,
};
