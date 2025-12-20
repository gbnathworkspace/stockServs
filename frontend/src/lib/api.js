export const api = async (url, options = {}) => {
  const res = await fetch(url, options);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.detail || message;
    } catch (e) {
      // ignore
    }
    throw new Error(message);
  }
  return res.json();
};

export const authApi = async (url, options = {}) => {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('Not authenticated');

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  return api(url, { ...options, headers });
};
