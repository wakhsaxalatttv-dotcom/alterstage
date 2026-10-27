/** Small bounded TTL cache; mutations invalidate it, and expiry/verification are re-evaluated at most 15s later. */
export class QueryCache {
  constructor({ max = 200, ttl = 15000, now = Date.now } = {}) {
    this.max = max;
    this.ttl = ttl;
    this.now = now;
    this.values = new Map();
  }
  get(key) {
    const value = this.values.get(key);
    if (!value) return;
    if (value.expires <= this.now()) {
      this.values.delete(key);
      return;
    }
    this.values.delete(key);
    this.values.set(key, value);
    return structuredClone(value.data);
  }
  set(key, data, ttl = this.ttl) {
    this.values.delete(key);
    this.values.set(key, {
      expires: this.now() + ttl,
      data: structuredClone(data),
    });
    while (this.values.size > this.max)
      this.values.delete(this.values.keys().next().value);
    return data;
  }
  clear() {
    this.values.clear();
  }
}
