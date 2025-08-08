"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpClient = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const https_1 = require("https");
class HttpClient {
    ip;
    port;
    username;
    password;
    email;
    log;
    baseUrl;
    agent;
    cache = new Map();
    constructor(ip, port, username, password, email, log) {
        this.ip = ip;
        this.port = port;
        this.username = username;
        this.password = password;
        this.email = email;
        this.log = log;
        // Build base URL
        if (port !== '') {
            this.baseUrl = `https://${ip}:${port}`;
        }
        else {
            this.baseUrl = `https://${ip}`;
        }
        // Create HTTPS agent that ignores certificate warnings
        this.agent = new https_1.Agent({
            rejectUnauthorized: false,
        });
        // Start login process
        this.startLoginProcess();
    }
    /**
     * Make a GET request with optional caching
     */
    async get(endpoint, cacheInterval) {
        const url = `${this.baseUrl}${endpoint}`;
        // Check cache if caching is enabled
        if (cacheInterval) {
            const cached = this.cache.get(url);
            if (cached && (Date.now() - cached.timestamp) < cacheInterval) {
                return cached.data;
            }
        }
        try {
            const response = await (0, node_fetch_1.default)(url, {
                method: 'GET',
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
        }
        catch (error) {
            this.log.error(`Request failed for ${url}:`, error);
            throw error;
        }
    }
    /**
     * Make a POST request
     */
    async post(endpoint, body) {
        const url = `${this.baseUrl}${endpoint}`;
        try {
            const response = await (0, node_fetch_1.default)(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                agent: this.agent,
                body: JSON.stringify(body),
                timeout: 10000,
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        }
        catch (error) {
            this.log.error(`POST request failed for ${url}:`, error);
            throw error;
        }
    }
    /**
     * Start the login process and maintain authentication
     */
    startLoginProcess() {
        const loginInterval = 1000 * 60 * 60 * 11; // 11 hours
        const login = async () => {
            try {
                await this.post('/api/login/Basic', {
                    username: this.username,
                    password: this.password,
                    email: this.email,
                });
                this.log.info('Tesla Powerwall login successful');
            }
            catch (error) {
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
    async getSystemStatus() {
        return this.get('/api/system_status/soe');
    }
    /**
     * Get meters aggregates (power flow data)
     */
    async getMetersAggregates() {
        return this.get('/api/meters/aggregates');
    }
    /**
     * Get site master information
     */
    async getSiteMaster() {
        return this.get('/api/sitemaster');
    }
    /**
     * Get grid status
     */
    async getGridStatus() {
        return this.get('/api/system_status/grid_status');
    }
}
exports.HttpClient = HttpClient;
