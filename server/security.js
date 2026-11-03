// Fixed windows bound both repeated requests and the memory used for IP counters.
// No eviction of active entries: flooding new IPs cannot reset existing limits.
export function fixedWindowLimiter({limit, windowMs, maxKeys = 10000, now = Date.now}) {
  const entries = new Map();
  let lastCleanup = 0;
  return {
    blocked(key) {
      const time = now();
      const entry = entries.get(key);
      return entry && entry.until > time && entry.count >= limit
        ? Math.max(1, Math.ceil((entry.until - time) / 1000)) : 0;
    },
    consume(key) {
      const time = now();
      if (time - lastCleanup >= 60000) {
        for (const [ip, entry] of entries) if (entry.until <= time) entries.delete(ip);
        lastCleanup = time;
      }
      let entry = entries.get(key);
      if (entry && entry.until <= time) { entries.delete(key); entry = undefined; }
      if (!entry) {
        if (entries.size >= maxKeys) return Math.ceil(windowMs / 1000);
        entry = {count: 0, until: time + windowMs};
        entries.set(key, entry);
      }
      if (entry.count >= limit) return Math.max(1, Math.ceil((entry.until - time) / 1000));
      entry.count++;
      return 0;
    },
    reset(key) { entries.delete(key); },
  };
}

export function browserSecurity(req, res, next) {
  const directives = [
    "default-src 'self'", "script-src 'self'",
    // React uses inline styles for logo dimensions and decorative backgrounds.
    "style-src 'self' 'unsafe-inline'", "img-src 'self' https: data:",
    "font-src 'self'", "connect-src 'self'", "object-src 'none'",
    "frame-src 'none'", "frame-ancestors 'none'", "base-uri 'none'",
    "form-action 'self'",
  ];
  if (req.secure) {
    directives.push('upgrade-insecure-requests');
    res.set('Strict-Transport-Security', 'max-age=31536000');
  }
  res.set({
    'Content-Security-Policy': directives.join('; '),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  });
  next();
}

export function sameOriginJsonWrites(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const origin = req.get('Origin');
  let foreign = req.get('Sec-Fetch-Site') === 'cross-site';
  if (origin) {
    try {
      foreign ||= new URL(origin).origin !== `${req.protocol}://${req.get('host')}`;
    } catch { foreign = true; }
  }
  if (foreign) return res.status(403).json({message: 'Envoyez cette demande depuis le site Offres Fraîches.'});
  // API clients without Origin remain supported, including authorized imports.
  const emptyWithoutType = !req.get('Content-Type') && !req.get('Transfer-Encoding') && (!req.get('Content-Length') || req.get('Content-Length') === '0');
  if (!emptyWithoutType && !req.is('application/json')) return res.status(415).json({message: 'Une requête JSON est nécessaire.'});
  next();
}
