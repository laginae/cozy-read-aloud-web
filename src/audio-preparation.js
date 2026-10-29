import shared from "../vendor/mobile/preparation-pool.js";
export const { PlaybackTimings } = shared;
export const audioKey = (text, s) => JSON.stringify([s.model, s.onlineVoice, text]);
const sameConfiguration = (a, b) => ["engine", "key", "model", "onlineVoice", "consent"].every(k => a[k] === b[k]);

// Cancelled operations retain their slot until settled. No credentials in keys.
export class AudioPreparation {
  constructor(settings, cache, fetcher, timings, request, validate) {
    Object.assign(this, { settings, cache, fetcher, timings, request, validate });
    this.epoch = 0;
    this.operations = new Map();
    this.speculative = new Set();
    this.failures = new Map();
    this.pool = new shared.PreparationPool({ maxEntries: 0, timings });
  }
  select(key) {
    this.selectedKey = key;
    this.pool.select(key);
    for (const [other, operation] of this.operations) if (other !== key) this.cancelOperation(other, operation);
  }
  cancelOperation(key, operation) {
    const entry = this.pool.entries.get(key);
    if (entry?.background) this.timings.count("cancelledPrefetchRequests");
    if (entry) this.pool.drop(entry);
    operation.abort.abort();
  }
  cancel() {
    this.epoch++;
    this.failures.clear();
    for (const [key, operation] of this.operations) this.cancelOperation(key, operation);
    this.pool.clear();
  }
  pause(paused) {
    this.pool.pause(paused);
    if (paused) for (const [key, operation] of this.operations)
      if (this.pool.entries.get(key)?.background) this.cancelOperation(key, operation);
  }
  clearCache() {
    this.cancel();
    for (const key of this.speculative) this.timings.count("unusedPrefetchSegments");
    this.speculative.clear();
    this.cache.clear();
  }
  async prepare(text, snapshot, background = false) {
    this.validate(text, snapshot);
    if (!sameConfiguration(snapshot, this.settings)) throw new Error("语音设置已改变，请重新开始。");
    const key = audioKey(text, snapshot), epoch = this.epoch;
    if (this.failures.has(key)) throw this.failures.get(key);
    if (!background && this.speculative.delete(key)) this.timings.count("prefetchUsed");
    if (this.cache.has(key)) {
      this.timings.count("cacheHit");
      const value = this.cache.get(key);
      this.cache.delete(key); this.cache.set(key, value);
      return value;
    }
    const valid = () => epoch === this.epoch && sameConfiguration(snapshot, this.settings);
    const phase = value => { if (!background && valid() && this.selectedKey === key) this.onphase?.(value); };
    phase("queue");
    return this.pool.get(key, async () => {
      const abort = new AbortController(), operation = { abort };
      this.operations.set(key, operation);
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; abort.abort(); }, 60000);
      const started = this.timings.now();
      this.timings.count(background ? "prefetchRequests" : "foregroundRequests");
      this.timings.counts.synthesizedCharacters = (this.timings.counts.synthesizedCharacters || 0) + text.length;
      try {
        phase("request");
        const blob = await this.request(text, snapshot, abort.signal, this.fetcher, phase);
        if (!valid() || abort.signal.aborted) throw Object.assign(new Error("Preparation cancelled"), { name: "AbortError" });
        this.timings.record("responseReady", this.timings.now() - started);
        this.cache.set(key, blob);
        if (this.pool.entries.get(key)?.background) this.speculative.add(key);
        while (this.cache.size > 8 || [...this.cache.values()].reduce((n,b) => n+b.size,0) > 20*1024*1024) {
          const oldest = this.cache.keys().next().value;
          if (this.speculative.delete(oldest)) this.timings.count("unusedPrefetchSegments");
          this.cache.delete(oldest);
        }
        return blob;
      } catch(error) {
        if (timedOut) error = new Error("语音合成等待超过 60 秒，已停止，没有自动重试。");
        if (valid() && (!abort.signal.aborted || timedOut) && background) this.failures.set(key, error);
        throw error;
      } finally {
        clearTimeout(timer);
        if (this.operations.get(key) === operation) this.operations.delete(key);
      }
    }, { background, valid });
  }
}
