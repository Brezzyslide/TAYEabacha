/**
 * TEST SCRIPT FOR PROVISIONING VALIDATION SYSTEM
 * Demonstrates the checkProvisioning function with your exact API structure
 */

import { checkProvisioning, quickHealthCheck, validateAllTenants } from './server/tenant-provisioning-validator.js';

async function runProvisioningTests() {
  console.log('🚀 PROVISIONING VALIDATION SYSTEM TEST');
  console.log('=====================================\n');

  // Test 1: Your exact API structure
  console.log('📋 Test 1: Using your exact checkProvisioning structure');
  try {
    const result1 = await checkProvisioning({
      tenantId: "1",
      expect: {
        hasAtLeast: {
          taxBrackets: 3,
          hourAllocations: 1,
          employmentTypes: 3
        }
      }
    });
    
    console.log('✅ Tenant 1 Validation Result:');
    console.log(`   Status: ${result1.passed ? 'PASSED' : 'FAILED'}`);
    console.log(`   Checks: ${result1.summary.passedChecks}/${result1.summary.totalChecks}`);
    console.log('   Details:');
    for (const [check, data] of Object.entries(result1.results)) {
      console.log(`     ${data.passed ? '✓' : '✗'} ${check}: ${data.actual}/${data.expected}`);
    }
    console.log('');
  } catch (error) {
    console.log('❌ Test 1 failed:', error.message);
  }

  // Test 2: Extended validation
  console.log('📋 Test 2: Extended provisioning validation');
  try {
    const result2 = await checkProvisioning({
      tenantId: 2,
      expect: {
        hasAtLeast: {
          taxBrackets: 5,
          hourAllocations: 2,
          employmentTypes: 3,
          clients: 3,
          users: 2,
          payScales: 10
        }
      }
    });
    
    console.log('✅ Tenant 2 Extended Validation:');
    console.log(`   Status: ${result2.passed ? 'PASSED' : 'FAILED'}`);
    console.log(`   Checks: ${result2.summary.passedChecks}/${result2.summary.totalChecks}`);
    if (result2.errors.length > 0) {
      console.log(`   Errors: ${result2.errors.join(', ')}`);
    }
    console.log('');
  } catch (error) {
    console.log('❌ Test 2 failed:', error.message);
  }

  // Test 3: Quick health check
  console.log('📋 Test 3: Quick health check');
  try {
    const isHealthy = await quickHealthCheck(1);
    console.log(`✅ Tenant 1 Health: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
    console.log('');
  } catch (error) {
    console.log('❌ Test 3 failed:', error.message);
  }

  // Test 4: Validate all tenants
  console.log('📋 Test 4: Validate all tenants');
  try {
    const allResults = await validateAllTenants({
      hasAtLeast: {
        taxBrackets: 3,
        hourAllocations: 1,
        employmentTypes: 3
      }
    });
    
    console.log(`✅ All Tenants Validation (${allResults.length} tenants):`);
    const passed = allResults.filter(r => r.passed).length;
    console.log(`   Overall: ${passed}/${allResults.length} tenants passed`);
    console.log(`   Success Rate: ${((passed / allResults.length) * 100).toFixed(1)}%`);
    console.log('');
  } catch (error) {
    console.log('❌ Test 4 failed:', error.message);
  }

  console.log('🎯 PROVISIONING VALIDATION TESTS COMPLETE');
  console.log('==========================================');
}

// Example API usage
console.log('📖 USAGE EXAMPLES:');
console.log('==================');
console.log('');
console.log('// Your exact API structure:');
console.log('checkProvisioning({');
console.log('  tenantId: "xxx",');
console.log('  expect: {');
console.log('    hasAtLeast: {');
console.log('      taxBrackets: 3,');
console.log('      hourAllocations: 1,');
console.log('      employmentTypes: 3');
console.log('    }');
console.log('  }');
console.log('})');
console.log('');
console.log('// Available API endpoints:');
console.log('POST /api/provisioning/check');
console.log('GET  /api/provisioning/validate-all');
console.log('GET  /api/provisioning/health/:tenantId');
console.log('');

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runProvisioningTests().catch(console.error);
}

export { runProvisioningTests };