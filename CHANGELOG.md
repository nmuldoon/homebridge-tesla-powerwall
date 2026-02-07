# Changelog

All notable changes to this project will be documented in this file.

## [4.1.0] - 2026-01-16

### Added
- **Grid Power Sensors** (addresses Issue #35)
  - New "Grid Feeding" sensor triggers when exporting power to grid
  - New "Grid Pulling" sensor triggers when importing power from grid
  - Configurable threshold (default 50W) to prevent false triggers
  - Perfect for HomeKit automations and energy management
  - Validation script for testing sensor behavior

- **Testing Tools**
  - Grid sensor validation script (`test/integration/validate-grid-sensors.js`)
  - Real-time power flow visualization
  - Sensor state evaluation

- **Documentation**
  - Comprehensive automation examples (4 use cases)
  - API limitation documentation for operation mode control
  - Testing instructions
  - Configuration examples

### Changed
- Updated all dependencies to latest compatible versions
  - @eslint/js: 9.8.0 → 9.39.2
  - @types/node: 20.5.0 → 20.19.30
  - eslint: 9.8.0 → 9.39.2
  - homebridge: 1.8.0 → 1.11.1
  - typescript: 5.2.2 → 5.9.3
  - And more...

### Fixed
- Memory leaks in all accessories (added proper cleanup methods)
- Type safety improvements across the codebase
- Nullish coalescing for numeric config values (allows 0 as valid threshold)
- Parameter validation in validation script

### Security
- Fixed 4 npm audit vulnerabilities (6→2 remaining low-severity dev dependencies)
- CodeQL security scan: 0 alerts

### Documented
- **Operation Mode Control Limitations** (Issue #54)
  - Local API does not support changing operation modes
  - Requires Tesla Fleet API (cloud-based)
  - Provided alternatives and future roadmap

## [4.0.1] - Previous Version
- TypeScript rewrite
- Homebridge 2.0 compatibility
- Modern dependency updates

[4.1.0]: https://github.com/nmuldoon/homebridge-tesla-powerwall/compare/v4.0.1...v4.1.0
[4.0.1]: https://github.com/nmuldoon/homebridge-tesla-powerwall/releases/tag/v4.0.1
