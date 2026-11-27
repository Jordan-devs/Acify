import jwt from 'jsonwebtoken';

export const COOKIE_NAME = 'actify_token';
const WEEK = 7 * 24 * 60 * 60 * 1000;

export function setAuthCookie(res, userId) {
  const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: '7d',
    algorithm: 'HS256',
  });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true, // JS can't read it -> XSS can't steal it
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict', // not sent on cross-site requests -> CSRF defence
    maxAge: WEEK,
    path: '/',
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Please log in.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.userId = payload.sub;
    next();
  } catch {
    clearAuthCookie(res);
    res.status(401).json({ error: 'Your session has expired. Please log in again.' });
  }
}

// Extra CSRF layer: state-changing requests must carry a custom header.
// Cross-site forms can't set it, and cross-origin fetches need a CORS preflight we never approve.
export function requireCustomHeader(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'actify') {
    return res.status(403).json({ error: 'Forbidden.' });
  }
  next();
}
