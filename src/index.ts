import type { API } from 'homebridge';

import { TeslaPowerwallPlatform } from './platform';
import { PLATFORM_NAME } from './settings';

/**
 * This method registers the platform with Homebridge
 */
export default (api: API): void => {
  api.registerPlatform(PLATFORM_NAME, TeslaPowerwallPlatform);
};