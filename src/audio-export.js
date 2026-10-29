import { requestAudio, onlineBody } from "./player.js";
export const EXPORT_LIMITS = {
  segments: 40,
  characters: 8000,
  seconds: 300,
  sampleRate: 22050,
};
export function exportSummary(items) {
  const characters = items.reduce((n, item) => n + item.text.length, 0);
  if (
    !items.length ||
    items.length > EXPORT_LIMITS.segments ||
    characters > EXPORT_LIMITS.characters
  )
    throw new Error("单次导出限 40 段、8,000 字符，请缩小选区。");
  return { segments: items.length, characters };
}
export function encodeWav(chunks, rate = EXPORT_LIMITS.sampleRate) {
  const count = chunks.reduce((n, c) => n + c.length, 0);
  if (count > rate * EXPORT_LIMITS.seconds)
    throw new Error("音频超过 5 分钟，请分次导出。");
  const buffer = new ArrayBuffer(44 + count * 2),
    view = new DataView(buffer);
  const word = (offset, text) => {
    for (let i = 0; i < text.length; i++)
      view.setUint8(offset + i, text.charCodeAt(i));
  };
  word(0, "RIFF");
  view.setUint32(4, buffer.byteLength - 8, true);
  word(8, "WAVE");
  word(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  word(36, "data");
  view.setUint32(40, count * 2, true);
  let offset = 44;
  for (const chunk of chunks)
    for (const sample of chunk) {
      const v = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, v < 0 ? v * 32768 : v * 32767, true);
      offset += 2;
    }
  return new Blob([buffer], { type: "audio/wav" });
}
export async function exportAudio(
  items,
  settings,
  {
    signal,
    confirmed = false,
    cache = new Map(),
    onprogress = () => {},
    fetcher = fetch,
    Context = globalThis.AudioContext,
  } = {},
) {
  if (!confirmed) throw new Error("请先确认导出范围及可能产生的费用。");
  exportSummary(items);
  for (const item of items) onlineBody(item.text, settings);
  if (settings.engine !== "openrouter")
    throw new Error("系统语音不能导出音频，请选择在线语音。");
  const context = new Context(),
    chunks = [];
  let total = 0;
  try {
    for (const [index, item] of items.entries()) {
      signal.throwIfAborted();
      const key = JSON.stringify([
        settings.model,
        settings.onlineVoice,
        item.text,
      ]);
      let blob = cache.get(key);
      if (!blob) {
        const controller = new AbortController(),
          abort = () => controller.abort();
        signal.addEventListener("abort", abort, { once: true });
        const timeout = setTimeout(() => controller.abort(), 60000);
        try {
          blob = await requestAudio(
            item.text,
            settings,
            controller.signal,
            fetcher,
          );
        } finally {
          clearTimeout(timeout);
          signal.removeEventListener("abort", abort);
        }
      }
      signal.throwIfAborted();
      const decoded = await context.decodeAudioData(await blob.arrayBuffer());
      signal.throwIfAborted();
      const rate = EXPORT_LIMITS.sampleRate,
        length = Math.ceil(decoded.duration * rate);
      if (
        !Number.isFinite(length) ||
        length < 1 ||
        total + length > rate * EXPORT_LIMITS.seconds
      )
        throw new Error("音频超过 5 分钟，请分次导出。");
      const output = new Float32Array(length),
        channels = Array.from({ length: decoded.numberOfChannels }, (_, i) =>
          decoded.getChannelData(i),
        );
      for (let i = 0; i < length; i++) {
        const position = (i * decoded.sampleRate) / rate,
          left = Math.min(decoded.length - 1, Math.floor(position)),
          right = Math.min(decoded.length - 1, left + 1),
          fraction = position - left;
        let value = 0;
        for (const channel of channels)
          value += channel[left] * (1 - fraction) + channel[right] * fraction;
        output[i] = value / channels.length;
      }
      total += length;
      chunks.push(output);
      onprogress(index + 1, items.length);
    }
    signal.throwIfAborted();
    return encodeWav(chunks);
  } finally {
    await context.close();
  }
}
