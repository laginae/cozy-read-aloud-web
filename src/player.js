import { AudioPreparation, PlaybackTimings, audioKey } from "./audio-preparation.js";
export const ENDPOINT = "https://openrouter.ai/api/v1/audio/speech";
export function onlineBody(text, settings) {
  if (!settings.consent || !settings.key?.trim())
    throw new Error("请先填写密钥并确认在线处理授权。");
  if (!text.trim() || text.length > 500)
    throw new Error("朗读分段长度超出原型限制。");
  if (!settings.model?.trim() || !settings.onlineVoice?.trim())
    throw new Error("请填写模型和音色 ID。");
  return {
    model: settings.model.trim(),
    input: text,
    voice: settings.onlineVoice.trim(),
    response_format: "mp3",
    speed: 1,
    provider: { zdr: true, data_collection: "deny" },
  };
}
export async function requestAudio(text, settings, signal, fetcher = fetch, onphase = () => {}) {
  const body = onlineBody(text, settings);
  let response;
  try {
    response = await fetcher(ENDPOINT, {
      method: "POST",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      signal,
      headers: {
        Authorization: `Bearer ${settings.key.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error("无法连接语音服务：请检查网络及浏览器跨域限制。");
  }
  if (!response.ok) {
    const reasons = {
      400: "服务方拒绝了这一段，请检查模型、音色或文本格式；HTTP 400 不代表额度不足。",
      401: "密钥未通过验证。",
      402: "服务方报告额度或支付问题。",
      403: "服务拒绝访问，请检查权限及 ZDR 路由。",
      429: "请求过于频繁，请稍后再试。",
    };
    throw new Error(
      `OpenRouter HTTP ${response.status}。${reasons[response.status] || "服务暂不可用，未自动重试。"}`,
    );
  }
  const type = response.headers.get("content-type") || "";
  if (!/^audio\/(?:mpeg|mp3|wav|x-wav|wave|ogg|mp4)(?:;|$)/i.test(type))
    throw new Error("服务返回的不是受支持的音频。");
  const limit = 16 * 1024 * 1024;
  if (Number(response.headers.get("content-length")) > limit)
    throw new Error("音频响应超出大小限制。");
  if (!response.body?.getReader) throw new Error("浏览器不支持有界音频下载。");
  const reader = response.body.getReader(),
    parts = [];
  onphase("download");
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error("音频响应超出大小限制。");
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!size) throw new Error("服务返回了空音频。");
  return new Blob(parts, { type });
}
export class ReaderPlayer {
  constructor({
    settings,
    onchange = () => {},
    onerror = () => {},
    onprogress = () => {},
    onsourceprogress = () => {},
    speech = globalThis.speechSynthesis,
    Utterance = globalThis.SpeechSynthesisUtterance,
    AudioClass = globalThis.Audio,
    fetcher = globalThis.fetch,
    now,
  } = {}) {
    Object.assign(this, {
      settings,
      onchange,
      onerror,
      onprogress,
      onsourceprogress,
      speech,
      Utterance,
      AudioClass,
      fetcher,
    });
    this.items = [];
    this.index = 0;
    this.status = "idle";
    this.generation = 0;
    this.cache = new Map();
    this.timings = new PlaybackTimings(now);
    this.preparation = new AudioPreparation(settings, this.cache, fetcher, this.timings, requestAudio, onlineBody);
    this.preparation.onphase = phase => { this.phase = phase; this.emit(); };
    this.hidden = false;
  }
  emit() {
    this.onchange(this);
  }
  teardown() {
    this.speech?.cancel();
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
      this.audio = null;
    }
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
    this.utterance = null;
    this.endedPaused = false;
  }
  stop() {
    this.generation++;
    this.preparation.cancel();
    this.timings.suspend();
    this.teardown();
    this.status = "idle";
    this.emit();
  }
  load(items, index = 0) {
    this.stop();
    this.items = items;
    this.index = Math.max(0, Math.min(items.length - 1, index));
    this.status = "ready";
    this.emit();
  }
  clearCache() {
    this.preparation.clearCache();
  }
  cacheInfo() {
    return {
      count: this.cache.size,
      bytes: [...this.cache.values()].reduce((n, b) => n + b.size, 0),
    };
  }
  seek(seconds) {
    const audio = this.audio;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.max(
      0,
      Math.min(audio.duration - 0.01, audio.currentTime + seconds),
    );
    this.onprogress(audio.currentTime, audio.duration);
  }
  clear() {
    this.stop();
    this.items = [];
    this.index = 0;
    this.clearCache();
    this.emit();
  }
  async start(index = this.index, reason = "sessionToPlaying") {
    if (!this.items.length) return;
    if (this.hidden) return;
    if (reason !== "gap") this.preparation.failures.clear();
    this.generation++;
    const generation = this.generation;
    this.teardown();
    this.index = Math.max(0, Math.min(this.items.length - 1, index));
    this.preparation.select(audioKey(this.items[this.index].text, this.settings));
    this.preparation.pause(false);
    if (reason !== "gap") this.timings.begin(reason);
    this.status = "loading";
    this.sourceProgress = 0;
    this.phase = this.settings.engine === "system" ? "system" : "request";
    this.emit();
    const text = this.items[this.index].text,
      s = { ...this.settings };
    try {
      if (s.engine === "system") {
        if (!this.speech || !this.Utterance)
          throw new Error(
            "当前浏览器未提供系统语音，请更换浏览器或选择在线语音。",
          );
        const u = new this.Utterance(text);
        this.utterance = u;
        const voices = this.speech.getVoices();
        u.voice = voices.find((v) => v.voiceURI === s.voice) || null;
        u.lang =
          u.voice?.lang || (/[\u3400-\u9fff]/.test(text) ? "zh-CN" : "en-US");
        u.rate = s.speed;
        u.volume = s.volume;
        u.onstart = () => {
          if (generation === this.generation && this.status !== "paused") {
            this.timings.playing(this.timings.now());
            this.status = "playing";
            this.emit();
          }
        };
        u.onend = () => this.ended(generation);
        u.onboundary = event => {
          if (generation !== this.generation || this.status !== "playing") return;
          this.sourceProgress = Math.min(1, Math.max(0, event.charIndex / Math.max(1, text.length)));
          this.onsourceprogress(this.sourceProgress);
        };
        u.onerror = (e) => {
          if (
            generation === this.generation &&
            !["canceled", "interrupted"].includes(e.error)
          )
            this.fail(new Error("系统语音播放失败，请尝试其他可用音色。"));
        };
        this.speech.speak(u);
        if (this.speech.paused && this.status !== "paused")
          this.speech.resume();
      } else {
        const waiting = this.timings.now();
        const blob = await this.preparation.prepare(text, s);
        if (generation !== this.generation) return;
        this.timings.record("foregroundWait", this.timings.now() - waiting);
        this.phase = "playback";
        this.emit();
        this.url = URL.createObjectURL(blob);
        const audio = (this.audio = new this.AudioClass(this.url));
        this.audioStartedAt = this.timings.now();
        let measured = false;
        audio.onplaying = () => {
          if (generation !== this.generation || audio !== this.audio) return;
          if (this.status === "paused" || this.hidden) { audio.pause(); return; }
          if (!measured || this.timings.intent) this.timings.playing(this.audioStartedAt);
          measured = true;
          this.prefetchNext(generation);
        };
        audio.onpause = () => {
          if (generation === this.generation && audio === this.audio && !audio.ended && audio.paused !== false) this.pause();
        };
        audio.volume = this.settings.volume;
        audio.playbackRate = this.settings.speed;
        audio.ontimeupdate = audio.onloadedmetadata = () => {
          if (generation === this.generation)
            this.onprogress(audio.currentTime, audio.duration);
        };
        audio.onended = () => this.ended(generation);
        audio.onerror = () => {
          if (generation === this.generation)
            this.fail(new Error("浏览器无法解码语音音频。"));
        };
        if (this.status !== "paused") await this.playAudio(generation);
      }
    } catch (error) {
      if (generation !== this.generation) return;
      this.fail(error);
    }
  }
  async playAudio(generation = this.generation) {
    const audio = this.audio;
    try {
      await audio.play();
      if (generation === this.generation && audio === this.audio) {
        if (this.status === "paused") {
          audio.pause();
          return;
        }
        this.status = "playing";
        this.emit();
      }
    } catch {
      if (generation === this.generation) {
        this.status = "paused";
        this.emit();
        this.onerror("浏览器需要一次播放操作。请点击继续，已合成音频会保留。");
      }
    }
  }
  ended(generation) {
    if (generation !== this.generation) return;
    if (this.status === "paused") {
      this.endedPaused = true;
      return;
    }
    this.timings.ended();
    if (this.index + 1 < this.items.length) this.start(this.index + 1, "gap");
    else {
      this.generation++;
      this.teardown();
      this.status = "complete";
      this.emit();
    }
  }
  pause() {
    if (!["playing", "loading"].includes(this.status)) return;
    this.status = "paused";
    this.preparation.pause(true);
    this.timings.suspend();
    this.speech?.pause();
    this.audio?.pause();
    this.emit();
  }
  resume() {
    if (this.status !== "paused") return;
    if (this.hidden) return;
    this.preparation.pause(false);
    this.timings.begin("resumeToPlaying");
    this.audioStartedAt = this.timings.now();
    if (this.endedPaused) {
      this.status = "playing";
      this.ended(this.generation);
    } else if (this.audio) {
      this.status = "loading";
      this.emit();
      this.playAudio();
    } else if (this.utterance) {
      this.status = "playing";
      this.speech?.resume();
      this.emit();
    } else {
      this.status = "loading";
      this.emit();
    }
  }
  jump(index) {
    const active = ["playing", "loading"].includes(this.status);
    this.generation++;
    this.preparation.cancel();
    this.timings.suspend();
    this.teardown();
    this.index = Math.max(0, Math.min(this.items.length - 1, index));
    this.status = "ready";
    this.emit();
    if (active) this.start(this.index, "jumpToPlaying");
  }
  setSpeed(value) {
    this.settings.speed = value;
    if (this.audio) this.audio.playbackRate = value;
    else if (this.utterance) {
      this.pause();
      this.onerror("系统语音将从下一段使用新倍速。");
    }
  }
  setVolume(value) {
    this.settings.volume = value;
    if (this.audio) this.audio.volume = value;
    if (this.utterance) this.utterance.volume = value;
  }
  fail(error) {
    this.generation++;
    this.preparation.cancel();
    this.timings.suspend();
    this.teardown();
    this.status = "error";
    this.emit();
    this.onerror(error?.message || "朗读失败。");
  }
  prefetchNext(generation = this.generation) {
    if (generation !== this.generation || this.hidden || this.status === "paused"
      || this.settings.engine !== "openrouter" || this.settings.prefetch !== true) return;
    const next = this.items[this.index + 1];
    if (!next || next.text.length > 500) return;
    void this.preparation.prepare(next.text, { ...this.settings }, true).catch(() => {});
  }
  setHidden(hidden) {
    this.hidden = hidden;
    if (hidden) this.pause();
  }
}
