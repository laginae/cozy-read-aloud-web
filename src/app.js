import {
  createIcons,
  FolderOpen,
  ClipboardPaste,
  SlidersHorizontal,
  PanelLeft,
  BookOpen,
  X,
  ShieldCheck,
  FileText,
  File,
  Highlighter,
  ArrowDownUp,
  AArrowDown,
  AArrowUp,
  ZoomIn,
  ZoomOut,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Square,
  AudioLines,
  KeyRound,
  Download,
  RotateCcw,
  RotateCw,
  Trash2,
} from "lucide";
import { ReaderPlayer } from "./player.js";
import { capturePdfSelection } from "./pdf-selection.js";
import { exportAudio, exportSummary } from "./audio-export.js";
import { followTarget, followDelta } from "./follow.js";
import { readPreferences, writePreferences } from "./preferences.js";
import { installInterfaceLanguage } from "./i18n.js";
import {
  SAMPLE,
  textDocument,
  buildQueue,
  selectionQueue,
  readFile,
  renderPdf,
  viewportRectangle,
} from "./documents.js";
const icons = {
  FolderOpen,
  ClipboardPaste,
  SlidersHorizontal,
  PanelLeft,
  BookOpen,
  X,
  ShieldCheck,
  FileText,
  File,
  Highlighter,
  ArrowDownUp,
  AArrowDown,
  AArrowUp,
  ZoomIn,
  ZoomOut,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Square,
  AudioLines,
  KeyRound,
  Download,
  RotateCcw,
  RotateCw,
  Trash2,
};
const $ = (id) => document.getElementById(id),
  refreshIcons = () => createIcons({ icons, attrs: { "aria-hidden": "true" } });
let preferenceStorage;
try { preferenceStorage = globalThis.localStorage; } catch { /* Session-only remains available. */ }
const saved = readPreferences(preferenceStorage);
const settings = {
  engine: "system",
  voice: "",
  speed: 1,
  volume: 1,
  key: "",
  model: "elevenlabs/eleven-multilingual-v2",
  onlineVoice: "sarah",
  consent: false,
  prefetch: false,
  academic: true,
  mathMode: "smart",
  mathLanguage: "auto",
  skipHeaders: true,
  footnoteMode: "body",
};
for (const key of ["speed", "volume", "academic", "mathMode", "mathLanguage", "skipHeaders", "footnoteMode"])
  if (saved[key] !== undefined) settings[key] = saved[key];
const state = {
  docs: [],
  current: null,
  selection: null,
  highlight: true,
  follow: true,
  fontSize: 19,
  loading: null,
  lastBlock: null,
  partial: null,
  followUntil: 0,
  followKey: "",
};
for (const key of ["highlight", "follow", "fontSize"]) if (saved[key] !== undefined) state[key] = saved[key];
function notify(message) {
  $("notice").hidden = !message;
  $("notice").querySelector("span").textContent = message || "";
}
const player = new ReaderPlayer({
  settings,
  onchange: renderPlayer,
  onerror: notify,
  onprogress: renderAudioTime,
  onsourceprogress: followReading,
});
let exportController = null,
  exportItems = [],
  sleepTimer = null,
  contextSnapshot = null;
const abortExport = () => exportController?.abort();
function renderAudioTime(time = 0, duration = 0) {
  const format = (n) =>
    Number.isFinite(n)
      ? `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`
      : "0:00";
  $("audio-time").textContent = `${format(time)} / ${format(duration)}`;
  const enabled = !!player.audio && Number.isFinite(duration) && duration > 0;
  $("rewind").disabled = $("forward").disabled = !enabled;
  if (duration > 0 && player.status === "playing") followReading(time / duration);
}
function iconButton(icon, label, fn, extra = "") {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `icon-button small ${extra}`;
  b.title = label;
  b.setAttribute("aria-label", label);
  b.innerHTML = `<i data-lucide="${icon}"></i>`;
  b.addEventListener("click", fn);
  return b;
}
function closeSidebar() {
  $("sidebar").classList.remove("open");
  $("sidebar-scrim").hidden = true;
  $("menu-toggle").setAttribute("aria-expanded", "false");
}
function renderDocuments() {
  const list = $("documents");
  list.replaceChildren();
  for (const doc of state.docs) {
    const row = document.createElement("div");
    row.className = "document-row" + (doc === state.current ? " active" : "");
    const button = document.createElement("button");
    button.className = "document-button";
    button.setAttribute("aria-current", String(doc === state.current));
    button.innerHTML = `<i data-lucide="${doc.kind === "pdf" ? "file" : "file-text"}"></i>`;
    const name = document.createElement("span");
    name.textContent = doc.name;
    button.append(name);
    button.title = doc.name;
    button.addEventListener("click", () => {
      cancelImport();
      activate(doc);
      closeSidebar();
    });
    row.append(
      button,
      iconButton("x", `关闭 ${doc.name}`, () => removeDocument(doc)),
    );
    list.append(row);
  }
  refreshIcons();
}
function renderOutline() {
  $("outline").replaceChildren();
  const doc = state.current;
  $("outline-count").textContent = doc?.outline.length || "";
  if (!doc?.outline.length) {
    const empty = document.createElement("p");
    empty.className = "outline-empty";
    empty.textContent = "暂无标题";
    $("outline").append(empty);
    return;
  }
  for (const entry of doc.outline) {
    if (
      !$("outline-search").value.trim()
        ? false
        : !entry.title
            .toLocaleLowerCase()
            .includes($("outline-search").value.trim().toLocaleLowerCase())
    )
      continue;
    const row = document.createElement("div");
    row.className = "outline-row";
    const button = document.createElement("button");
    button.textContent = entry.title;
    button.style.paddingLeft = `${10 + (Math.min(entry.level, 3) - 1) * 12}px`;
    button.title = entry.title;
    button.dataset.outlineBlock = entry.block;
    button.addEventListener("click", () => {
      locate(entry.el);
      closeSidebar();
    });
    const play = iconButton(
      "play",
      `从 ${entry.title} 朗读`,
      () => {
        if (state.loading || doc.complete === false) return;
        const queue = buildQueue(doc, settings),
          index = queue.findIndex((item) => item.block >= entry.block);
        if (index < 0) return notify("该章节没有可朗读文字。");
        $("scope").value = "all";
        state.queueScope = "all";
        state.queueSelection = null;
        player.load(queue, index);
        void player.start();
        closeSidebar();
      },
      "outline-play",
    );
    play.disabled = doc.complete === false;
    row.append(button, play);
    $("outline").append(row);
  }
  refreshIcons();
}
function locate(el) {
  if (!el?.isConnected) return;
  const r = $("reader").getBoundingClientRect(),
    box = el.getBoundingClientRect();
  $("reader").scrollTo({
    top: $("reader").scrollTop + box.top - r.top - 26,
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
  el.classList.add("is-located");
  setTimeout(() => el.classList.remove("is-located"), 1100);
}
function rebuild() {
  if (!state.current) return;
  state.selection = null;
  state.queueSelection = null;
  state.queueScope = "all";
  $("selection-status").textContent = "";
  $("scope").value = "all";
  player.load(buildQueue(state.current, settings));
}
function activate(doc) {
  const retainedScroll = doc === state.current ? $("reader").scrollTop : 0;
  abortExport();
  state.current?.observer?.disconnect();
  state.current = doc;
  state.selection = null;
  state.lastBlock = null;
  state.followUntil = 0;
  state.followKey = "";
  notify("");
  player.clear();
  $("reader").replaceChildren();
  $("reader").hidden = !doc;
  $("empty").hidden = !!doc;
  if (doc) {
    $("reader").append(doc.root);
    $("reader").scrollTop = retainedScroll;
    $("document-title").textContent = doc.name;
    $("document-type").textContent = doc.kind.toUpperCase();
    const chars = doc.blocks.reduce(
      (s, b) => s + b.raw.replace(/\s/g, "").length,
      0,
    );
    $("document-meta").textContent =
      `${doc.kind === "pdf" ? doc.pages.length + " 页" : doc.outline.length + " 节"} · ${chars.toLocaleString()} 字符`;
    $("scope")
      .querySelectorAll("option")
      .forEach((o) => (o.disabled = false));
    rebuild();
    if (doc.kind === "pdf")
      renderPdf(doc, $("reader"), () => highlight(), notify);
  } else {
    $("document-title").textContent = "尚未打开文件";
    $("document-type").textContent = "";
    $("document-meta").textContent = "";
  }
  for (const [id, small] of [
    ["font-smaller", true],
    ["font-larger", false],
  ]) {
    const label =
      doc?.kind === "pdf"
        ? small
          ? "缩小 PDF"
          : "放大 PDF"
        : small
          ? "缩小字号"
          : "增大字号";
    $(id).title = label;
    $(id).setAttribute("aria-label", label);
    $(id).innerHTML =
      `<i data-lucide="${doc?.kind === "pdf" ? (small ? "zoom-out" : "zoom-in") : small ? "a-arrow-down" : "a-arrow-up"}"></i>`;
  }
  $("selection-status").textContent = "";
  $("outline-search").value = "";
  renderDocuments();
  renderOutline();
  renderPlayer();
}
function removeDocument(doc) {
  if (state.partial === doc) { cancelImport(); return; }
  const index = state.docs.indexOf(doc);
  state.docs.splice(index, 1);
  if (state.current === doc)
    activate(state.docs[Math.min(index, state.docs.length - 1)] || null);
  else renderDocuments();
  doc.dispose();
}
function addDocument(doc) {
  if (state.docs.length >= 8) {
    doc.dispose();
    return notify("当前最多同时打开 8 个文件，请先关闭一个。");
  }
  state.docs.push(doc);
  activate(doc);
}
function renderPlayer() {
  const labels = {
    idle: "已停止",
    ready: "已就绪",
    loading: settings.engine === "system" ? "等待系统语音" : ({ playback: "正在准备播放", queue: "等待可用请求", download: "正在接收音频" }[player.phase] || "正在合成"),
    playing: "正在朗读",
    paused: "已暂停",
    complete: "朗读完成",
    error: "朗读中断",
  };
  $("play-status").textContent = labels[player?.status || "ready"];
  if (state.loading && state.partial)
    $("play-status").textContent = `解析 PDF · ${state.partial.pages.length} / ${state.partial.totalPages}`;
  const count = player?.items.length || 0;
  $("segment-counter").textContent =
    `${count ? player.index + 1 : 0} / ${count}`;
  $("progress").max = String(Math.max(0, count - 1));
  $("progress").value = String(player?.index || 0);
  $("progress").disabled = !count;
  const running = ["loading", "playing"].includes(player?.status);
  const label = running
    ? "暂停朗读"
    : player?.status === "paused"
      ? "继续朗读"
      : "开始朗读";
  $("play").setAttribute("aria-label", label);
  $("play").title = label;
  $("play").innerHTML = `<i data-lucide="${running ? "pause" : player.status === "error" ? "rotate-cw" : "play"}"></i>`;
  if (player.status === "error") {
    $("play").title = "重试当前段（优先复用缓存；新请求可能收费）";
    $("play").setAttribute("aria-label", $("play").title);
  }
  $("play").disabled = !state.current || !!state.loading;
  $("stop").disabled =
    !state.loading &&
    (!count || ["idle", "ready", "complete"].includes(player?.status));
  $("previous").disabled = !count || player.index === 0;
  $("next").disabled = !count || player.index >= count - 1;
  $("state-dot").classList.toggle("playing", running);
  $("scope").disabled = running || player?.status === "paused";
  const name =
    settings.engine === "openrouter"
      ? "OpenRouter"
      : globalThis.speechSynthesis
          ?.getVoices()
          .find((v) => v.voiceURI === settings.voice)?.name || "系统语音";
  $("voice-label").textContent = name;
  $("voice-open").title = name;
  const info = player.cacheInfo();
  $("cache-size").textContent =
    `${info.count} 段 · ${(info.bytes / 1024 / 1024).toFixed(1)} MiB`;
  $("export-open").disabled = !state.current || !!state.loading;
  renderAudioTime(player.audio?.currentTime || 0, player.audio?.duration || 0);
  highlight();
  refreshIcons();
}
function highlight() {
  const doc = state.current;
  if (!doc) return;
  for (const el of doc.root.querySelectorAll(".is-speaking"))
    el.classList.remove("is-speaking");
  for (const p of doc.pages || []) p.overlay?.replaceChildren();
  const active =
      state.highlight &&
      ["playing", "paused", "loading"].includes(player.status),
    item = player.items[player.index];
  if (active && item) {
    for (const id of item.targets) {
      const block = doc.blocks[id];
      if (!block) continue;
      if (doc.kind !== "pdf") block.el.classList.add("is-speaking");
      else {
        const page = block.pageData;
        if (!page.overlay || !page.viewport) continue;
        for (const rect of item.rects || block.rects) {
          const r = viewportRectangle(page.viewport, rect),
            mark = document.createElement("div");
          Object.assign(mark.style, {
            left: `${Math.min(r[0], r[2])}px`,
            top: `${Math.min(r[1], r[3])}px`,
            width: `${Math.abs(r[0] - r[2])}px`,
            height: `${Math.abs(r[1] - r[3])}px`,
          });
          page.overlay.append(mark);
        }
      }
    }
  }
  if (item && ["playing", "loading"].includes(player.status))
    followReading(player.audio?.duration > 0 ? player.audio.currentTime / player.audio.duration : player.sourceProgress || 0);
  const headings = doc.outline.filter((e) => item && e.block <= item.block),
    current = headings.at(-1);
  for (const b of $("outline").querySelectorAll("[data-outline-block]"))
    b.classList.toggle(
      "active",
      !!current && Number(b.dataset.outlineBlock) === current.block,
    );
}
function followReading(fraction = 0) {
  if (!state.follow || Date.now() < state.followUntil || state.loading) return;
  const doc = state.current, item = player.items[player.index], block = doc?.blocks[item?.block];
  if (!block) return;
  const box = block.el.getBoundingClientRect();
  let rects;
  if (doc.kind === "pdf") {
    if (!block.pageData.viewport) { locate(block.el); return; }
    rects = (item.rects || block.rects).map(rect => {
      const r = viewportRectangle(block.pageData.viewport, rect);
      return { left: box.left + Math.min(r[0], r[2]), right: box.left + Math.max(r[0], r[2]),
        top: box.top + Math.min(r[1], r[3]), bottom: box.top + Math.max(r[1], r[3]) };
    });
  } else {
    const range = document.createRange();
    range.selectNodeContents(block.el);
    rects = [...range.getClientRects()].filter(r => r.height && r.width);
    fraction = (item.sourceStart || 0) + fraction * ((item.sourceEnd ?? 1) - (item.sourceStart || 0));
  }
  const target = followTarget(rects, fraction);
  if (!target) return;
  const key = `${doc.id}:${player.index}:${target.index}`;
  if (key === state.followKey) return;
  state.followKey = key;
  const reader = $("reader"), delta = followDelta(target, reader.getBoundingClientRect());
  if (delta.x || delta.y) reader.scrollTo({ top: reader.scrollTop + delta.y, left: reader.scrollLeft + delta.x, behavior: "instant" });
}
for (const event of ["wheel", "touchstart", "pointerdown"])
  $("reader").addEventListener(event, () => { state.followUntil = Date.now() + 4000; state.followKey = ""; }, { passive: true });
async function importFiles(files) {
  const incoming = [...files].slice(0, 8);
  cancelImport();
  player.stop();
  const controller = new AbortController();
  state.loading = controller;
  const current = () => state.loading === controller && !controller.signal.aborted;
  renderPlayer();
  $("import").disabled = true;
  try {
    for (const file of incoming) {
      if (!current()) break;
      if (state.docs.length >= 8) {
        notify("当前最多同时打开 8 个文件。");
        break;
      }
      $("play-status").textContent = `打开 ${file.name}`;
      try {
        const doc = await readFile(file, controller.signal, (n, total) => {
          if (current()) $("play-status").textContent = `解析 PDF · ${n} / ${total}`;
        }, preview => {
          if (!current()) return;
          if (!state.partial) {
            state.partial = preview;
            activate(preview);
          } else renderPdf(preview, $("reader"), () => highlight(), notify);
          $("play-status").textContent = `解析 PDF · ${preview.pages.length} / ${preview.totalPages}`;
        });
        if (!current()) {
          doc.dispose();
          break;
        }
        state.partial = null;
        addDocument(doc);
      } catch (e) {
        if (!current()) break;
        discardPreview();
        if (e.name !== "AbortError")
          notify(
            e.name === "PasswordException"
              ? "PDF 受密码保护，请先在本地解锁。"
              : e.message || "文件无法读取。",
          );
      }
    }
  } finally {
    if (state.loading === controller) {
      state.loading = null;
      $("import").disabled = false;
      $("file-input").value = "";
      renderPlayer();
    }
  }
}
function cancelImport() {
  if (!state.loading) return;
  state.loading.abort();
  state.loading = null;
  discardPreview();
  $("import").disabled = false;
  $("file-input").value = "";
  renderPlayer();
}
function discardPreview() {
  const preview = state.partial;
  state.partial = null;
  if (preview) {
    if (state.current === preview) activate(state.docs.at(-1) || null);
    preview.dispose();
  }
}
function play() {
  if (state.loading) return;
  notify("");
  state.followUntil = 0;
  state.followKey = "";
  if (["loading", "playing"].includes(player.status)) {
    player.pause();
    return;
  }
  if (player.status === "paused") {
    player.resume();
    return;
  }
  try {
    const scope = $("scope").value;
    if (
      scope !== "all" &&
      (state.queueScope !== scope ||
        state.queueSelection !== state.selection ||
        player.status === "complete")
    ) {
      player.load(
        selectionQueue(
          state.current,
          state.selection,
          settings,
          scope === "from",
        ),
      );
      state.queueScope = scope;
      state.queueSelection = state.selection;
    } else if (
      scope === "all" &&
      (!player.items.length || player.status === "complete")
    )
      player.load(buildQueue(state.current, settings));
    if (!player.items.length) return notify("当前范围没有可朗读文字。");
    void player.start();
  } catch (e) {
    notify(e.message);
  }
}
function captureSelection() {
  const selection = getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (!state.current?.root.contains(range.commonAncestorContainer)) return;
  if (selection.isCollapsed) {
    return;
  }
  try {
    state.selection =
      state.current.kind === "pdf"
        ? capturePdfSelection(state.current, range)
        : { text: selection.toString(), range: range.cloneRange() };
  } catch {
    state.selection = null;
    $("selection-status").textContent = "请重新选择可识别文字";
    return;
  }
  $("selection-status").textContent =
    `已选 ${state.selection.text.length} 字符`;
}
function refreshVoices() {
  const voices = globalThis.speechSynthesis?.getVoices() || [],
    select = $("voice");
  select.replaceChildren(new Option("浏览器默认", ""));
  for (const v of voices) {
    select.add(
      new Option(
        `${v.name} · ${v.lang}${v.localService ? " · 本地" : ""}`,
        v.voiceURI,
      ),
    );
  }
  select.value = settings.voice;
  $("voice-note").textContent = voices.length
    ? "音色是否联网由系统及浏览器决定；标记为“本地”的音色由浏览器报告。"
    : "当前尚未返回音色，可尝试浏览器默认语音，或选择在线接口。";
  renderPlayer();
}
function updateEngine() {
  abortExport();
  player.stop();
  player.clearCache();
  settings.engine = $("engine").value;
  $("system-options").hidden = settings.engine !== "system";
  $("online-options").hidden = settings.engine !== "openrouter";
  settings.consent = false;
  $("online-consent").checked = false;
  renderPlayer();
}
function changedOnline() {
  abortExport();
  player.stop();
  player.clearCache();
  settings.key = $("api-key").value.trim();
  settings.model = $("model").value.trim();
  settings.onlineVoice = $("online-voice").value.trim();
  settings.consent = false;
  $("online-consent").checked = false;
}
function clearKey() {
  abortExport();
  settings.key = "";
  settings.consent = false;
  $("api-key").value = "";
  $("online-consent").checked = false;
  player.stop();
  player.clearCache();
}
$("import").onclick = $("empty-import").onclick = () => $("file-input").click();
$("file-input").onchange = (e) => importFiles(e.target.files);
$("paste").onclick = () => $("paste-dialog").showModal();
$("paste-confirm").onclick = () => {
  const text = $("paste-text").value;
  if (!text.trim()) return $("paste-text").focus();
  cancelImport();
  try {
    addDocument(
      textDocument(text, $("paste-title").value.trim() || "未命名文字", "md"),
    );
    $("paste-text").value = "";
    $("paste-dialog").close();
  } catch (e) {
    notify(e.message);
  }
};
$("sample-open").onclick = () => {
  cancelImport();
  const existing = state.docs.find((d) => d.sample);
  if (existing) activate(existing);
  else {
    const doc = textDocument(SAMPLE, "清晨散步", "md");
    doc.sample = true;
    addDocument(doc);
  }
  closeSidebar();
};
$("settings-open").onclick = $("voice-open").onclick = () =>
  $("settings-dialog").showModal();
$("prefetch").onchange = (event) => {
  settings.prefetch = event.target.checked;
  if (!settings.prefetch) player.preparation.pause(true);
  if (player.status !== "paused") player.preparation.pause(false);
  if (settings.prefetch && player.status === "playing") player.prefetchNext();
};
$("timings-download").onclick = () => {
  const report = { ...player.timings.snapshot(), evidence: "browser playback events; not acoustic speaker measurement" };
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url; link.download = "cozy-playback-timings.json"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("menu-toggle").onclick = () => {
  const open = !$("sidebar").classList.contains("open");
  $("sidebar").classList.toggle("open", open);
  $("sidebar-scrim").hidden = !open;
  $("menu-toggle").setAttribute("aria-expanded", String(open));
};
$("menu-close").onclick = $("sidebar-scrim").onclick = closeSidebar;
$("notice-close").onclick = () => notify("");
$("play").onclick = play;
$("stop").onclick = () => {
  abortExport();
  cancelImport();
  player.stop();
  state.lastBlock = null;
};
$("next").onclick = () => player.jump(player.index + 1);
$("previous").onclick = () => player.jump(player.index - 1);
$("rewind").onclick = () => player.seek(-5);
$("forward").onclick = () => player.seek(5);
$("outline-search").oninput = renderOutline;
$("clear-cache").onclick = () => {
  player.stop();
  player.clearCache();
  renderPlayer();
  notify("本次播放缓存已清理。");
};
$("sleep-timer").onchange = (e) => {
  clearTimeout(sleepTimer);
  const minutes = Number(e.target.value);
  if (minutes)
    sleepTimer = setTimeout(() => {
      player.stop();
      $("sleep-timer").value = "0";
      notify("已到定时时间，朗读已停止。");
    }, minutes * 60000);
};
function queueForScope() {
  return $("scope").value === "all"
    ? buildQueue(state.current, settings)
    : selectionQueue(
        state.current,
        state.selection,
        settings,
        $("scope").value === "from",
      );
}
$("export-open").onclick = () => {
  try {
    if (settings.engine !== "openrouter")
      throw new Error("系统语音不能导出音频，请先在设置中选择在线语音。");
    exportItems = queueForScope();
    const summary = exportSummary(exportItems);
    $("export-summary").textContent =
      `${summary.segments} 段 · ${summary.characters.toLocaleString()} 字符 · WAV / 1x。未缓存的分段会发送给语音提供方，可能产生费用；最多 5 分钟。`;
    $("export-consent").checked = false;
    $("export-progress").textContent = "";
    $("export-dialog").showModal();
  } catch (e) {
    notify(e.message);
  }
};
$("export-cancel").onclick = () => {
  abortExport();
  $("export-dialog").close();
};
$("export-dialog").addEventListener("cancel", abortExport);
$("export-confirm").onclick = async () => {
  if (exportController) return;
  if (!$("export-consent").checked) {
    $("export-progress").textContent = "请先确认导出范围及费用。";
    return;
  }
  player.stop();
  const controller = (exportController = new AbortController()),
    snapshot = { ...settings };
  $("export-confirm").disabled = true;
  try {
    const blob = await exportAudio(exportItems, snapshot, {
      signal: controller.signal,
      confirmed: true,
      cache: new Map(player.cache),
      onprogress: (n, total) => {
        $("export-progress").textContent = `已完成 ${n} / ${total} 段`;
      },
    });
    if (controller.signal.aborted) return;
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = "cozy-read-aloud.wav";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    $("export-dialog").close();
    notify("音频已生成，已开始下载 WAV 文件。");
  } catch (e) {
    $("export-progress").textContent = controller.signal.aborted
      ? "已取消；已发送的请求可能仍计费。"
      : e.message;
  } finally {
    snapshot.key = "";
    exportController = null;
    $("export-confirm").disabled = false;
  }
};
$("progress").onchange = (e) => player.jump(Number(e.target.value));
$("speed").onchange = (e) => player.setSpeed(Number(e.target.value));
$("volume").oninput = (e) => {
  player.setVolume(Number(e.target.value));
  $("volume-label").textContent =
    `${Math.round(Number(e.target.value) * 100)}%`;
};
$("scope").onchange = () => {
  if ($("scope").value === "all") rebuild();
  else player.stop();
};
$("highlight").onclick = () => {
  state.highlight = !state.highlight;
  $("highlight").setAttribute("aria-pressed", String(state.highlight));
  highlight();
};
$("follow").onclick = () => {
  state.follow = !state.follow;
  $("follow").setAttribute("aria-pressed", String(state.follow));
  if (state.follow) {
    state.followUntil = 0;
    state.followKey = "";
    state.lastBlock = null;
    highlight();
  }
};
for (const [id, delta] of [
  ["font-smaller", -1],
  ["font-larger", 1],
])
  $(id).onclick = () => {
    const doc = state.current;
    if (doc?.kind === "pdf") {
      doc.zoom = Math.max(1, Math.min(3, (doc.zoom || 1) + delta * 0.25));
      state.lastBlock = null;
      renderPdf(doc, $("reader"), () => highlight(), notify);
    } else {
      state.fontSize = Math.max(14, Math.min(28, state.fontSize + delta));
      document.documentElement.style.setProperty(
        "--reader-size",
        `${state.fontSize}px`,
      );
    }
  };
$("engine").onchange = updateEngine;
$("voice").onchange = (e) => {
  player.stop();
  settings.voice = e.target.value;
  renderPlayer();
};
for (const id of ["api-key", "model", "online-voice"])
  $(id).addEventListener("input", changedOnline);
$("online-consent").onchange = (e) => {
  settings.consent = e.target.checked;
  if (!settings.consent) {
    player.stop();
    player.clearCache();
  }
};
$("clear-key").onclick = clearKey;
for (const [id, key] of [
  ["academic", "academic"],
  ["math-mode", "mathMode"],
  ["math-language", "mathLanguage"],
  ["pdf-headers", "skipHeaders"],
  ["pdf-footnotes", "footnoteMode"],
])
  $(id).onchange = (e) => {
    settings[key] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    $("math-mode").disabled = !settings.academic;
    rebuild();
  };
$("dark-mode").onchange = (e) =>
  document.body.classList.toggle("dark", e.target.checked);
document.addEventListener("selectionchange", captureSelection);
$("reader").addEventListener("pointerup", () =>
  setTimeout(() => {
    if (getSelection()?.isCollapsed) {
      state.selection = null;
      $("selection-status").textContent = "";
    } else captureSelection();
  }, 0),
);
const closeContext = () => {
  $("reading-context").hidden = true;
};
$("reader").addEventListener("contextmenu", (e) => {
  if (!$("context-enabled").checked || e.shiftKey || !state.current) return;
  const selection = getSelection(),
    hasSelection =
      !!selection?.toString().trim() &&
      state.current.root.contains(
        selection.getRangeAt(0).commonAncestorContainer,
      );
  try {
    if (hasSelection) {
      captureSelection();
      contextSnapshot = state.selection;
    } else {
      let range = document.caretRangeFromPoint?.(e.clientX, e.clientY);
      if (!range && document.caretPositionFromPoint) {
        const p = document.caretPositionFromPoint(e.clientX, e.clientY);
        if (p) {
          range = document.createRange();
          range.setStart(p.offsetNode, p.offset);
        }
      }
      if (!range || !state.current.root.contains(range.startContainer)) return;
      const node = range.startContainer;
      if (node.nodeType !== Node.TEXT_NODE) return;
      range.setEnd(node, node.textContent.length);
      contextSnapshot =
        state.current.kind === "pdf"
          ? capturePdfSelection(state.current, range)
          : { text: range.toString(), range: range.cloneRange() };
    }
    if (!contextSnapshot) return;
    e.preventDefault();
    $("context-selected").disabled = !hasSelection;
    const menu = $("reading-context");
    menu.hidden = false;
    menu.style.left = `${Math.max(8, Math.min(e.clientX, innerWidth - 220))}px`;
    menu.style.top = `${Math.max(8, Math.min(e.clientY, innerHeight - 100))}px`;
    menu.querySelector("button:not(:disabled)").focus();
  } catch (error) {
    notify(error.message);
  }
});
for (const [id, scope] of [
  ["context-selected", "selection"],
  ["context-from", "from"],
])
  $(id).onclick = () => {
    closeContext();
    player.stop();
    state.selection = contextSnapshot;
    state.queueScope = null;
    $("scope").value = scope;
    play();
  };
document.addEventListener("pointerdown", (e) => {
  if (!$("reading-context").contains(e.target)) closeContext();
});
$("reader").addEventListener("scroll", closeContext, { passive: true });
$("reading-context").addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeContext();
    $("reader").focus();
  }
  if (["ArrowDown", "ArrowUp"].includes(e.key)) {
    e.preventDefault();
    const buttons = [
        ...$("reading-context").querySelectorAll("button:not(:disabled)"),
      ],
      index = buttons.indexOf(document.activeElement);
    buttons[
      (index + buttons.length + (e.key === "ArrowDown" ? 1 : -1)) %
        buttons.length
    ].focus();
  }
});
$("reader").addEventListener("dragover", (e) => {
  if (e.dataTransfer?.types.includes("Files")) {
    e.preventDefault();
    $("reader").classList.add("drag-over");
  }
});
$("reader").addEventListener("dragleave", () =>
  $("reader").classList.remove("drag-over"),
);
$("reader").addEventListener("drop", (e) => {
  e.preventDefault();
  $("reader").classList.remove("drag-over");
  void importFiles(e.dataTransfer.files);
});
document.addEventListener("visibilitychange", () => {
  player.setHidden(document.hidden);
});
document.addEventListener("freeze", () => player.setHidden(true));
window.addEventListener("pageshow", () => player.setHidden(document.hidden));
window.addEventListener("pagehide", () => {
  player.setHidden(true);
  cancelImport();
  clearKey();
  $("paste-text").value = "";
});
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const doc = state.current;
    if (doc?.kind === "pdf") {
      state.lastBlock = null;
      renderPdf(doc, $("reader"), () => highlight(), notify);
    }
  }, 180);
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeSidebar();
    return;
  }
  if (
    e.code === "Space" &&
    !e.repeat &&
    !document.querySelector("dialog[open]") &&
    !/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(document.activeElement?.tagName)
  ) {
    e.preventDefault();
    play();
  }
});
globalThis.speechSynthesis?.addEventListener("voiceschanged", refreshVoices);
for (const [id, value] of Object.entries({ speed: settings.speed, volume: settings.volume,
  academic: settings.academic, "math-mode": settings.mathMode, "math-language": settings.mathLanguage,
  "pdf-headers": settings.skipHeaders, "pdf-footnotes": settings.footnoteMode,
  "dark-mode": saved.dark || false, "context-enabled": saved.contextMenu ?? true,
  "remember-preferences": saved.enabled === true, "interface-language": saved.language || "zh-CN" })) {
  if ($(id).type === "checkbox") $(id).checked = value;
  else $(id).value = value;
}
document.body.classList.toggle("dark", saved.dark === true);
document.documentElement.style.setProperty("--reader-size", `${state.fontSize}px`);
$("highlight").setAttribute("aria-pressed", String(state.highlight));
$("follow").setAttribute("aria-pressed", String(state.follow));
const setLanguage = installInterfaceLanguage(saved.language);
const persistPreferences = () => {
  if (!writePreferences(preferenceStorage, $("remember-preferences").checked, {
    ...settings, highlight: state.highlight, follow: state.follow, fontSize: state.fontSize,
    language: $("interface-language").value, dark: $("dark-mode").checked, contextMenu: $("context-enabled").checked,
  }) && $("remember-preferences").checked) notify("偏好无法保存；本次仍可正常使用。");
};
$("interface-language").onchange = event => setLanguage(event.target.value);
document.addEventListener("change", persistPreferences);
for (const id of ["highlight", "follow", "font-smaller", "font-larger"])
  $(id).addEventListener("click", persistPreferences);
const sample = textDocument(SAMPLE, "清晨散步", "md");
sample.sample = true;
addDocument(sample);
refreshVoices();
refreshIcons();
