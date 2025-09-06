// Utility function for making authenticated API calls
export const apiCall = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('mercania_wms_token');
  
  // If URL doesn't start with http, prepend the API base URL
  const fullUrl = url.startsWith('http') ? url : `${process.env.NEXT_PUBLIC_API_URL || 'https://mercania-wms.onrender.com'}${url}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(fullUrl, {
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
