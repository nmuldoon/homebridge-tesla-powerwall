import { Agent } from 'https';
import type { Logging } from 'homebridge';

// Use require for node-fetch to avoid ES module issues
const fetch = require('node-fetch');

export class HttpClient {
  private readonly baseUrl: string;
  private readonly agent: Agent;
  private readonly cache: Map<string, { data: any; timestamp: number }> = new Map();
  private sessionCookies: string = '';

  constructor(
    private readonly ip: string,
    private readonly port: string,
    private readonly username: string,
    private readonly password: string,
    private readonly log: Logging,
  ) {
    // Build base URL
    if (port !== '') {
      this.baseUrl = `https://${ip}:${port}`;
    } else {
      this.baseUrl = `https://${ip}`;
    }

    // Create HTTPS agent that ignores certificate warnings
    this.agent = new Agent({
      rejectUnauthorized: false,
    });

    // Start login process (but don't await in constructor)
    this.startLoginProcess().catch(error => {
      this.log.error('Failed to start login process:', error);
    });
  }

  /**
   * Ensure we are authenticated before making requests
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.sessionCookies) {
      this.log.debug('No session cookies, authenticating...');
      await this.authenticate();
    }
  }

  /**
   * Make a GET request with optional caching and auto re-authentication
   */
  async get(endpoint: string, cacheInterval?: number): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Check cache if caching is enabled
    if (cacheInterval) {
      const cached = this.cache.get(url);
      if (cached && (Date.now() - cached.timestamp) < cacheInterval) {
        return cached.data;
      }
    }

    // Ensure we're authenticated before making the request
    await this.ensureAuthenticated();

    try {
      const headers: Record<string, string> = {};
      if (this.sessionCookies) {
        headers.Cookie = this.sessionCookies;
      }

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method: 'GET',
        headers,
        agent: this.agent,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle 401 by re-authenticating and retrying
      if (response.status === 401) {
        this.log.debug('Received 401, re-authenticating...');
        await this.authenticate();
        
        // Retry the request with new session
        const retryHeaders: Record<string, string> = {};
        if (this.sessionCookies) {
          retryHeaders.Cookie = this.sessionCookies;
        }

        // Create abort controller for retry timeout
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), 10000);

        const retryResponse = await fetch(url, {
          method: 'GET',
          headers: retryHeaders,
          agent: this.agent,
          signal: retryController.signal,
        });

        clearTimeout(retryTimeoutId);

        if (!retryResponse.ok) {
          throw new Error(`HTTP ${retryResponse.status}: ${retryResponse.statusText}`);
        }

        const data = await retryResponse.json();

        // Cache the result if caching is enabled
        if (cacheInterval) {
          this.cache.set(url, {
            data,
            timestamp: Date.now(),
          });
        }

        return data;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Cache the result if caching is enabled
      if (cacheInterval) {
        this.cache.set(url, {
          data,
          timestamp: Date.now(),
        });
      }

      return data;
    } catch (error) {
      this.log.error(`Request failed for ${url}:`, error);
      throw error;
    }
  }

  /**
   * Make a POST request
   */
  async post(endpoint: string, body: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (this.sessionCookies) {
        headers.Cookie = this.sessionCookies;
      }

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        agent: this.agent,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Store cookies from login response
      if (endpoint === '/api/login/Basic') {
        const setCookieHeader = response.headers.get('set-cookie');
        if (setCookieHeader) {
          // Handle both string and array formats
          let cookieStrings: string[];
          if (Array.isArray(setCookieHeader)) {
            cookieStrings = setCookieHeader;
          } else {
            cookieStrings = [setCookieHeader];
          }
          
          // Extract cookie name=value pairs, ignoring attributes
          const cookiePairs = cookieStrings.map(cookie => {
            const parts = cookie.split(';');
            return parts[0]?.trim() || ''; // Just the name=value part
          }).filter(cookie => cookie.length > 0);
          
          this.sessionCookies = cookiePairs.join('; ');
          this.log.debug('Session cookies updated:', this.sessionCookies.length > 0 ? 'Success' : 'Empty');
        } else {
          this.log.warn('No session cookies received from login response');
        }
      }

      return await response.json();
    } catch (error) {
      this.log.error(`POST request failed for ${url}:`, error);
      throw error;
    }
  }

  /**
   * Start the login process and maintain authentication
   */
  private async startLoginProcess(): Promise<void> {
    const loginInterval = 1000 * 60 * 60 * 11; // 11 hours

    // Initial login - wait for it to complete
    try {
      await this.authenticate();
    } catch (error) {
      this.log.error('Initial authentication failed:', error);
    }

    // Setup periodic re-login
    setInterval(async () => {
      try {
        await this.authenticate();
      } catch (error) {
        this.log.error('Periodic authentication failed:', error);
      }
    }, loginInterval);
  }

  /**
   * Authenticate with the Tesla Powerwall
   */
  async authenticate(): Promise<void> {
    try {
      await this.post('/api/login/Basic', {
        username: this.username,
        password: this.password,
      });
      this.log.debug('Tesla Powerwall authentication successful');
    } catch (error) {
      this.log.error('Tesla Powerwall authentication failed:', error);
      throw error;
    }
  }

  /**
   * Get system status including state of energy
   */
  async getSystemStatus(): Promise<any> {
    return this.get('/api/system_status/soe');
  }

  /**
   * Get meters aggregates (power flow data)
   */
  async getMetersAggregates(): Promise<any> {
    return this.get('/api/meters/aggregates');
  }

  /**
   * Get site master information
   */
  async getSiteMaster(): Promise<any> {
    return this.get('/api/sitemaster');
  }

  /**
   * Get grid status
   */
  async getGridStatus(): Promise<any> {
    return this.get('/api/system_status/grid_status');
  }

  /**
   * Test connection to the Tesla Powerwall
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getSystemStatus();
      return true;
    } catch (error) {
      this.log.error('Connection test failed:', error);
      return false;
    }
  }
}
