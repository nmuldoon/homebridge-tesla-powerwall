#!/usr/bin/env node

/**
 * Grid Power Sensor Validation Script
 * 
 * This script validates that the grid power sensors are working correctly
 * by checking the power flow data from the Powerwall API.
 */

/* eslint-disable no-console */

const fetch = require('node-fetch');
const { Agent } = require('https');

// Configuration
const config = {
  ip: process.env.POWERWALL_IP || process.argv[2] || '',
  password: process.env.POWERWALL_PASSWORD || process.argv[3] || '',
  username: process.env.POWERWALL_USERNAME || 'customer',
  threshold: parseInt(process.env.GRID_THRESHOLD || process.argv[4] || '50', 10),
};

// Show usage if required parameters are missing
if (!config.ip || !config.password) {
  console.log('🔋 Tesla Powerwall Grid Power Sensor Validator');
  console.log('=============================================');
  console.log('');
  console.log('This script validates the grid power sensor functionality by reading');
  console.log('power flow data from your Tesla Powerwall.');
  console.log('');
  console.log('Usage:');
  console.log('  node test/integration/validate-grid-sensors.js <ip> <password> [threshold]');
  console.log('');
  console.log('Parameters:');
  console.log('  ip        - IP address of your Tesla Powerwall (required)');
  console.log('  password  - Tesla Powerwall password (required)');
  console.log('  threshold - Grid sensor threshold in watts (default: 50)');
  console.log('');
  console.log('Example:');
  console.log('  node test/integration/validate-grid-sensors.js 192.168.1.100 mypassword 50');
  console.log('');
  process.exit(1);
}

async function validateGridSensors() {
  try {
    console.log('🔋 Tesla Powerwall Grid Power Sensor Validator');
    console.log('=============================================');
    console.log('');
    console.log('📡 Configuration:');
    console.log(`   IP Address: ${config.ip}`);
    console.log(`   Username: ${config.username} (default)`);
    console.log(`   Threshold: ${config.threshold}W`);
    console.log('');

    const baseUrl = `https://${config.ip}`;
    const agent = new Agent({ rejectUnauthorized: false });

    // Step 1: Login
    console.log('🔐 Step 1: Authenticating...');
    const loginResponse = await fetch(`${baseUrl}/api/login/Basic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      agent: agent,
      body: JSON.stringify({
        username: config.username,
        password: config.password,
      }),
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
    }

    // Extract cookies
    const setCookie = loginResponse.headers.get('set-cookie');
    if (!setCookie) {
      throw new Error('No session cookie received from login');
    }

    const sessionCookie = setCookie.split(';')[0];
    console.log('✅ Authentication successful');
    console.log('');

    // Step 2: Get meters aggregates
    console.log('📊 Step 2: Reading power flow data...');
    const metersResponse = await fetch(`${baseUrl}/api/meters/aggregates`, {
      method: 'GET',
      headers: { Cookie: sessionCookie },
      agent: agent,
    });

    if (!metersResponse.ok) {
      throw new Error(`Failed to get meters: ${metersResponse.status} ${metersResponse.statusText}`);
    }

    const metersData = await metersResponse.json();
    console.log('✅ Power flow data retrieved');
    console.log('');

    // Step 3: Analyze grid power
    const sitePower = metersData.site?.instant_power || 0;
    const solarPower = metersData.solar?.instant_power || 0;
    const batteryPower = metersData.battery?.instant_power || 0;
    const loadPower = metersData.load?.instant_power || 0;

    console.log('⚡ Current Power Flow:');
    console.log(`   Grid (site): ${sitePower.toFixed(1)}W ${sitePower > 0 ? '(importing ⬇️)' : sitePower < 0 ? '(exporting ⬆️)' : '(idle)'}`);
    console.log(`   Solar: ${solarPower.toFixed(1)}W`);
    console.log(`   Battery: ${batteryPower.toFixed(1)}W ${batteryPower > 0 ? '(discharging)' : batteryPower < 0 ? '(charging)' : '(idle)'}`);
    console.log(`   Load (home): ${loadPower.toFixed(1)}W`);
    console.log('');

    // Step 4: Evaluate sensor states
    console.log('🎯 Grid Power Sensor States:');
    console.log('');

    // Feeding sensor (exporting to grid)
    const isFeedingToGrid = sitePower < -config.threshold;
    console.log(`   📡 FEEDING TO GRID Sensor:`);
    console.log(`      Current: ${sitePower.toFixed(1)}W`);
    console.log(`      Threshold: < -${config.threshold}W`);
    console.log(`      State: ${isFeedingToGrid ? '✅ DETECTED (Contact Open)' : '⚪ NOT DETECTED (Contact Closed)'}`);
    if (isFeedingToGrid) {
      console.log(`      💡 You are exporting ${Math.abs(sitePower).toFixed(1)}W to the grid!`);
    }
    console.log('');

    // Pulling sensor (importing from grid)
    const isPullingFromGrid = sitePower > config.threshold;
    console.log(`   📡 PULLING FROM GRID Sensor:`);
    console.log(`      Current: ${sitePower.toFixed(1)}W`);
    console.log(`      Threshold: > ${config.threshold}W`);
    console.log(`      State: ${isPullingFromGrid ? '✅ DETECTED (Contact Open)' : '⚪ NOT DETECTED (Contact Closed)'}`);
    if (isPullingFromGrid) {
      console.log(`      💡 You are importing ${sitePower.toFixed(1)}W from the grid!`);
    }
    console.log('');

    // Step 5: Recommendations
    console.log('📋 Summary:');
    if (!isFeedingToGrid && !isPullingFromGrid) {
      console.log('   ℹ️  Grid power is below threshold - sensors will not trigger');
      console.log('   ℹ️  This is normal when battery is meeting all loads');
    } else if (isFeedingToGrid) {
      console.log('   ✅ Grid feeding sensor would trigger automations');
      console.log('   💡 Use this to know when you have excess power to use');
    } else if (isPullingFromGrid) {
      console.log('   ✅ Grid pulling sensor would trigger automations');
      console.log('   💡 Use this to reduce consumption during peak times');
    }
    console.log('');

    console.log('✅ Validation complete!');
    console.log('');
    console.log('💡 Next Steps:');
    console.log('   1. Add these sensors to your HomeKit setup');
    console.log('   2. Create automations based on sensor states');
    console.log('   3. Adjust threshold if needed (current: ' + config.threshold + 'W)');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Validation failed:', error.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error('  - Verify your IP address is correct');
    console.error('  - Check that your password is correct');
    console.error('  - Ensure your Powerwall is accessible on the network');
    console.error('  - Try accessing https://' + config.ip + ' in a browser');
    console.error('');
    process.exit(1);
  }
}

// Run the validator
validateGridSensors();
