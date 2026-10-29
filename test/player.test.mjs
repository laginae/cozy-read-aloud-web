import test from "node:test";
import assert from "node:assert/strict";
import {
  ReaderPlayer,
  onlineBody,
  requestAudio,
  ENDPOINT,
} from "../src/player.js";
const online = () => ({
  engine: "openrouter",
  key: "public-test-placeholder",
  consent: true,
  model: "example/model",
  onlineVoice: "example",
  speed: 1,
  volume: 1,
});
const audioResponse = () =>
  new Response(new Uint8Array([1, 2, 3]), {
    headers: { "content-type": "audio/mpeg" },
  });
test("online requests require explicit consent and bounded input", async () => {
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return audioResponse();
  };
  for (const settings of [
    { ...online(), consent: false },
    { ...online(), key: "" },
  ])
    await assert.rejects(
      requestAudio(
        "Public example.",
        settings,
        new AbortController().signal,
        fetcher,
      ),
    );
  assert.throws(() => onlineBody("x".repeat(501), online()));
  assert.equal(calls, 0);
});
test("only fixed HTTPS endpoint is used, with ZDR, no cookies or redirects", async () => {
  let captured;
  const blob = await requestAudio(
    "A public example.",
    online(),
    new AbortController().signal,
    async (url, init) => {
      captured = { url, init };
      return audioResponse();
    },
  );
  assert.equal(captured.url, ENDPOINT);
  assert.equal(captured.init.credentials, "omit");
  assert.equal(captured.init.redirect, "error");
  assert.equal(captured.init.cache, "no-store");
  assert.deepEqual(JSON.parse(captured.init.body).provider, {
    zdr: true,
    data_collection: "deny",
  });
  assert.equal(blob.size, 3);
});
test("errors never expose response body, claim insufficient credit on HTTP 400, or retry", async () => {
  let calls = 0;
  await assert.rejects(
    requestAudio(
      "A public example.",
      online(),
      new AbortController().signal,
      async () => {
        calls++;
        return new Response("secret-response-body", { status: 400 });
      },
    ),
    (error) =>
      error.message.includes("400 不代表额度不足") &&
      !error.message.includes("secret-response-body"),
  );
  assert.equal(calls, 1);
});
test("non-audio and oversized responses are refused", async () => {
  for (const response of [
    new Response("{}", { headers: { "content-type": "application/json" } }),
    new Response("x", {
      headers: {
        "content-type": "audio/mpeg",
        "content-length": String(20 * 1024 * 1024),
      },
    }),
  ])
    await assert.rejects(
      requestAudio(
        "Example.",
        online(),
        new AbortController().signal,
        async () => response,
      ),
    );
});
function systemFixture() {
  const utterances = [],
    speech = {
      getVoices: () => [],
      cancel() {},
      pause() {},
      resume() {},
      speak(u) {
        utterances.push(u);
        u.onstart();
      },
    };
  class Utterance {
    constructor(text) {
      this.text = text;
    }
  }
  const player = new ReaderPlayer({
    settings: { engine: "system", speed: 1, volume: 1 },
    speech,
    Utterance,
  });
  player.load([
    { text: "First public passage." },
    { text: "Second public passage." },
    { text: "Third public passage." },
  ]);
  return { player, utterances };
}
test("pause, resume and duplicate old completion events do not repeat or skip a passage", async () => {
  const { player: p, utterances: u } = systemFixture();
  await p.start();
  p.pause();
  u[0].onend();
  u[0].onend();
  assert.equal(p.index, 0);
  p.resume();
  assert.equal(p.index, 1);
  assert.equal(u.length, 2);
  u[0].onend();
  assert.equal(p.index, 1);
  u[1].onend();
  assert.equal(p.index, 2);
  p.stop();
  u[2].onend();
  assert.equal(p.status, "idle");
});
test("rapid jumps and stop invalidate old utterances", async () => {
  const { player: p, utterances: u } = systemFixture();
  await p.start();
  p.jump(2);
  u[0].onend();
  assert.equal(p.index, 2);
  p.stop();
  u[1].onend();
  assert.equal(p.status, "idle");
  assert.equal(u.length, 2);
});
test("late online response after stop never plays or fills the cache", async () => {
  let resolve,
    plays = 0;
  class Audio {
    play() {
      plays++;
      return Promise.resolve();
    }
    pause() {}
    load() {}
    removeAttribute() {}
  }
  const p = new ReaderPlayer({
    settings: online(),
    speech: { cancel() {} },
    AudioClass: Audio,
    fetcher: () => new Promise((r) => (resolve = r)),
  });
  p.load([{ text: "Public sample." }]);
  const running = p.start();
  await new Promise(r => setImmediate(r));
  p.stop();
  resolve(audioResponse());
  await running;
  assert.equal(plays, 0);
  assert.equal(p.cache.size, 0);
  assert.equal(p.status, "idle");
});
test("pausing an in-flight request retains audio without starting until resume", async () => {
  let resolve,
    plays = 0;
  class Audio {
    play() {
      plays++;
      return Promise.resolve();
    }
    pause() {}
    load() {}
    removeAttribute() {}
  }
  const p = new ReaderPlayer({
    settings: online(),
    speech: { cancel() {}, pause() {} },
    AudioClass: Audio,
    fetcher: () => new Promise((r) => (resolve = r)),
  });
  p.load([{ text: "Public sample." }]);
  const running = p.start();
  await new Promise(r => setImmediate(r));
  p.pause();
  resolve(audioResponse());
  await running;
  assert.equal(plays, 0);
  assert.equal(p.status, "paused");
  p.resume();
  await Promise.resolve();
  assert.equal(plays, 1);
  p.stop();
  p.clearCache();
});

test("pause during an unresolved audio play promise stays paused", async () => {
  let finish,
    pauses = 0;
  class Audio {
    play() {
      return new Promise((r) => (finish = r));
    }
    pause() {
      pauses++;
    }
    load() {}
    removeAttribute() {}
  }
  const p = new ReaderPlayer({
    settings: online(),
    speech: { cancel() {}, pause() {} },
    AudioClass: Audio,
    fetcher: async () => audioResponse(),
  });
  p.load([{ text: "Public sample." }]);
  const running = p.start();
  while (!finish) await new Promise((r) => setImmediate(r));
  p.pause();
  finish();
  await running;
  assert.equal(p.status, "paused");
  assert.ok(pauses >= 2);
  p.stop();
});

test("a superseded response cannot cancel the current request controller", async () => {
  const pending = [];
  class Audio {
    play() {
      return Promise.resolve();
    }
    pause() {}
    load() {}
    removeAttribute() {}
  }
  const p = new ReaderPlayer({
    settings: online(),
    speech: { cancel() {} },
    AudioClass: Audio,
    fetcher: () => new Promise((r) => pending.push(r)),
  });
  p.load([{ text: "First public sample." }, { text: "Second public sample." }]);
  const first = p.start();
  await new Promise(r => setImmediate(r));
  const second = p.start(1);
  await new Promise(r => setImmediate(r));
  const currentOperation = [...p.preparation.operations.values()].at(-1);
  pending[0](audioResponse());
  await first;
  assert.ok([...p.preparation.operations.values()].includes(currentOperation));
  assert.equal(currentOperation.abort.signal.aborted, false);
  pending[1](audioResponse());
  await second;
  p.stop();
});

test("starting after a paused session releases the native speech pause state", async () => {
  const { player: p } = systemFixture();
  let resumes = 0;
  p.speech.paused = true;
  p.speech.resume = () => resumes++;
  await p.start();
  assert.equal(resumes, 1);
  p.stop();
});
