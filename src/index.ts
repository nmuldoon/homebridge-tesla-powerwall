import type { API } from 'homebridge';

import { TeslaPowerwallPlatform } from './platform.js';
import { PLATFORM_NAME } from './settings.js';

/**
 * This method registers the platform with Homebridge
 */
export default (api: API) => {
  api.registerPlatform(PLATFORM_NAME, TeslaPowerwallPlatform);
};

// Export the ConfigUI service for Homebridge Config UI X
export { ConfigUIService } from './configUI.js';
