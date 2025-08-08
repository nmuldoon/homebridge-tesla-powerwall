# homebridge-tesla-powerwall
[![npm](https://img.shields.io/npm/v/homebridge-tesla-powerwall.svg)](https://www.npmjs.com/package/homebridge-tesla-powerwall)
[![npm](https://img.shields.io/npm/dt/homebridge-tesla-powerwall.svg)](https://www.npmjs.com/package/homebridge-tesla-powerwall)

(Unofficial) Homebridge Plugin for the Tesla Powerwall - **Now Updated for Homebridge 2.0!**

Communication with the Tesla Powerwall is according to https://github.com/vloschiavo/powerwall2 .

This plugin has been completely modernized with TypeScript, updated dependencies, and Homebridge 2.0 compatibility while maintaining all original functionality.

If you like this plugin, it is possible to donate a "cup of coffee" via Paypal:

[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.me/HomebridgePowerwall)

## ✨ What's New in v4.0.0

- 🔄 **Homebridge 2.0 Compatibility**: Fully updated for the latest Homebridge architecture
- 🔧 **TypeScript Rewrite**: Complete conversion to TypeScript for better reliability and development experience
- 📦 **Modern Dependencies**: Updated all dependencies, replaced deprecated packages
- 🧪 **Enhanced Testing**: New connection test script with comprehensive debugging
- 🔒 **Improved Authentication**: Better session management and cookie handling
- 📱 **Config UI Schema**: Enhanced configuration interface for Homebridge UI

## Requirements

- **Node.js**: 18.15.0 or higher
- **Homebridge**: 1.6.0 or higher

# Installation

## Recommended: Homebridge UI
1. Install [Homebridge](https://github.com/homebridge/homebridge): see the [Homebridge wiki](https://github.com/homebridge/homebridge/wiki)
2. In the Homebridge Web-GUI, search for the "Tesla Powerwall" plugin and install it.
3. Configure the plugin using the config UI interface.

## Command Line Installation
```bash
npm install -g homebridge-tesla-powerwall
```

## Testing Your Connection

Before configuring the plugin, test your connection to ensure everything works:

```bash
# Navigate to the plugin directory (if installed globally)
cd $(npm root -g)/homebridge-tesla-powerwall

# Run the connection test
node test/integration/test-connection.js <ip-address> <username> <password>

# Example:
node test/integration/test-connection.js 192.168.1.50 customer your-password-here
```

The test script will:
- ✅ Verify authentication
- ✅ Test battery status retrieval
- ✅ Test power flow data
- ✅ Test grid connectivity status
- 📋 Provide configuration template for Homebridge

## Configuration

### Basic Configuration
```json
{
    "platforms": [
        {
            "platform": "TeslaPowerwall",
            "name": "Tesla Powerwall",
            "ip": "192.168.1.50",
            "password": "your-password-here",
            "pollingInterval": 15,
            "lowBattery": 20
        }
    ]
}
```

### Required Parameters
- `platform`: Must be "TeslaPowerwall"
- `name`: Display name for your Powerwall
- `ip`: IP address of your Tesla Powerwall
- `password`: Your Powerwall password

### Optional Parameters
```json
{
    "platform": "TeslaPowerwall",
    "name": "Tesla Powerwall",
    "ip": "192.168.1.50",
    "password": "your-password-here",
    "port": "",
    "username": "customer",
    "loginInterval": 39600000,
    "pollingInterval": 15000,
    "historyInterval": 300000,
    "lowBattery": 20,
    "additionalServices": {
        "powerwall": {
            "homekitVisual": true,
            "eveHistory": true,
            "batteryIsLowSwitch": false,
            "batteryIsChargingSwitch": false,
            "makeOnOffSwitchReadOnly": true
        },
        "solar": {
            "homekitVisual": true,
            "evePowerMeter": true,
            "eveHistory": true,
            "eveLineGraph": false,
            "pullingFromSensor": false,
            "sensorThreshold": 0
        },
        "grid": {
            "homekitVisual": true,
            "positiveEvePowerMeter": true,
            "negativeEvePowerMeter": true,
            "eveHistory": true,
            "eveLineGraph": false,
            "feedingToSensor": false,
            "pullingFromSensor": false,
            "sensorThreshold": 0
        },
        "battery": {
            "homekitVisual": true,
            "positiveEvePowerMeter": true,
            "negativeEvePowerMeter": true,
            "eveHistory": true,
            "eveLineGraph": false,
            "feedingToSensor": false,
            "pullingFromSensor": false,
            "sensorThreshold": 0
        },
        "home": {
            "homekitVisual": true,
            "evePowerMeter": true,
            "eveHistory": true,
            "eveLineGraph": false,
            "feedingToSensor": false,
            "sensorThreshold": 0
        },
        "gridstatus": {
            "gridIsDownSwitch": false,
            "gridIsUpSwitch": false,
            "gridIsNotYetInSyncSwitch": false,
            "gridIsDownSensor": false,
            "gridIsUpSensor": false
        }
    }
}
```

### Configuration Options Explained

- `username`: Default "customer" is currently the only username that works
- `loginInterval`: Login refresh interval in milliseconds (default: 11 hours)
- `pollingInterval`: How often to poll for data in milliseconds (default: 15 seconds)
- `historyInterval`: History logging interval in milliseconds (default: 5 minutes)
- `lowBattery`: Battery percentage considered low/critical (default: 20%)

#### Additional Services

The plugin supports various additional services for enhanced functionality:

**Switches & Sensors**: Add switches/sensors for automation triggers
**Visual Services**: HomeKit-compatible visual representations (fans, lights)
**Eve Integration**: Enhanced data logging and visualization for Eve app
**Power Meters**: Detailed power consumption tracking
**Sensor Thresholds**: Configurable deadzone for sensor activation

## History Configuration

### File System Persistence
```json
"historySetting": {
    "storage": "fs",
    "size": 4032,
    "path": "/path/to/store/persistence/"
}
```

### Google Drive Persistence
```json
"historySetting": {
    "storage": "googleDrive",
    "size": 4032,
    "folder": "fakegato",
    "keyPath": "/path/to/store/keys/"
}
```

## Example Configurations

### Minimal Configuration
```json
{
    "platform": "TeslaPowerwall",
    "name": "Tesla Powerwall",
    "ip": "192.168.1.50",
    "password": "your-password-here",
    "pollingInterval": 10000,
    "lowBattery": 10
}
```

### Home.app Only (No Eve Services)
```json
{
    "platform": "TeslaPowerwall",
    "name": "Tesla Powerwall",
    "ip": "192.168.1.50",
    "password": "your-password-here",
    "additionalServices": {
        "powerwall": {
            "eveHistory": false
        },
        "solar": {
            "evePowerMeter": false,
            "eveHistory": false
        },
        "grid": {
            "positiveEvePowerMeter": false,
            "negativeEvePowerMeter": false,
            "eveHistory": false
        },
        "battery": {
            "positiveEvePowerMeter": false,
            "negativeEvePowerMeter": false,
            "eveHistory": false
        },
        "home": {
            "evePowerMeter": false,
            "eveHistory": false
        }
    }
}
```

## Troubleshooting

### 🔧 Connection Testing

Always start with the connection test script:
```bash
node test/integration/test-connection.js <ip> <username> <password>
```

### ❌ Login Errors

If you get login errors (403, authentication failed):
1. Verify your password is correct
2. Ensure username is "customer" (currently the only supported value)
3. Check if your Powerwall requires re-registration
4. Try the connection test script for detailed debugging

### 🔄 Plugin Stopped Working After Powerwall Update

- Ensure you're using the latest plugin version (4.0.0+)
- Verify the `password` field is correctly configured
- The `username` should be "customer"

### 📊 For Older Powerwall Versions (< 20.49.0)

If your Powerwall firmware is older than 20.49.0, you may need to use the legacy version:
```bash
npm install -g homebridge-tesla-powerwall@1.1.0
```

## Development

### Building from Source
```bash
git clone https://github.com/nmuldoon/homebridge-tesla-powerwall.git
cd homebridge-tesla-powerwall
npm install
npm run build
```

### Running Tests
```bash
npm test
npm run lint
```

## Migration from v3.x to v4.0.0

The v4.0.0 update is a major rewrite with breaking changes:

1. **Node.js Requirement**: Now requires Node.js 18.15.0+
2. **Configuration**: All existing configurations should continue to work
3. **Dependencies**: Automatically updated when you install v4.0.0
4. **Testing**: Use the new test script to verify connectivity

Simply update the plugin and restart Homebridge - no configuration changes needed!

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests if applicable
4. Submit a pull request

## Feature Requests / Bug Reports

Please create an [Issue](https://github.com/nmuldoon/homebridge-tesla-powerwall/issues/new) with:
- Plugin version
- Homebridge version
- Node.js version
- Powerwall firmware version
- Detailed description of the issue
- Log output if applicable

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Disclaimer**: This is an unofficial plugin and is not associated with Tesla, Inc. in any way.
