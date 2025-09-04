// Utility function for making authenticated API calls
export const apiCall = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('mercania_wms_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // If we get a 401, the token is invalid
  if (response.status === 401) {
    localStorage.removeItem('mercania_wms_token');
    // Don't reload immediately, let the AuthContext handle the redirect
    throw new Error('Authentication required');
  }

  return response;
};
