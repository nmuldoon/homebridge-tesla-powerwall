import type { 
  API, 
  Characteristic, 
  DynamicPlatformPlugin, 
  Logging, 
  PlatformAccessory, 
  PlatformConfig, 
  Service,
} from 'homebridge';

export interface TeslaPowerwallPlatformInterface extends DynamicPlatformPlugin {
  readonly Service: typeof Service;
  readonly Characteristic: typeof Characteristic;
  readonly accessories: Map<string, PlatformAccessory>;
  readonly discoveredCacheUUIDs: string[];
  readonly httpClient: any;
  readonly log: Logging;
  readonly config: PlatformConfig;
  readonly api: API;
}
