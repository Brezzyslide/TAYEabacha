// Bootstrap script - must be imported first in server entry
// Sets timezone for Australian business requirements
process.env.TZ = process.env.TZ || "Australia/Melbourne";

console.log(`[BOOTSTRAP] Timezone set to: ${process.env.TZ}`);
console.log(`[BOOTSTRAP] Current time: ${new Date().toLocaleString('en-AU', { timeZone: process.env.TZ })}`);