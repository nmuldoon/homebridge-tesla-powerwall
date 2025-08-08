"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PowerMeterAccessory = void 0;
/**
 * Platform Accessory for Tesla Powerwall Power Meters
 * Shows power flow data as light sensors with lux values representing watts
 */
class PowerMeterAccessory {
    platform;
    accessory;
    service;
    informationService;
    // Current power reading
    currentPower = 0;
    meterType;
    constructor(platform, accessory) {
        this.platform = platform;
        this.accessory = accessory;
        // Determine meter type from device type
        this.meterType = this.getMeterType(accessory.context.device.type);
        // Set accessory information
        this.informationService = this.accessory.getService(this.platform.Service.AccessoryInformation);
        this.informationService
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Tesla')
            .setCharacteristic(this.platform.Characteristic.Model, `Powerwall ${this.meterType} Meter`)
            .setCharacteristic(this.platform.Characteristic.SerialNumber, `TeslaPowerwall-${this.meterType}-` + accessory.context.device.uniqueId);
        // Get the LightSensor service if it exists, otherwise create a new one
        // We use LightSensor because it has a numeric value (lux) that we can use for watts
        this.service = this.accessory.getService(this.platform.Service.LightSensor) ||
            this.accessory.addService(this.platform.Service.LightSensor);
        // Set the service name
        this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);
        // Register handlers for the characteristics
        this.service.getCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel)
            .onGet(this.getCurrentPower.bind(this));
        // Start polling for updates
        this.startPolling();
    }
    /**
     * Get meter type from device type
     */
    getMeterType(deviceType) {
        switch (deviceType) {
            case 'powermeter-load':
                return 'load';
            case 'powermeter-solar':
                return 'solar';
            case 'powermeter-grid':
                return 'site';
            default:
                return 'unknown';
        }
    }
    /**
     * Handle requests to get the current power reading
     * Returns power in watts mapped to lux (0.0001 to 100000 lux range)
     */
    async getCurrentPower() {
        try {
            const data = await this.platform.httpClient.getMetersAggregates();
            let power = 0;
            // Extract power based on meter type
            switch (this.meterType) {
                case 'load':
                    power = Math.abs(data.load?.instant_power || 0);
                    break;
                case 'solar':
                    power = Math.abs(data.solar?.instant_power || 0);
                    break;
                case 'site':
                    power = Math.abs(data.site?.instant_power || 0);
                    break;
            }
            // Map watts to lux range (0.0001 to 100000)
            // We'll use a logarithmic scale to handle the wide range of possible power values
            this.currentPower = Math.max(0.0001, Math.min(100000, power / 10));
            this.platform.log.debug(`Get Characteristic ${this.meterType} Power ->`, `${power}W (${this.currentPower} lux)`);
            return this.currentPower;
        }
        catch (error) {
            this.platform.log.error(`Error getting ${this.meterType} power:`, error);
            return this.currentPower;
        }
    }
    /**
     * Start polling for updates and push them to HomeKit
     */
    startPolling() {
        const pollingInterval = (this.platform.config.pollingInterval || 15) * 1000;
        setInterval(async () => {
            try {
                const power = await this.getCurrentPower();
                this.service.updateCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel, power);
            }
            catch (error) {
                this.platform.log.error(`Error during ${this.meterType} power polling update:`, error);
            }
        }, pollingInterval);
    }
}
exports.PowerMeterAccessory = PowerMeterAccessory;
