import type { Logging } from 'homebridge';
export declare class HttpClient {
    private readonly ip;
    private readonly port;
    private readonly username;
    private readonly password;
    private readonly email;
    private readonly log;
    private readonly baseUrl;
    private readonly agent;
    private readonly cache;
    constructor(ip: string, port: string, username: string, password: string, email: string, log: Logging);
    /**
     * Make a GET request with optional caching
     */
    get(endpoint: string, cacheInterval?: number): Promise<any>;
    /**
     * Make a POST request
     */
    post(endpoint: string, body: any): Promise<any>;
    /**
     * Start the login process and maintain authentication
     */
    private startLoginProcess;
    /**
     * Get system status including state of energy
     */
    getSystemStatus(): Promise<any>;
    /**
     * Get meters aggregates (power flow data)
     */
    getMetersAggregates(): Promise<any>;
    /**
     * Get site master information
     */
    getSiteMaster(): Promise<any>;
    /**
     * Get grid status
     */
    getGridStatus(): Promise<any>;
}
//# sourceMappingURL=http-client.d.ts.map