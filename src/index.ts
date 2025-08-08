import type { API } from 'homebridge';

import { TeslaPowerwallPlatform } from './platform.js';
import { PLATFORM_NAME } from './settings.js';

/**
 * This method registers the platform with Homebridge
 */
export = (homebridge: any) => {
  homebridge.registerPlatform(PLATFORM_NAME, TeslaPowerwallPlatform);
};