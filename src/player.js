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
export async function requestAudio(text, settings, signal, fetcher = fetch) {
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
    speech = globalThis.speechSynthesis,
    Utterance = globalThis.SpeechSynthesisUtterance,
    AudioClass = globalThis.Audio,
    fetcher = globalThis.fetch,
  } = {}) {
    Object.assign(this, {
      settings,
      onchange,
      onerror,
      onprogress,
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
  }
  emit() {
    this.onchange(this);
  }
  teardown() {
    this.abort?.abort();
    this.abort = null;
    clearTimeout(this.timeout);
    this.timeout = null;
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
    this.cache.clear();
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
  async start(index = this.index) {
    if (!this.items.length) return;
    this.generation++;
    const generation = this.generation;
    this.teardown();
    this.index = Math.max(0, Math.min(this.items.length - 1, index));
    this.status = "loading";
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
            this.status = "playing";
            this.emit();
          }
        };
        u.onend = () => this.ended(generation);
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
        // Always revalidate consent, including cache hits; never store the API key in a cache key.
        onlineBody(text, s);
        const cacheKey = JSON.stringify([s.model, s.onlineVoice, text]);
        let blob = this.cache.get(cacheKey);
        if (!blob) {
          this.abort = new AbortController();
          const abort = this.abort;
          let timedOut = false;
          const timer = (this.timeout = setTimeout(() => {
            timedOut = true;
            abort.abort();
          }, 60000));
          try {
            blob = await requestAudio(text, s, abort.signal, this.fetcher);
          } catch (e) {
            if (timedOut)
              throw new Error("语音合成等待超过 60 秒，已停止，没有自动重试。");
            throw e;
          } finally {
            clearTimeout(timer);
            if (this.timeout === timer) this.timeout = null;
          }
          if (generation !== this.generation) return;
          this.cache.set(cacheKey, blob);
          while (
            this.cache.size > 8 ||
            [...this.cache.values()].reduce((sum, b) => sum + b.size, 0) >
              20 * 1024 * 1024
          )
            this.cache.delete(this.cache.keys().next().value);
        }
        if (generation !== this.generation) return;
        this.url = URL.createObjectURL(blob);
        const audio = (this.audio = new this.AudioClass(this.url));
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
    if (this.index + 1 < this.items.length) this.start(this.index + 1);
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
    this.speech?.pause();
    this.audio?.pause();
    this.emit();
  }
  resume() {
    if (this.status !== "paused") return;
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
    this.teardown();
    this.index = Math.max(0, Math.min(this.items.length - 1, index));
    this.status = "ready";
    this.emit();
    if (active) this.start();
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
    this.teardown();
    this.status = "error";
    this.emit();
    this.onerror(error?.message || "朗读失败。");
  }
}
