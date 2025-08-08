import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge';
import { HttpClient } from './lib/http-client.js';
/**
 * Tesla Powerwall Platform
 * This class is the main constructor for the plugin, this is where we should
 * parse the user config and discover/register accessories with Homebridge.
 */
export declare class TeslaPowerwallPlatform implements DynamicPlatformPlugin {
    readonly log: Logging;
    readonly config: PlatformConfig;
    readonly api: API;
    readonly Service: typeof Service;
    readonly Characteristic: typeof Characteristic;
    readonly accessories: Map<string, PlatformAccessory>;
    readonly discoveredCacheUUIDs: string[];
    readonly httpClient: HttpClient;
    constructor(log: Logging, config: PlatformConfig, api: API);
    /**
     * This function is invoked when homebridge restores cached accessories from disk at startup.
     * It should be used to set up event handlers for characteristics and update respective values.
     */
    configureAccessory(accessory: PlatformAccessory): void;
    /**
     * This is an example method showing how to register discovered accessories.
     * Accessories must only be registered once, previously created accessories
     * must not be registered again to prevent "duplicate UUID" errors.
     */
    discoverDevices(): void;
    /**
     * Create the appropriate accessory handler based on device type
     */
    private createAccessoryHandler;
}
//# sourceMappingURL=platform.d.ts.map