import type { CharacteristicValue, PlatformAccessory } from 'homebridge';
import type { TeslaPowerwallPlatform } from '../platform.js';
/**
 * Platform Accessory for Tesla Powerwall Power Meters
 * Shows power flow data as light sensors with lux values representing watts
 */
export declare class PowerMeterAccessory {
    private readonly platform;
    private readonly accessory;
    private service;
    private informationService;
    private currentPower;
    private meterType;
    constructor(platform: TeslaPowerwallPlatform, accessory: PlatformAccessory);
    /**
     * Get meter type from device type
     */
    private getMeterType;
    /**
     * Handle requests to get the current power reading
     * Returns power in watts mapped to lux (0.0001 to 100000 lux range)
     */
    getCurrentPower(): Promise<CharacteristicValue>;
    /**
     * Start polling for updates and push them to HomeKit
     */
    private startPolling;
}
//# sourceMappingURL=powermeter.d.ts.map