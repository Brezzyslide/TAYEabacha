// Production-specific configuration for auto-refresh and session management
export const PRODUCTION_CONFIG = {
  // Auto-refresh settings
  AUTO_REFRESH: {
    ENABLED: true,
    INTERVALS: {
      INCIDENT_REPORTS: 30000,    // 30 seconds
      NOTIFICATIONS: 15000,       // 15 seconds  
      CLIENT_DATA: 60000,         // 1 minute
      STAFF_DATA: 120000,         // 2 minutes
      GENERAL: 45000              // 45 seconds default
    }
  },

  // Session stability settings
  SESSION: {
    REFRESH_INTERVAL: 300000,     // 5 minutes
    ACTIVITY_TIMEOUT: 600000,     // 10 minutes
    CHECK_INTERVAL: 60000,        // 1 minute
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 2000            // 2 seconds
  },

  // Cache management
  CACHE: {
    INVALIDATE_ON_FOCUS: true,
    STALE_TIME: 30000,           // 30 seconds
    GARBAGE_COLLECT_INTERVAL: 300000, // 5 minutes
    MAX_CACHE_SIZE: 100          // Max 100 cached queries
  },

  // Network settings
  NETWORK: {
    TIMEOUT: 30000,              // 30 seconds
    RETRY_COUNT: 3,
    RETRY_DELAY: 1000,           // 1 second
    BACKOFF_MULTIPLIER: 2
  }
};

// Environment detection
export const isProduction = () => {
  return import.meta.env.PROD || 
         window.location.hostname.includes('.replit.app') ||
         window.location.hostname !== 'localhost';
};

// Get config based on environment
export const getConfig = () => {
  if (isProduction()) {
    return PRODUCTION_CONFIG;
  }
  
  // Development config with less aggressive refresh
  return {
    ...PRODUCTION_CONFIG,
    AUTO_REFRESH: {
      ...PRODUCTION_CONFIG.AUTO_REFRESH,
      INTERVALS: {
        ...PRODUCTION_CONFIG.AUTO_REFRESH.INTERVALS,
        INCIDENT_REPORTS: 60000,  // 1 minute in dev
        NOTIFICATIONS: 30000,     // 30 seconds in dev
        GENERAL: 90000           // 1.5 minutes in dev
      }
    }
  };
};