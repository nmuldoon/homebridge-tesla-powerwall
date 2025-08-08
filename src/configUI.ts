import type { Logger } from 'homebridge';
import fetch from 'node-fetch';
import { Agent } from 'https';

interface TestConnectionConfig {
  ip: string;
  username?: string;
  password: string;
  port?: string;
}

export interface TestConnectionResult {
  success: boolean;
  message?: string;
  batteryLevel?: number | undefined;
  gridStatus?: string | undefined;
  powerFlow?: {
    load: number;
    solar: number;
    grid: number;
    battery: number;
  } | undefined;
  errors?: string[] | undefined;
}

export class ConfigUIService {
  constructor(private readonly log: Logger) {}

  /**
   * Test connection to Tesla Powerwall and return status information
   */
  async testConnection(config: TestConnectionConfig): Promise<TestConnectionResult> {
    const errors: string[] = [];
    
    try {
      // Validate required fields
      if (!config.ip) {
        return {
          success: false,
          message: 'IP address is required',
        };
      }

      if (!config.password) {
        return {
          success: false,
          message: 'Password is required',
        };
      }

      // Build base URL
      const port = config.port || '443';
      const baseUrl = port !== '443' 
        ? `https://${config.ip}:${port}` 
        : `https://${config.ip}`;

      // Create HTTPS agent that ignores certificate warnings
      const agent = new Agent({
        rejectUnauthorized: false,
      });

      this.log.debug('Testing connection to Tesla Powerwall at:', baseUrl);

      // Step 1: Test authentication
      const loginResponse = await fetch(`${baseUrl}/api/login/Basic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        agent: agent,
        body: JSON.stringify({
          username: config.username || 'customer',
          password: config.password,
        }),
        timeout: 10000,
      });

      if (!loginResponse.ok) {
        return {
          success: false,
          message: `Authentication failed: ${loginResponse.status} ${loginResponse.statusText}`,
          errors: ['Check your password and network connectivity'],
        };
      }

      // Extract cookies from login response
      const setCookieHeader = loginResponse.headers.get('set-cookie');
      let cookies = '';
      if (setCookieHeader) {
        const cookiePairs = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
        cookies = cookiePairs.map(cookie => cookie.split(';')[0]).join('; ');
      }

      const headers = cookies ? { 'Cookie': cookies } : {};

      // Step 2: Test battery status
      let batteryLevel: number | undefined;
      try {
        const batteryResponse = await fetch(`${baseUrl}/api/system_status/soe`, {
          method: 'GET',
          headers,
          agent: agent,
          timeout: 10000,
        });

        if (batteryResponse.ok) {
          const batteryData = await batteryResponse.json();
          batteryLevel = Math.round(batteryData.percentage || 0);
        } else {
          errors.push(`Battery status: ${batteryResponse.status} ${batteryResponse.statusText}`);
        }
      } catch (error) {
        errors.push(`Battery status error: ${(error as Error).message}`);
      }

      // Step 3: Test power flow data
      let powerFlow: TestConnectionResult['powerFlow'] | undefined;
      try {
        const powerResponse = await fetch(`${baseUrl}/api/meters/aggregates`, {
          method: 'GET',
          headers,
          agent: agent,
          timeout: 10000,
        });

        if (powerResponse.ok) {
          const powerData = await powerResponse.json();
          powerFlow = {
            load: Math.round(powerData.load?.instant_power || 0),
            solar: Math.round(powerData.solar?.instant_power || 0),
            grid: Math.round(powerData.site?.instant_power || 0),
            battery: Math.round(powerData.battery?.instant_power || 0),
          };
        } else {
          errors.push(`Power flow: ${powerResponse.status} ${powerResponse.statusText}`);
        }
      } catch (error) {
        errors.push(`Power flow error: ${(error as Error).message}`);
      }

      // Step 4: Test grid status
      let gridStatus: string | undefined;
      try {
        const gridResponse = await fetch(`${baseUrl}/api/system_status/grid_status`, {
          method: 'GET',
          headers,
          agent: agent,
          timeout: 10000,
        });

        if (gridResponse.ok) {
          const gridData = await gridResponse.json();
          gridStatus = gridData.grid_status === 'SystemGridConnected' ? 'Connected' : 'Disconnected';
        } else {
          errors.push(`Grid status: ${gridResponse.status} ${gridResponse.statusText}`);
        }
      } catch (error) {
        errors.push(`Grid status error: ${(error as Error).message}`);
      }

      // Determine overall success
      const success = batteryLevel !== undefined || powerFlow !== undefined || gridStatus !== undefined;
      
      if (success) {
        const result: TestConnectionResult = {
          success: true,
          message: 'Connection test successful! Tesla Powerwall is responding.',
        };

        if (batteryLevel !== undefined) {
          result.batteryLevel = batteryLevel;
        }
        if (gridStatus !== undefined) {
          result.gridStatus = gridStatus;
        }
        if (powerFlow !== undefined) {
          result.powerFlow = powerFlow;
        }
        if (errors.length > 0) {
          result.errors = errors;
        }

        return result;
      } else {
        return {
          success: false,
          message: 'Connection partially failed - authentication worked but data retrieval failed',
          errors,
        };
      }

    } catch (error) {
      this.log.error('Connection test failed:', error);
      
      const errorMessage = (error as Error).message;
      let friendlyMessage = 'Connection test failed';
      
      if (errorMessage.includes('ECONNREFUSED')) {
        friendlyMessage = 'Connection refused - check IP address and network connectivity';
      } else if (errorMessage.includes('ENOTFOUND')) {
        friendlyMessage = 'Host not found - check IP address';
      } else if (errorMessage.includes('timeout')) {
        friendlyMessage = 'Connection timeout - check network connectivity';
      } else if (errorMessage.includes('certificate')) {
        friendlyMessage = 'SSL certificate error (this should not happen with our configuration)';
      }

      return {
        success: false,
        message: friendlyMessage,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Get system information from Tesla Powerwall
   */
  async getSystemInfo(config: TestConnectionConfig) {
    try {
      const connectionResult = await this.testConnection(config);
      
      if (!connectionResult.success) {
        return {
          success: false,
          message: connectionResult.message || 'Connection failed',
        };
      }

      return {
        success: true,
        info: {
          batteryLevel: connectionResult.batteryLevel,
          gridStatus: connectionResult.gridStatus,
          powerFlow: connectionResult.powerFlow,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.log.error('Get system info failed:', error);
      return {
        success: false,
        message: (error as Error).message,
      };
    }
  }
}
