import type { CharacteristicValue, PlatformAccessory } from 'homebridge';
import type { TeslaPowerwallPlatform } from '../platform.js';
/**
 * Platform Accessory for Tesla Powerwall Battery
 * An instance of this class is created for the main Powerwall battery accessory
 */
export declare class PowerwallAccessory {
    private readonly platform;
    private readonly accessory;
    private service;
    private informationService;
    private batteryLevel;
    private chargingState;
    private lowBatteryStatus;
    constructor(platform: TeslaPowerwallPlatform, accessory: PlatformAccessory);
    /**
     * Handle requests to get the current value of the "Battery Level" characteristic
     */
    getBatteryLevel(): Promise<CharacteristicValue>;
    /**
     * Handle requests to get the current value of the "Charging State" characteristic
     */
    getChargingState(): Promise<CharacteristicValue>;
    /**
     * Handle requests to get the current value of the "Status Low Battery" characteristic
     */
    getStatusLowBattery(): Promise<CharacteristicValue>;
    /**
     * Start polling for updates and push them to HomeKit
     */
    private startPolling;
}
//# sourceMappingURL=powerwall.d.ts.map