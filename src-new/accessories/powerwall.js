"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PowerwallAccessory = void 0;
/**
 * Platform Accessory for Tesla Powerwall Battery
 * An instance of this class is created for the main Powerwall battery accessory
 */
class PowerwallAccessory {
    platform;
    accessory;
    service;
    informationService;
    // Current states
    batteryLevel = 50;
    chargingState = 0; // 0 = Not Charging, 1 = Charging, 2 = Not Chargeable
    lowBatteryStatus = 0; // 0 = Normal, 1 = Low
    constructor(platform, accessory) {
        this.platform = platform;
        this.accessory = accessory;
        // Set accessory information
        this.informationService = this.accessory.getService(this.platform.Service.AccessoryInformation);
        this.informationService
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Tesla')
            .setCharacteristic(this.platform.Characteristic.Model, 'Powerwall')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, 'TeslaPowerwall-' + accessory.context.device.uniqueId);
        // Get the BatteryService service if it exists, otherwise create a new one
        this.service = this.accessory.getService(this.platform.Service.Battery) ||
            this.accessory.addService(this.platform.Service.Battery);
        // Set the service name
        this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);
        // Register handlers for the characteristics
        this.service.getCharacteristic(this.platform.Characteristic.BatteryLevel)
            .onGet(this.getBatteryLevel.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.ChargingState)
            .onGet(this.getChargingState.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.StatusLowBattery)
            .onGet(this.getStatusLowBattery.bind(this));
        // Start polling for updates
        this.startPolling();
    }
    /**
     * Handle requests to get the current value of the "Battery Level" characteristic
     */
    async getBatteryLevel() {
        try {
            const data = await this.platform.httpClient.getSystemStatus();
            this.batteryLevel = Math.round(data.percentage || 50);
            this.platform.log.debug('Get Characteristic BatteryLevel ->', this.batteryLevel);
            return this.batteryLevel;
        }
        catch (error) {
            this.platform.log.error('Error getting battery level:', error);
            return this.batteryLevel;
        }
    }
    /**
     * Handle requests to get the current value of the "Charging State" characteristic
     */
    async getChargingState() {
        try {
            const data = await this.platform.httpClient.getMetersAggregates();
            const batteryPower = data.battery?.instant_power || 0;
            // Positive power = charging, negative = discharging
            if (batteryPower > 50) { // Small threshold for noise
                this.chargingState = this.platform.Characteristic.ChargingState.CHARGING;
            }
            else {
                this.chargingState = this.platform.Characteristic.ChargingState.NOT_CHARGING;
            }
            this.platform.log.debug('Get Characteristic ChargingState ->', this.chargingState);
            return this.chargingState;
        }
        catch (error) {
            this.platform.log.error('Error getting charging state:', error);
            return this.chargingState;
        }
    }
    /**
     * Handle requests to get the current value of the "Status Low Battery" characteristic
     */
    async getStatusLowBattery() {
        try {
            const data = await this.platform.httpClient.getSystemStatus();
            const batteryLevel = data.percentage || 50;
            const lowBatteryThreshold = this.platform.config.lowBattery || 20;
            this.lowBatteryStatus = batteryLevel <= lowBatteryThreshold ?
                this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW :
                this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
            this.platform.log.debug('Get Characteristic StatusLowBattery ->', this.lowBatteryStatus);
            return this.lowBatteryStatus;
        }
        catch (error) {
            this.platform.log.error('Error getting low battery status:', error);
            return this.lowBatteryStatus;
        }
    }
    /**
     * Start polling for updates and push them to HomeKit
     */
    startPolling() {
        const pollingInterval = (this.platform.config.pollingInterval || 15) * 1000;
        setInterval(async () => {
            try {
                // Update battery level
                const batteryLevel = await this.getBatteryLevel();
                this.service.updateCharacteristic(this.platform.Characteristic.BatteryLevel, batteryLevel);
                // Update charging state
                const chargingState = await this.getChargingState();
                this.service.updateCharacteristic(this.platform.Characteristic.ChargingState, chargingState);
                // Update low battery status
                const lowBatteryStatus = await this.getStatusLowBattery();
                this.service.updateCharacteristic(this.platform.Characteristic.StatusLowBattery, lowBatteryStatus);
            }
            catch (error) {
                this.platform.log.error('Error during polling update:', error);
            }
        }, pollingInterval);
    }
}
exports.PowerwallAccessory = PowerwallAccessory;
