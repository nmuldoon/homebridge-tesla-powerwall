import fetch from 'node-fetch';
import { Agent } from 'https';
import type { Logging } from 'homebridge';

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

    // Start login process
    this.startLoginProcess();
  }

  /**
   * Make a GET request with optional caching
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

    try {
      const headers: Record<string, string> = {};
      if (this.sessionCookies) {
        headers.Cookie = this.sessionCookies;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        agent: this.agent,
        timeout: 10000,
      });

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

      const response = await fetch(url, {
        method: 'POST',
        headers,
        agent: this.agent,
        body: JSON.stringify(body),
        timeout: 10000,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Store cookies from login response
      if (endpoint === '/api/login/Basic') {
        const setCookieHeader = response.headers.get('set-cookie');
        if (setCookieHeader) {
          const cookiePairs = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
          this.sessionCookies = cookiePairs.map(cookie => cookie.split(';')[0]).join('; ');
          this.log.debug('Session cookies updated');
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
  private startLoginProcess(): void {
    const loginInterval = 1000 * 60 * 60 * 11; // 11 hours

    const login = async () => {
      try {
        await this.post('/api/login/Basic', {
          username: this.username,
          password: this.password,
        });
        this.log.info('Tesla Powerwall login successful');
      } catch (error) {
        this.log.error('Tesla Powerwall login failed:', error);
      }
    };

    // Initial login
    login();

    // Setup periodic re-login
    setInterval(login, loginInterval);
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
}
