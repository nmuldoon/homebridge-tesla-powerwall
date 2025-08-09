import { Agent } from 'https';
import type { Logging } from 'homebridge';

// Use require for node-fetch to avoid ES module issues
const fetch = require('node-fetch');

export class HttpClient {
  private readonly baseUrl: string;
  private readonly agent: Agent;
  private readonly cache: Map<string, { data: any; timestamp: number }> = new Map();
  private sessionCookies: string = '';
  private lastAuthAttempt: number = 0;
  private authInProgress: Promise<void> | null = null;
  private loginIntervalId: NodeJS.Timeout | null = null;

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
   * Clear session cookies (useful for testing or forced re-auth)
   */
  clearSession(): void {
    this.sessionCookies = '';
    this.log.debug('Session cookies cleared');
  }

  /**
   * Authenticate with rate limiting protection
   */
  private async authenticateWithRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastAuth = now - this.lastAuthAttempt;
    const minInterval = 5000; // 5 seconds minimum between auth attempts

    // If authentication is already in progress, wait for it
    if (this.authInProgress) {
      this.log.debug('Authentication already in progress, waiting...');
      return this.authInProgress;
    }

    // Rate limiting: wait if we tried too recently
    if (timeSinceLastAuth < minInterval) {
      const waitTime = minInterval - timeSinceLastAuth;
      this.log.debug(`Rate limiting: waiting ${waitTime}ms before authentication`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Start authentication
    this.authInProgress = this.authenticate();
    this.lastAuthAttempt = Date.now();

    try {
      await this.authInProgress;
    } finally {
      this.authInProgress = null;
    }
  }

  /**
   * Make a request with automatic retry, rate limiting, and auth handling
   */
  private async makeRequest(
    method: 'GET' | 'POST',
    endpoint: string,
    body?: any,
    cacheInterval?: number
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Check cache for GET requests if caching is enabled
    if (method === 'GET' && cacheInterval) {
      const cached = this.cache.get(url);
      if (cached && (Date.now() - cached.timestamp) < cacheInterval) {
        return cached.data;
      }
    }

    // Ensure we're authenticated before making the request (except for login)
    if (endpoint !== '/api/login/Basic') {
      await this.ensureAuthenticated();
    }

    return this.executeRequestWithRetry(method, url, endpoint, body, cacheInterval);
  }

  /**
   * Execute a request with automatic retry for 401 and 429 errors
   */
  private async executeRequestWithRetry(
    method: 'GET' | 'POST',
    url: string,
    endpoint: string,
    body?: any,
    cacheInterval?: number,
    isRetry: boolean = false
  ): Promise<any> {
    try {
      const response = await this.executeSingleRequest(method, url, body);

      // Handle 429 Rate Limiting
      if (response.status === 429) {
        if (isRetry) {
          throw new Error('Rate limit retry failed');
        }
        
        const retryAfter = response.headers.get('retry-after') || '30';
        const waitTime = parseInt(retryAfter) * 1000;
        this.log.warn(`Rate limited (429) on ${method}, waiting ${waitTime}ms before retry`);
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.executeRequestWithRetry(method, url, endpoint, body, cacheInterval, true);
      }

      // Handle 401 by re-authenticating and retrying
      if (response.status === 401 && !isRetry && endpoint !== '/api/login/Basic') {
        this.log.debug('Received 401, re-authenticating...');
        await this.authenticateWithRateLimit();
        return this.executeRequestWithRetry(method, url, endpoint, body, cacheInterval, true);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Handle cookie extraction for login
      if (endpoint === '/api/login/Basic') {
        this.extractAndStoreCookies(response);
      }

      const data = await response.json();

      // Cache the result for GET requests if caching is enabled
      if (method === 'GET' && cacheInterval) {
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
   * Execute a single HTTP request with timeout
   */
  private async executeSingleRequest(
    method: 'GET' | 'POST',
    url: string,
    body?: any
  ): Promise<Response> {
    const headers: Record<string, string> = {};
    
    if (method === 'POST') {
      headers['Content-Type'] = 'application/json';
    }
    
    if (this.sessionCookies) {
      headers.Cookie = this.sessionCookies;
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const fetchOptions: any = {
        method,
        headers,
        agent: this.agent,
        signal: controller.signal,
      };

      if (method === 'POST' && body) {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Extract and store session cookies from response
   */
  private extractAndStoreCookies(response: Response): void {
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

  /**
   * Make a GET request with optional caching and auto re-authentication
   */
  async get(endpoint: string, cacheInterval?: number): Promise<any> {
    return this.makeRequest('GET', endpoint, undefined, cacheInterval);
  }

  /**
   * Make a POST request
   */
  async post(endpoint: string, body: any): Promise<any> {
    return this.makeRequest('POST', endpoint, body);
  }

  /**
   * Start the login process and maintain authentication
   */
  private async startLoginProcess(): Promise<void> {
    const loginInterval = 1000 * 60 * 60 * 11; // 11 hours

    // Initial login - wait for it to complete
    try {
      await this.authenticateWithRateLimit();
    } catch (error) {
      this.log.error('Initial authentication failed:', error);
    }

    // Setup periodic re-login
    this.loginIntervalId = setInterval(async () => {
      try {
        await this.authenticateWithRateLimit();
      } catch (error) {
        this.log.error('Periodic authentication failed:', error);
      }
    }, loginInterval);
  }

  /**
   * Cleanup resources and stop background processes
   */
  destroy(): void {
    if (this.loginIntervalId) {
      clearInterval(this.loginIntervalId);
      this.loginIntervalId = null;
    }
    this.cache.clear();
    this.sessionCookies = '';
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
