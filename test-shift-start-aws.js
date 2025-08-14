#!/usr/bin/env node

/**
 * AWS Shift Start Debug Test
 * This script tests the shift start functionality to identify AWS-specific issues
 */

const https = require('https');
const http = require('http');

const AWS_BASE_URL = 'https://58f44f5d-68a5-4d89-b7d1-31b23ec89bf9-00-rjhkqb2ufugi.worf.replit.dev';
const LOCAL_BASE_URL = 'http://localhost:5000';

// Test configuration
const TEST_CONFIG = {
  // You'll need to provide valid credentials for your test tenant
  testUser: {
    username: 'fred@fred.com',
    password: 'fred' // Update with actual password
  },
  testShiftId: null, // Will be determined during test
  timeout: 30000 // 30 second timeout
};

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const requestModule = isHttps ? https : http;
    
    const req = requestModule.request(url, {
      timeout: TEST_CONFIG.timeout,
      ...options
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsedData = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsedData
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));
    
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function testShiftStart(baseUrl, isAWS = false) {
  console.log(`\n🧪 Testing ${isAWS ? 'AWS' : 'LOCAL'} Shift Start Functionality`);
  console.log(`🔗 Base URL: ${baseUrl}`);
  console.log('='.repeat(80));
  
  try {
    // Step 1: Health check
    console.log('1️⃣  Health Check...');
    const healthCheck = await makeRequest(`${baseUrl}/health`);
    console.log(`   Status: ${healthCheck.status}`);
    console.log(`   Response: ${JSON.stringify(healthCheck.data, null, 2)}`);
    
    if (healthCheck.status !== 200) {
      throw new Error(`Health check failed with status ${healthCheck.status}`);
    }
    
    // Step 2: Login
    console.log('\n2️⃣  User Login...');
    const loginResponse = await makeRequest(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(TEST_CONFIG.testUser)
    });
    
    console.log(`   Login Status: ${loginResponse.status}`);
    console.log(`   Login Headers:`, loginResponse.headers);
    
    if (loginResponse.status !== 200) {
      throw new Error(`Login failed with status ${loginResponse.status}: ${JSON.stringify(loginResponse.data)}`);
    }
    
    // Extract session cookie
    const sessionCookie = loginResponse.headers['set-cookie']?.find(c => c.startsWith('connect.sid='));
    if (!sessionCookie) {
      throw new Error('No session cookie received from login');
    }
    console.log(`   Session Cookie: ${sessionCookie}`);
    
    // Step 3: Get user shifts
    console.log('\n3️⃣  Fetching User Shifts...');
    const shiftsResponse = await makeRequest(`${baseUrl}/api/shifts`, {
      method: 'GET',
      headers: {
        'Cookie': sessionCookie
      }
    });
    
    console.log(`   Shifts Status: ${shiftsResponse.status}`);
    console.log(`   Number of shifts: ${shiftsResponse.data?.length || 0}`);
    
    if (shiftsResponse.status !== 200) {
      throw new Error(`Failed to fetch shifts: ${shiftsResponse.status}`);
    }
    
    // Find an assigned shift that can be started
    const assignedShifts = shiftsResponse.data.filter(s => s.status === 'assigned');
    if (assignedShifts.length === 0) {
      console.log('   ⚠️  No assigned shifts found to test with');
      return;
    }
    
    const testShift = assignedShifts[0];
    console.log(`   Using shift ID: ${testShift.id} - ${testShift.title}`);
    
    // Step 4: Test shift start
    console.log('\n4️⃣  Testing Shift Start...');
    const startTime = new Date().toISOString();
    
    const shiftStartData = {
      status: "in-progress",
      startTimestamp: startTime,
      startLocation: "37.7749,-122.4194", // San Francisco coordinates
      handoverReceivedFromStaffId: null,
      handoverNotesIn: "AWS debugging test - shift start"
    };
    
    console.log(`   Shift Start Data:`, JSON.stringify(shiftStartData, null, 2));
    
    const startResponse = await makeRequest(`${baseUrl}/api/shifts/${testShift.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify(shiftStartData)
    });
    
    console.log(`   Start Response Status: ${startResponse.status}`);
    console.log(`   Start Response:`, JSON.stringify(startResponse.data, null, 2));
    
    if (startResponse.status === 200) {
      console.log(`   ✅ ${isAWS ? 'AWS' : 'LOCAL'} shift start SUCCESSFUL`);
    } else {
      console.log(`   ❌ ${isAWS ? 'AWS' : 'LOCAL'} shift start FAILED`);
    }
    
    return {
      success: startResponse.status === 200,
      status: startResponse.status,
      data: startResponse.data
    };
    
  } catch (error) {
    console.error(`   ❌ ${isAWS ? 'AWS' : 'LOCAL'} test failed:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

async function runComparisonTest() {
  console.log('🔬 AWS vs Local Shift Start Comparison Test');
  console.log('This will test shift start functionality on both environments');
  console.log('='.repeat(80));
  
  // Test both environments
  const localResult = await testShiftStart(LOCAL_BASE_URL, false);
  const awsResult = await testShiftStart(AWS_BASE_URL, true);
  
  // Comparison
  console.log('\n📊 COMPARISON RESULTS');
  console.log('='.repeat(80));
  console.log(`Local Environment: ${localResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`AWS Environment:   ${awsResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  
  if (!localResult.success || !awsResult.success) {
    console.log('\n🚨 ISSUES DETECTED:');
    if (!localResult.success) {
      console.log(`   Local: ${localResult.error || 'Unknown error'}`);
    }
    if (!awsResult.success) {
      console.log(`   AWS: ${awsResult.error || 'Unknown error'}`);
    }
  }
  
  console.log('\n💡 Check the server logs for detailed debugging information');
  console.log('   Look for "[AWS DEBUG -" prefixed log messages');
}

// Run the test
if (require.main === module) {
  runComparisonTest().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = { testShiftStart, runComparisonTest };