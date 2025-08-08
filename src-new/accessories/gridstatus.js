"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GridStatusAccessory = void 0;
/**
 * Platform Accessory for Tesla Powerwall Grid Status
 * Shows grid connection status as a contact sensor
 */
class GridStatusAccessory {
    platform;
    accessory;
    service;
    informationService;
    // Current state (0 = grid connected, 1 = grid disconnected)
    gridStatus = 0;
    constructor(platform, accessory) {
        this.platform = platform;
        this.accessory = accessory;
        // Set accessory information
        this.informationService = this.accessory.getService(this.platform.Service.AccessoryInformation);
        this.informationService
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Tesla')
            .setCharacteristic(this.platform.Characteristic.Model, 'Powerwall Grid Status')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, 'TeslaPowerwall-Grid-' + accessory.context.device.uniqueId);
        // Get the ContactSensor service if it exists, otherwise create a new one
        this.service = this.accessory.getService(this.platform.Service.ContactSensor) ||
            this.accessory.addService(this.platform.Service.ContactSensor);
        // Set the service name
        this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);
        // Register handlers for the characteristics
        this.service.getCharacteristic(this.platform.Characteristic.ContactSensorState)
            .onGet(this.getGridStatus.bind(this));
        // Start polling for updates
        this.startPolling();
    }
    /**
     * Handle requests to get the current grid status
     * Returns CONTACT_DETECTED (0) when grid is connected
     * Returns CONTACT_NOT_DETECTED (1) when grid is disconnected
     */
    async getGridStatus() {
        try {
            const data = await this.platform.httpClient.getGridStatus();
            // Map grid status to contact sensor state
            // "SystemGridConnected" = grid connected
            // "SystemIslandedActive" = grid disconnected (islanded)
            const isGridConnected = data.grid_status === 'SystemGridConnected';
            this.gridStatus = isGridConnected ?
                this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED :
                this.platform.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
            this.platform.log.debug('Get Characteristic GridStatus ->', isGridConnected ? 'Connected' : 'Disconnected', '(', this.gridStatus, ')');
            return this.gridStatus;
        }
        catch (error) {
            this.platform.log.error('Error getting grid status:', error);
            return this.gridStatus;
        }
    }
    /**
     * Start polling for updates and push them to HomeKit
     */
    startPolling() {
        const pollingInterval = (this.platform.config.pollingInterval || 15) * 1000;
        setInterval(async () => {
            try {
                const gridStatus = await this.getGridStatus();
                this.service.updateCharacteristic(this.platform.Characteristic.ContactSensorState, gridStatus);
            }
            catch (error) {
                this.platform.log.error('Error during grid status polling update:', error);
            }
        }, pollingInterval);
    }
}
exports.GridStatusAccessory = GridStatusAccessory;
