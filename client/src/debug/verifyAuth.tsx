import { useEffect } from "react";

export function VerifyAuth() {
  useEffect(() => {
    console.group("🔎 Auth Boot Diagnostics");

    // AWS/Production Environment Detection
    const isAWS = window.location.hostname.includes('amazonaws.com') || window.location.hostname.includes('replit.app');
    const isReplit = window.location.hostname.includes('replit.dev') || window.location.hostname.includes('replit.app');
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    console.log("🌐 Environment Detection:", {
      hostname: window.location.hostname,
      origin: window.location.origin,
      isAWS,
      isReplit,
      isLocalhost,
      protocol: window.location.protocol
    });

    // 1. Cookies Analysis
    const cookies = document.cookie;
    console.log("🍪 Cookies at boot:", cookies || "(none)");
    if (cookies) {
      const cookieArray = cookies.split(';').map(c => c.trim());
      console.log("🍪 Individual cookies:", cookieArray);
      
      // Look for session cookies specifically
      const sessionCookie = cookieArray.find(c => c.startsWith('connect.sid=') || c.startsWith('session='));
      console.log("🍪 Session cookie found:", sessionCookie || "(none)");
    }

    // 2. Page Load Type Detection
    const performanceEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    const navType = performanceEntries[0]?.type || 'unknown';
    console.log("📄 Page load type:", navType, "(reload/navigate/back_forward/prerender)");

    // 3. Test API call with detailed response analysis
    fetch(`/api/auth/user`, {
      method: "GET", 
      credentials: "include",
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    })
      .then(async (res) => {
        console.log("🔐 Auth /user status:", res.status);
        console.log("🔐 Auth /user headers:", Array.from(res.headers.entries()));
        
        // Check for Set-Cookie headers
        const setCookieHeaders = res.headers.get('set-cookie');
        console.log("🔐 Set-Cookie from response:", setCookieHeaders || "(none)");
        
        if (res.ok) {
          const data = await res.json();
          console.log("🔐 Auth /user payload:", data);
          console.log("🔐 User authenticated:", !!data.id);
        } else {
          console.log("❌ Auth /user failed with status:", res.status);
          const text = await res.text();
          console.log("❌ Auth /user error response:", text);
        }
      })
      .catch((err) => console.error("❌ Auth /user network error:", err));

    // 4. Current route and referrer analysis
    console.log("🧭 Current location:", window.location.pathname);
    console.log("🧭 Current search:", window.location.search);
    console.log("🧭 Current hash:", window.location.hash);
    console.log("🧭 Document referrer:", document.referrer);
    console.log("🧭 Navigation entries:", window.history.length);

    // 5. Environment variables
    console.log("⚙️ Environment vars:", {
      VITE_API_URL: import.meta.env.VITE_API_URL,
      VITE_COOKIE_DOMAIN: import.meta.env.VITE_COOKIE_DOMAIN,
      AUTH_COOKIE_DOMAIN: import.meta.env.VITE_AUTH_COOKIE_DOMAIN,
      NODE_ENV: import.meta.env.MODE,
      DEV: import.meta.env.DEV,
      PROD: import.meta.env.PROD,
      BASE_URL: import.meta.env.BASE_URL,
    });

    // 6. Storage analysis
    console.log("💾 Session Storage:", { ...sessionStorage });
    console.log("💾 Local Storage:", { ...localStorage });

    // 7. Network connectivity test
    fetch('/api/health', {
      method: 'GET',
      credentials: 'include'
    })
      .then(res => {
        console.log("❤️ Health check status:", res.status);
        return res.json();
      })
      .then(data => console.log("❤️ Health check response:", data))
      .catch(err => console.log("❌ Health check failed:", err));

    // 8. Browser and connection info
    console.log("🌍 User Agent:", navigator.userAgent);
    console.log("🌍 Browser Online:", navigator.onLine);
    console.log("🌍 Connection:", (navigator as any).connection?.effectiveType || 'unknown');
    console.log("🌍 Language:", navigator.language);
    console.log("🌍 Platform:", navigator.platform);

    // 9. Timing information
    console.log("⏱️ Performance timing:", {
      domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
      loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart,
      timeOrigin: performance.timeOrigin
    });

    console.groupEnd();
  }, []);

  return null;
}