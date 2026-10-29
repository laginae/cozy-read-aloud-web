import test from "node:test";
import assert from "node:assert/strict";
import { exportAudio, exportSummary, encodeWav } from "../src/audio-export.js";
test("export bounds refuse empty, oversized and unconfirmed batches before networking", async () => {
  for (const items of [
    [],
    Array.from({ length: 41 }, () => ({ text: "Public." })),
    [{ text: "x".repeat(8001) }],
  ])
    assert.throws(() => exportSummary(items));
  let calls = 0;
  await assert.rejects(
    exportAudio([{ text: "Public." }], {}, { fetcher: () => calls++ }),
  );
  assert.equal(calls, 0);
});
test("WAV contains a valid PCM header and clipped samples", async () => {
  const view = new DataView(
    await encodeWav([new Float32Array([-2, 0, 2])]).arrayBuffer(),
  );
  assert.equal(view.getUint32(24, true), 22050);
  assert.equal(view.getUint32(40, true), 6);
  assert.equal(view.getInt16(44, true), -32768);
  assert.equal(view.getInt16(48, true), 32767);
});
test("cancelled export never sends a request and closes its audio context", async () => {
  const c = new AbortController();
  c.abort();
  let closed = false,
    calls = 0;
  class Context {
    async close() {
      closed = true;
    }
  }
  await assert.rejects(
    exportAudio(
      [{ text: "Public." }],
      {
        engine: "openrouter",
        key: "public-placeholder",
        consent: true,
        model: "example",
        onlineVoice: "example",
      },
      { signal: c.signal, confirmed: true, Context, fetcher: () => calls++ },
    ),
  );
  assert.equal(calls, 0);
  assert.equal(closed, true);
});
