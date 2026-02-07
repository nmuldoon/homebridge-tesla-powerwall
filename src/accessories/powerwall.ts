import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import type { TeslaPowerwallPlatform } from '../platform.js';

/**
 * Platform Accessory for Tesla Powerwall Battery
 * An instance of this class is created for the main Powerwall battery accessory
 */
export class PowerwallAccessory {
  private service: Service;
  private informationService: Service;

  // Current states
  private batteryLevel = 50;
  private chargingState = 0; // 0 = Not Charging, 1 = Charging, 2 = Not Chargeable
  private lowBatteryStatus = 0; // 0 = Normal, 1 = Low
  private pollingIntervalId?: NodeJS.Timeout;

  constructor(
    private readonly platform: TeslaPowerwallPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    // Set accessory information
    this.informationService = this.accessory.getService(this.platform.Service.AccessoryInformation)!;
    this.informationService
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Tesla')
      .setCharacteristic(this.platform.Characteristic.Model, 'Powerwall')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'TeslaPowerwall-' + accessory.UUID);

    // Get the BatteryService service if it exists, otherwise create a new one
    this.service = this.accessory.getService(this.platform.Service.Battery) ||
      this.accessory.addService(this.platform.Service.Battery);

    // Set the service name
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.displayName);

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
  async getBatteryLevel(): Promise<CharacteristicValue> {
    try {
      const data = await this.platform.httpClient.getSystemStatus();
      this.batteryLevel = Math.round(data.percentage || 50);
      this.platform.log.debug('Get Characteristic BatteryLevel ->', this.batteryLevel);
      return this.batteryLevel;
    } catch (error) {
      this.platform.log.error('Error getting battery level:', error);
      return this.batteryLevel;
    }
  }

  /**
   * Handle requests to get the current value of the "Charging State" characteristic
   */
  async getChargingState(): Promise<CharacteristicValue> {
    try {
      const data = await this.platform.httpClient.getMetersAggregates();
      const batteryPower = data.battery?.instant_power || 0;
      
      // Positive power = charging, negative = discharging
      if (batteryPower > 50) { // Small threshold for noise
        this.chargingState = this.platform.Characteristic.ChargingState.CHARGING;
      } else {
        this.chargingState = this.platform.Characteristic.ChargingState.NOT_CHARGING;
      }
      
      this.platform.log.debug('Get Characteristic ChargingState ->', this.chargingState);
      return this.chargingState;
    } catch (error) {
      this.platform.log.error('Error getting charging state:', error);
      return this.chargingState;
    }
  }

  /**
   * Handle requests to get the current value of the "Status Low Battery" characteristic
   */
  async getStatusLowBattery(): Promise<CharacteristicValue> {
    try {
      const data = await this.platform.httpClient.getSystemStatus();
      const batteryLevel = data.percentage || 50;
      const lowBatteryThreshold = this.platform.config.lowBattery || 20;
      
      this.lowBatteryStatus = batteryLevel <= lowBatteryThreshold ? 
        this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW :
        this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
      
      this.platform.log.debug('Get Characteristic StatusLowBattery ->', this.lowBatteryStatus);
      return this.lowBatteryStatus;
    } catch (error) {
      this.platform.log.error('Error getting low battery status:', error);
      return this.lowBatteryStatus;
    }
  }

  /**
   * Start polling for updates and push them to HomeKit
   */
  private startPolling(): void {
    const pollingInterval = (this.platform.config.pollingInterval || 15) * 1000;

    this.pollingIntervalId = setInterval(async () => {
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

      } catch (error) {
        this.platform.log.error('Error during polling update:', error);
      }
    }, pollingInterval);
  }

  /**
   * Cleanup resources when accessory is removed
   */
  destroy(): void {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = undefined;
    }
  }
}
