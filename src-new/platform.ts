import type { 
  API, 
  Characteristic, 
  DynamicPlatformPlugin, 
  Logging, 
  PlatformAccessory, 
  PlatformConfig, 
  Service 
} from 'homebridge';

import { PowerwallAccessory } from './accessories/powerwall.js';
import { PowerMeterAccessory } from './accessories/powermeter.js';
import { GridStatusAccessory } from './accessories/gridstatus.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { HttpClient } from './lib/http-client.js';

/**
 * Tesla Powerwall Platform
 * This class is the main constructor for the plugin, this is where we should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class TeslaPowerwallPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: Map<string, PlatformAccessory> = new Map();
  public readonly discoveredCacheUUIDs: string[] = [];

  public readonly httpClient: HttpClient;

  constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    // Initialize HTTP client for Tesla Powerwall API
    this.httpClient = new HttpClient(
      this.config.ip || '127.0.0.1',
      this.config.port || '',
      this.config.username || 'customer',
      this.config.password || '',
      this.config.email || 'Lt.Dan@bubbagump.com',
      this.log,
    );

    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to set up event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache, so we can track if it has already been registered
    this.accessories.set(accessory.UUID, accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {
    // Define the Tesla Powerwall devices to create
    const devices = [
      {
        uniqueId: 'tesla-powerwall-battery',
        displayName: this.config.name || 'Tesla Powerwall',
        type: 'powerwall',
      },
      {
        uniqueId: 'tesla-powerwall-grid-status',
        displayName: (this.config.name || 'Tesla Powerwall') + ' Grid Status',
        type: 'gridstatus',
      },
      {
        uniqueId: 'tesla-powerwall-load-meter',
        displayName: (this.config.name || 'Tesla Powerwall') + ' Load',
        type: 'powermeter-load',
      },
      {
        uniqueId: 'tesla-powerwall-solar-meter',
        displayName: (this.config.name || 'Tesla Powerwall') + ' Solar',
        type: 'powermeter-solar',
      },
      {
        uniqueId: 'tesla-powerwall-grid-meter',
        displayName: (this.config.name || 'Tesla Powerwall') + ' Grid',
        type: 'powermeter-grid',
      },
    ];

    // loop over the discovered devices and register each one if it has not already been registered
    for (const device of devices) {
      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      const uuid = this.api.hap.uuid.generate(device.uniqueId);

      // see if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      const existingAccessory = this.accessories.get(uuid);

      if (existingAccessory) {
        // the accessory already exists
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. e.g.:
        existingAccessory.context.device = device;
        this.api.updatePlatformAccessories([existingAccessory]);

        // create the accessory handler for the restored accessory
        this.createAccessoryHandler(existingAccessory, device);

      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info('Adding new accessory:', device.displayName);

        // create a new accessory
        const accessory = new this.api.platformAccessory(device.displayName, uuid);

        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.device = device;

        // create the accessory handler for the newly create accessory
        this.createAccessoryHandler(accessory, device);

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }

      // push into discoveredCacheUUIDs
      this.discoveredCacheUUIDs.push(uuid);
    }

    // Remove accessories that are no longer present
    for (const [uuid, accessory] of this.accessories) {
      if (!this.discoveredCacheUUIDs.includes(uuid)) {
        this.log.info('Removing existing accessory from cache:', accessory.displayName);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }

  /**
   * Create the appropriate accessory handler based on device type
   */
  private createAccessoryHandler(accessory: PlatformAccessory, device: any) {
    switch (device.type) {
      case 'powerwall':
        new PowerwallAccessory(this, accessory);
        break;
      case 'gridstatus':
        new GridStatusAccessory(this, accessory);
        break;
      case 'powermeter-load':
      case 'powermeter-solar':
      case 'powermeter-grid':
        new PowerMeterAccessory(this, accessory);
        break;
      default:
        this.log.warn('Unknown device type:', device.type);
    }
  }
}
