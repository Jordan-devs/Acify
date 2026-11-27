// Tiny fetch wrapper. Auth lives in an httpOnly cookie, so no tokens are handled in JS.
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

async function request(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: {
      'X-Requested-With': 'actify', // required by the server (CSRF defence)
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) onUnauthorized();
    throw new Error(data.error || 'Something went wrong. Please try again.');
  }
  return data;
}

export const api = {
  me: () => request('GET', '/auth/me'),
  signup: (b) => request('POST', '/auth/signup', b),
  login: (b) => request('POST', '/auth/login', b),
  logout: () => request('POST', '/auth/logout'),
  users: () => request('GET', '/users'),
  list: () => request('GET', '/actionables'),
  create: (b) => request('POST', '/actionables', b),
  update: (id, b) => request('PATCH', `/actionables/${id}`, b),
  remove: (id) => request('DELETE', `/actionables/${id}`),
  restore: (id) => request('POST', `/actionables/${id}/restore`),
};
