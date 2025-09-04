// Simple in-memory cache utilities for dashboard stats
let dashboardStatsCache: { data: any; timestamp: number } | null = null;
const DASHBOARD_CACHE_DURATION = 30000; // 30 seconds

// Function to invalidate dashboard cache when data changes
export const invalidateDashboardCache = () => {
  dashboardStatsCache = null;
  console.log('Dashboard cache invalidated');
};

// Function to get cached dashboard stats
export const getCachedDashboardStats = () => {
  const now = Date.now();
  if (dashboardStatsCache && (now - dashboardStatsCache.timestamp) < DASHBOARD_CACHE_DURATION) {
    return dashboardStatsCache.data;
  }
  return null;
};

// Function to set cached dashboard stats
export const setCachedDashboardStats = (data: any) => {
  dashboardStatsCache = {
    data,
    timestamp: Date.now()
  };
};

// Function to check if cache is valid
export const isDashboardCacheValid = () => {
  const now = Date.now();
  return dashboardStatsCache && (now - dashboardStatsCache.timestamp) < DASHBOARD_CACHE_DURATION;
};
