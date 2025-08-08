import type { CharacteristicValue, PlatformAccessory } from 'homebridge';
import type { TeslaPowerwallPlatform } from '../platform.js';
/**
 * Platform Accessory for Tesla Powerwall Grid Status
 * Shows grid connection status as a contact sensor
 */
export declare class GridStatusAccessory {
    private readonly platform;
    private readonly accessory;
    private service;
    private informationService;
    private gridStatus;
    constructor(platform: TeslaPowerwallPlatform, accessory: PlatformAccessory);
    /**
     * Handle requests to get the current grid status
     * Returns CONTACT_DETECTED (0) when grid is connected
     * Returns CONTACT_NOT_DETECTED (1) when grid is disconnected
     */
    getGridStatus(): Promise<CharacteristicValue>;
    /**
     * Start polling for updates and push them to HomeKit
     */
    private startPolling;
}
//# sourceMappingURL=gridstatus.d.ts.map