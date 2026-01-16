import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import type { TeslaPowerwallPlatform } from '../platform.js';

/**
 * Platform Accessory for Tesla Powerwall Grid Power Flow Sensors
 * Triggers notifications when the system is feeding to or pulling power from the grid
 * 
 * This accessory creates two sensors:
 * 1. Feeding to Grid - triggers when power flows to the grid (negative site power)
 * 2. Pulling from Grid - triggers when power flows from the grid (positive site power)
 */
export class GridPowerSensorAccessory {
  private service: Service;
  private informationService: Service;
  
  // Current sensor state (0 = normal, 1 = detected)
  private sensorState = 0;
  private sensorType: 'feeding' | 'pulling';
  
  constructor(
    private readonly platform: TeslaPowerwallPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    // Determine sensor type from device context
    this.sensorType = accessory.context.device.sensorType || 'feeding';
    
    // Set accessory information
    this.informationService = this.accessory.getService(this.platform.Service.AccessoryInformation)!;
    this.informationService
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Tesla')
      .setCharacteristic(this.platform.Characteristic.Model, `Powerwall Grid ${this.sensorType === 'feeding' ? 'Feeding' : 'Pulling'} Sensor`)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, `TeslaPowerwall-Grid-${this.sensorType}-` + accessory.UUID);

    // Get or create the ContactSensor service
    // We use ContactSensor because it can trigger automations in HomeKit
    this.service = this.accessory.getService(this.platform.Service.ContactSensor) ||
      this.accessory.addService(this.platform.Service.ContactSensor);

    // Set the service name
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.displayName);

    // Register handlers for the characteristics
    this.service.getCharacteristic(this.platform.Characteristic.ContactSensorState)
      .onGet(this.getSensorState.bind(this));

    // Start polling for updates
    this.startPolling();
  }

  /**
   * Handle requests to get the current sensor state
   * Returns CONTACT_DETECTED (1) when condition is met (feeding/pulling)
   * Returns CONTACT_NOT_DETECTED (0) when condition is not met
   */
  async getSensorState(): Promise<CharacteristicValue> {
    try {
      const data = await this.platform.httpClient.getMetersAggregates();
      const sitePower = data.site?.instant_power || 0;
      
      // Get threshold from config, default to 50W to avoid noise
      const threshold = this.platform.config.gridSensorThreshold || 50;
      
      let isConditionMet = false;
      
      if (this.sensorType === 'feeding') {
        // Feeding to grid: site power is negative and magnitude exceeds threshold
        isConditionMet = sitePower < -threshold;
      } else {
        // Pulling from grid: site power is positive and exceeds threshold
        isConditionMet = sitePower > threshold;
      }
      
      this.sensorState = isConditionMet ? 
        this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED :
        this.platform.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
      
      this.platform.log.debug(
        `Get Characteristic Grid ${this.sensorType === 'feeding' ? 'Feeding' : 'Pulling'} Sensor ->`, 
        `${sitePower.toFixed(1)}W`,
        isConditionMet ? 'DETECTED' : 'NOT DETECTED',
        `(threshold: ${threshold}W)`
      );
      
      return this.sensorState;
    } catch (error) {
      this.platform.log.error(`Error getting grid ${this.sensorType} sensor state:`, error);
      return this.sensorState;
    }
  }

  /**
   * Start polling for updates and push them to HomeKit
   */
  private startPolling(): void {
    const pollingInterval = (this.platform.config.pollingInterval || 15) * 1000;

    setInterval(async () => {
      try {
        const sensorState = await this.getSensorState();
        this.service.updateCharacteristic(this.platform.Characteristic.ContactSensorState, sensorState);
      } catch (error) {
        this.platform.log.error(`Error during grid ${this.sensorType} sensor polling update:`, error);
      }
    }, pollingInterval);
  }
}
