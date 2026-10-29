const pairs = [
  ['PDF 组件无法加载，请检查连接并刷新页面后重试。', 'The PDF component could not load. Check your connection and refresh.'],
  ['文本超过 250,000 字符，请分成较小文件。', 'Text exceeds 250,000 characters. Split it into smaller files.'],
  ['仅支持 Markdown、PDF、HTML 和 TXT 文件。', 'Only Markdown, PDF, HTML and TXT files are supported.'],
  ['文件过大。PDF 上限 30 MiB，文本文件上限 1 MiB。', 'File too large. Limits: PDF 30 MiB, text 1 MiB.'],
  ['PDF 超过 120 页，请先拆分。', 'PDF exceeds 120 pages. Split it first.'],
  ['此 PDF 没有可提取文字，可能需要先进行 OCR。', 'No extractable PDF text. OCR may be needed first.'],
  ['PDF 单页文字项过多，请先拆分或简化文件。', 'Too many text items on one PDF page. Split or simplify the file.'],
  ['PDF 提取文字超过 1,000,000 字符，请先拆分文件。', 'Extracted PDF text exceeds 1,000,000 characters. Split the file.'],
  ['无法可靠定位此 PDF 选区，请重新选择较小范围。', 'Cannot reliably locate this PDF selection. Select a smaller range.'],
  ['选区没有可识别的 PDF 文字。', 'No recognizable PDF text in the selection.'],
  ['跨页选区包含尚未显示的页面，请分次选择。', 'The selection spans an unrendered page. Select smaller ranges separately.'],
  ['单次导出限 40 段、8,000 字符，请缩小选区。', 'Export is limited to 40 passages and 8,000 characters. Reduce the selection.'],
  ['音频超过 5 分钟，请分次导出。', 'Audio exceeds five minutes. Export smaller ranges.'],
  ['请先确认导出范围及可能产生的费用。', 'Confirm the export scope and possible charges first.'],
  ['系统语音不能导出音频，请选择在线语音。', 'System speech cannot export audio. Choose online speech.'],
  ['当前浏览器未提供系统语音，请更换浏览器或选择在线语音。', 'System speech is unavailable. Try another browser or online speech.'],
  ['朗读分段长度超出原型限制。', 'Passage length exceeds this preview version limit.'],
  ['服务返回的不是受支持的音频。', 'The service returned unsupported audio.'],
  ['音频响应超出大小限制。', 'Audio response exceeds the size limit.'],
  ['浏览器不支持有界音频下载。', 'This browser does not support bounded audio downloads.'],
  ['服务返回了空音频。', 'The service returned empty audio.'],
  ['朗读失败。', 'Reading failed.'],
  ['等待可用请求', 'Waiting for a request slot'], ['正在接收音频', 'Receiving audio'],
  ['语音设置已改变，请重新开始。', 'Speech settings changed. Start again.'],
  ['语音合成等待超过 60 秒，已停止，没有自动重试。', 'Synthesis timed out after 60 seconds. Stopped without automatic retry.'],
  ['文档与大纲', 'Documents and outline'], ['WEB · 原型', 'WEB · Preview'],
  ['打开文件', 'Open file'], ['粘贴文字', 'Paste text'], ['朗读设置', 'Reading settings'],
  ['本次阅读', 'This session'], ['打开示例', 'Open sample'], ['关闭文档与大纲', 'Close sidebar'],
  ['关闭', 'Close'], ['文档大纲', 'Outline'], ['搜索标题', 'Search headings'], ['搜索大纲标题', 'Search outline'],
  ['文件仅保留在本次页面会话', 'Files stay in this page session'], ['暂无标题', 'No headings'],
  ['段落高亮', 'Passage highlighting'], ['自动跟随', 'Follow reading'], ['缩小字号', 'Smaller text'],
  ['增大字号', 'Larger text'], ['缩小 PDF', 'Zoom out PDF'], ['放大 PDF', 'Zoom in PDF'],
  ['关闭提示', 'Dismiss notice'], ['文档正文', 'Document'], ['准备好下一篇阅读', 'Ready for another read'],
  ['尚未打开文件', 'No file open'], ['播放控制', 'Playback'], ['已就绪', 'Ready'], ['已停止', 'Stopped'],
  ['等待系统语音', 'Waiting for system speech'], ['正在合成', 'Waiting for synthesis'], ['正在准备播放', 'Preparing playback'],
  ['正在朗读', 'Reading'], ['已暂停', 'Paused'], ['朗读完成', 'Finished'], ['朗读中断', 'Reading interrupted'],
  ['朗读分段进度', 'Passage progress'], ['后退 5 秒', 'Back 5 seconds'], ['后退 5 秒（在线音频）', 'Back 5 seconds (online audio)'],
  ['前进 5 秒', 'Forward 5 seconds'], ['前进 5 秒（在线音频）', 'Forward 5 seconds (online audio)'],
  ['上一段', 'Previous passage'], ['下一段', 'Next passage'], ['开始朗读', 'Start reading'], ['暂停朗读', 'Pause reading'],
  ['继续朗读', 'Resume reading'], ['停止朗读', 'Stop reading'], ['朗读范围', 'Reading scope'], ['全文朗读', 'Full document'],
  ['只读选中内容', 'Selected text only'], ['从选中位置继续', 'From selection onward'], ['播放倍速', 'Playback speed'],
  ['音色设置', 'Voice settings'], ['系统语音', 'System speech'], ['关闭设置', 'Close settings'], ['语音', 'Speech'],
  ['朗读方式', 'Speech engine'], ['音色', 'Voice'], ['浏览器默认', 'Browser default'], ['API 密钥', 'API key'],
  ['仅保留在内存', 'Memory only'], ['模型 ID', 'Model ID'], ['音色 ID', 'Voice ID'], ['音量', 'Volume'],
  ['允许将所选朗读文字发送给 OpenRouter 及其提供方，可能产生费用。请求强制 ZDR；不满足时停止。', 'Allow sending the chosen reading scope to OpenRouter and its provider. Charges may apply. ZDR is required; incompatible routes fail closed.'],
  ['不自动重试。密钥不写入文件或浏览器存储。服务还需允许浏览器跨域请求。', 'No automatic retry. Keys are never saved to files or browser storage. The service must permit browser cross-origin requests.'],
  ['清除密钥与授权', 'Clear key and consent'], ['阅读', 'Reading'], ['学术朗读模式', 'Academic reading'],
  ['公式', 'Formulas'], ['智能 · 保留简短变量', 'Smart: keep short variables'], ['跳过公式', 'Skip formulas'],
  ['完整朗读', 'Read in full'], ['公式语言', 'Formula language'], ['跟随正文', 'Match document'], ['中文', 'Chinese'],
  ['深色外观', 'Dark appearance'], ['播放与缓存', 'Playback and cache'], ['定时停止', 'Sleep timer'],
  ['15 分钟', '15 minutes'], ['30 分钟', '30 minutes'], ['60 分钟', '60 minutes'], ['正文右键朗读菜单', 'Reading context menu'],
  ['在线语音提前准备下一段', 'Prepare the next online passage'], ['下载等待时间摘要', 'Download timing summary'],
  ['停止并清理播放缓存', 'Stop and clear audio cache'],
  ['默认关闭。最多预取当前朗读范围内的一段（500 字符以内），可能为尚未听到的文字产生费用。暂停或切到后台后停止预取。', 'Off by default. Prepares at most one passage within the current scope (up to 500 characters). Unheard text may incur charges. Prefetch stops when paused or backgrounded.'],
  ['后台与锁屏播放未保证。系统语音不提供音频文件导出。', 'Background and lock-screen playback are not guaranteed. System speech cannot export audio.'],
  ['音色是否联网由系统及浏览器决定。', 'The system and browser determine whether voices use a network.'],
  ['音色是否联网由系统及浏览器决定；标记为“本地”的音色由浏览器报告。', 'Network use depends on your system and browser. Local voice labels are reported by the browser.'],
  ['当前尚未返回音色，可尝试浏览器默认语音，或选择在线接口。', 'No voices reported yet. Try browser default speech or an online engine.'],
  ['关闭粘贴窗口', 'Close paste dialog'], ['标题', 'Title'], ['正文', 'Text'], ['开始阅读', 'Open text'],
  ['导出音频', 'Export audio'], ['取消导出', 'Cancel export'], ['合成并下载', 'Synthesize and download'],
  ['确认将此范围合成为音频；允许发送必要分段并承担可能产生的费用。', 'Confirm this export scope, sending necessary passages, and possible charges.'],
  ['朗读选中内容', 'Read selected text'], ['从这里开始朗读', 'Read from here'], ['界面语言', 'Interface language'],
  ['记住阅读偏好', 'Remember reading preferences'], ['跳过重复 PDF 页眉页脚', 'Skip repeated PDF headers and footers'],
  ['PDF 脚注', 'PDF footnotes'], ['正文（略过脚注）', 'Body (skip footnotes)'], ['正文与脚注', 'Body and footnotes'], ['仅脚注', 'Footnotes only'],
  ['当前范围没有可朗读文字。', 'No readable text in this scope.'], ['该章节没有可朗读文字。', 'No readable text in this section.'],
  ['PDF 仍在解析，请等待完成后朗读。', 'PDF extraction is still in progress. Wait before reading.'],
  ['重试当前段（优先复用缓存；新请求可能收费）', 'Retry this passage (reuse cache when possible; new requests may incur charges)'],
  ['请先在正文中选中文字。', 'Select text in the document first.'], ['请重新选择可识别文字', 'Select recognizable text again'],
  ['选区已失效，请重新选择。', 'Selection expired. Select again.'], ['PDF 选区已失效，请重新选择。', 'PDF selection expired. Select again.'],
  ['请先填写密钥并确认在线处理授权。', 'Enter a key and grant online processing consent first.'], ['请填写模型和音色 ID。', 'Enter a model and voice ID.'],
  ['无法连接语音服务：请检查网络及浏览器跨域限制。', 'Cannot connect to the speech service. Check network and browser cross-origin restrictions.'],
  ['服务方拒绝了这一段，请检查模型、音色或文本格式；HTTP 400 不代表额度不足。', 'The provider rejected this passage. Check model, voice and format. HTTP 400 does not establish insufficient credit.'],
  ['密钥未通过验证。', 'Key authentication failed.'], ['服务方报告额度或支付问题。', 'The provider reported a credit or payment issue.'],
  ['服务拒绝访问，请检查权限及 ZDR 路由。', 'Access denied. Check permissions and ZDR routing.'], ['请求过于频繁，请稍后再试。', 'Rate limit reached. Try again later.'],
  ['服务暂不可用，未自动重试。', 'Service unavailable. Not automatically retried.'], ['浏览器无法解码语音音频。', 'The browser could not decode the audio.'],
  ['浏览器需要一次播放操作。请点击继续，已合成音频会保留。', 'The browser requires a playback gesture. Click Resume; prepared audio is retained.'],
  ['系统语音播放失败，请尝试其他可用音色。', 'System speech failed. Try another voice.'], ['系统语音将从下一段使用新倍速。', 'System speech will use the new speed from the next passage.'],
  ['请先确认导出范围及费用。', 'Confirm the export scope and possible charges first.'], ['音频已生成，已开始下载 WAV 文件。', 'Audio is ready. WAV download started.'],
  ['已取消；已发送的请求可能仍计费。', 'Cancelled. Requests already sent may still incur charges.'],
  ['PDF 受密码保护，请先在本地解锁。', 'Password-protected PDF. Unlock it locally first.'], ['文件无法读取。', 'Cannot read this file.'],
  ['PDF 页面渲染失败，请重新打开该文件。', 'PDF rendering failed. Reopen the file.'],
  ['偏好无法保存；本次仍可正常使用。', 'Preferences could not be saved. This session remains usable.'],
];
const translations = new Map(pairs.filter(([, en]) => en));
const normalize = text => text.trim().replace(/\s+/g, ' ');
export function english(text) {
  const value = normalize(text);
  if (translations.has(value)) return translations.get(value);
  const http = value.match(/^OpenRouter HTTP (\d+)。(.*)$/);
  if (http) return `OpenRouter HTTP ${http[1]}. ${english(http[2])}`;
  const patterns = [
    [/^已选 (\d+) 字符$/, m => `${m[1]} characters selected`],
    [/^解析 PDF · (\d+) \/ (\d+)$/, m => `Extracting PDF · ${m[1]} / ${m[2]}`],
    [/^第 (\d+) 页$/, m => `Page ${m[1]}`],
    [/^(\d+) 段 · (.+) MiB$/, m => `${m[1]} passages · ${m[2]} MiB`],
    [/^已完成 (\d+) \/ (\d+) 段$/, m => `Completed ${m[1]} / ${m[2]} passages`],
    [/^(.+) 页 · (.+) 字符$/, m => `${m[1]} pages · ${m[2]} characters`],
    [/^(.+) 节 · (.+) 字符$/, m => `${m[1]} sections · ${m[2]} characters`],
    [/^当前最多同时打开 8 个文件.*$/, () => 'At most 8 files can be open. Close one first.'],
    [/^从 (.+) 朗读$/, m => `Read from ${m[1]}`], [/^关闭 (.+)$/, m => `Close ${m[1]}`],
    [/^打开 (.+)$/, m => `Opening ${m[1]}`],
  ];
  for (const [pattern, replace] of patterns) { const match = value.match(pattern); if (match) return replace(match); }
  return text;
}
export function installInterfaceLanguage(initial = 'zh-CN') {
  let language = initial;
  const originals = new WeakMap();
  const excluded = node => node.parentElement?.closest('#reader, #paste-text, #document-title, .document-button span, #outline button:not(.outline-play)');
  function update() {
    document.documentElement.lang = language;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent.trim() || excluded(node) || node.parentElement?.closest('script,style')) continue;
      const old = originals.get(node);
      const source = old && node.textContent === old.rendered ? old.source : node.textContent;
      const rendered = language === 'en' ? english(source) : source;
      originals.set(node, { source, rendered });
      if (node.textContent !== rendered) node.textContent = rendered;
    }
    for (const el of document.querySelectorAll('[aria-label],[title],[placeholder]')) {
      for (const attr of ['aria-label', 'title', 'placeholder']) {
        if (!el.hasAttribute(attr)) continue;
        const map = originals.get(el) || {}, old = map[attr], current = el.getAttribute(attr);
        const source = old && current === old.rendered ? old.source : current;
        const rendered = language === 'en' ? english(source) : source;
        map[attr] = { source, rendered }; originals.set(el, map);
        if (current !== rendered) el.setAttribute(attr, rendered);
      }
    }
  }
  let queued = false;
  const observer = new MutationObserver(records => {
    if (queued || !records.some(r => !excluded(r.target.nodeType === 3 ? r.target : { parentElement: r.target }))) return;
    queued = true;
    queueMicrotask(() => { queued = false; update(); });
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'aria-label', 'placeholder'] });
  update();
  return next => { language = next === 'en' ? 'en' : 'zh-CN'; update(); };
}
