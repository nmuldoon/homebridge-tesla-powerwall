#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * Tesla Powerwall Connection Test Script
 *
 * This script helps you test connectivity to your Tesla Powerwall
 * and verify that the credentials and network settings are correct.
 */

const { Agent, fetch } = require('undici');

// Configuration interface
const config = {
  ip: process.env.POWERWALL_IP || process.argv[2] || "",
  password: process.env.POWERWALL_PASSWORD || process.argv[3] || "",
  port: process.env.POWERWALL_PORT || process.argv[4] || "443",
};

// Show usage if required parameters are missing
if (!config.ip || !config.password) {
  console.log("🔋 Tesla Powerwall Connection Test");
  console.log("==================================");
  console.log("");
  console.log("This script tests connectivity to your Tesla Powerwall and verifies");
  console.log("that your credentials and network settings are working correctly.");
  console.log("");
  console.log("Usage:");
  console.log("  node test/integration/test-connection.js <ip> <password>");
  console.log("");
  console.log("Parameters:");
  console.log("  ip       - IP address of your Tesla Powerwall (required)");
  console.log("  password - Tesla Powerwall password (required)");
  console.log("");
  console.log("Example:");
  console.log("  node test/integration/test-connection.js 192.168.1.100 password");
  console.log("");
  process.exit(1);
}

async function testConnection() {
  try {
    console.log("🔋 Tesla Powerwall Connection Test");
    console.log("==================================");
    console.log("");
    console.log("📡 Configuration:");
    console.log(`   IP Address: ${config.ip}`);
    console.log(`   Password: ${'*'.repeat(config.password.length)}`);
    console.log("");

    // Build base URL
    const baseUrl = `https://${config.ip}`;

    // Create HTTPS dispatcher that ignores certificate warnings
    const dispatcher = new Agent({
      connect: { rejectUnauthorized: false },
    });

    console.log("🔐 Step 1: Testing authentication...");

    // Test login
    const loginResponse = await fetch(`${baseUrl}/api/login/Basic`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      dispatcher,
      body: JSON.stringify({
        username: 'customer', // Tesla Powerwall only supports 'customer' as username
        password: config.password,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed with status ${loginResponse.status}: ${loginResponse.statusText}`);
    }

    // Extract cookies from login response
    const cookiePairs = loginResponse.headers.getSetCookie();
    const cookies = cookiePairs.map(cookie => cookie.split(';')[0].trim()).filter(Boolean).join('; ');
    if (cookies) {
      console.log("🍪 Session cookies received");
    }

    console.log("✅ Authentication successful!");
    console.log("");

    console.log("🔋 Step 2: Testing battery status...");
    
    // Test battery status with cookies
    const batteryResponse = await fetch(`${baseUrl}/api/system_status/soe`, {
      method: 'GET',
      headers: cookies ? { 'Cookie': cookies } : {},
      dispatcher,
      signal: AbortSignal.timeout(10000),
    });

    if (!batteryResponse.ok) {
      throw new Error(`Battery status request failed with status ${batteryResponse.status}: ${batteryResponse.statusText}`);
    }

    const batteryData = await batteryResponse.json();
    console.log(`✅ Battery Level: ${Math.round(batteryData.percentage || 0)}%`);
    console.log("");

    console.log("⚡ Step 3: Testing power flow data...");
    
    // Test power flow with cookies
    const powerResponse = await fetch(`${baseUrl}/api/meters/aggregates`, {
      method: 'GET',
      headers: cookies ? { 'Cookie': cookies } : {},
      dispatcher,
      signal: AbortSignal.timeout(10000),
    });

    if (!powerResponse.ok) {
      throw new Error(`Power flow request failed with status ${powerResponse.status}: ${powerResponse.statusText}`);
    }

    const powerData = await powerResponse.json();
    console.log(`✅ Load Power: ${Math.round(powerData.load?.instant_power || 0)}W`);
    console.log(`✅ Solar Power: ${Math.round(powerData.solar?.instant_power || 0)}W`);
    console.log(`✅ Grid Power: ${Math.round(powerData.site?.instant_power || 0)}W`);
    console.log(`✅ Battery Power: ${Math.round(powerData.battery?.instant_power || 0)}W`);
    console.log("");

    console.log("🌐 Step 4: Testing grid status...");
    
    // Test grid status with cookies
    const gridResponse = await fetch(`${baseUrl}/api/system_status/grid_status`, {
      method: 'GET',
      headers: cookies ? { 'Cookie': cookies } : {},
      dispatcher,
      signal: AbortSignal.timeout(10000),
    });

    if (!gridResponse.ok) {
      throw new Error(`Grid status request failed with status ${gridResponse.status}: ${gridResponse.statusText}`);
    }

    const gridData = await gridResponse.json();
    const isGridConnected = gridData.grid_status === 'SystemGridConnected';
    console.log(`✅ Grid Status: ${isGridConnected ? 'Connected' : 'Disconnected (Islanded)'}`);
    console.log("");

    console.log("🎉 All tests passed successfully!");
    console.log("");
    console.log("Your Tesla Powerwall is properly configured and ready to use with Homebridge.");
    console.log("You can now add this configuration to your Homebridge config.json:");
    console.log("");
    console.log(JSON.stringify({
      "platform": "TeslaPowerwall",
      "name": "Tesla Powerwall",
      "ip": config.ip,
      "port": config.port !== "443" ? config.port : undefined,
      "password": "your-password-here",
      "pollingInterval": 15,
      "lowBattery": 20
    }, null, 2));
    console.log("");
    
    process.exit(0);
  } catch (error) {
    console.log("");
    console.log("❌ Connection test failed!");
    console.log(`   Error: ${error.message}`);
    console.log("");
    console.log("Troubleshooting steps:");
    console.log("1. ✅ Verify the IP address is correct");
    console.log("2. ✅ Check that the password is correct");
    console.log("3. ✅ Ensure your Tesla Powerwall is powered on and connected to your network");
    console.log("4. ✅ Try accessing the Powerwall web interface directly at https://" + config.ip);
    console.log("5. ✅ Check if there's a firewall blocking the connection");
    console.log("6. ✅ Verify you're on the same network as the Powerwall");
    console.log("");
    console.log("Common issues:");
    console.log("• Wrong IP address - Check your router's DHCP client list");
    console.log("• Wrong password - Reset via the Tesla app if needed");
    console.log("• Network connectivity - Ping the IP address first");
    console.log("• Certificate errors - This tool ignores SSL certificate issues");
    console.log("");
    process.exit(1);
  }
}

testConnection();
