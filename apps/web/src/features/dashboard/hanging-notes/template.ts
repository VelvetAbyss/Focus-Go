/** Static, trusted markup. User content is assigned only through textContent/value. */
export const noteTemplate = `  <svg class="icon-library" aria-hidden="true"><defs>
    <symbol id="fg-notes-i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
    <symbol id="fg-notes-i-arrow" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></symbol>
    <symbol id="fg-notes-i-close" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></symbol>
    <symbol id="fg-notes-i-wind" viewBox="0 0 24 24"><path d="M3 8h12a3 3 0 1 0-3-3M2 12h17a3 3 0 1 1-3 3M4 17h5a2 2 0 1 1-2 2"/></symbol>
    <symbol id="fg-notes-i-moon" viewBox="0 0 24 24"><path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z"/></symbol>
    <symbol id="fg-notes-i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></symbol>
    <symbol id="fg-notes-i-pause" viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></symbol>
    <symbol id="fg-notes-i-play" viewBox="0 0 24 24"><path d="m9 5 10 7-10 7Z"/></symbol>
    <symbol id="fg-notes-i-hand" viewBox="0 0 24 24"><path d="M8 12V5a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v9c0 5-3 7-7 7-2 0-4-1-5-3l-5-6a2 2 0 0 1 3-3l2 2Z"/></symbol>
    <symbol id="fg-notes-i-note" viewBox="0 0 24 24"><path d="M5 3h14v13l-5 5H5ZM14 21v-5h5M8 8h8M8 12h6"/></symbol>
    <symbol id="fg-notes-i-archive" viewBox="0 0 24 24"><path d="M4 8h16v12H4ZM3 4h18v4H3ZM9 12h6"/></symbol>
    <symbol id="fg-notes-i-check" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></symbol>
  </defs></svg>      <div class="hanging-space" id="fg-notes-hanging-space">
        <svg class="rope-svg" id="fg-notes-rope-svg" aria-hidden="true">
          <path class="rope-shadow" id="fg-notes-rope-shadow"/>
          <path class="rope-base" id="fg-notes-rope-base"/>
          <path class="rope-fiber" id="fg-notes-rope-fiber"/>
          <path class="rope-base" id="fg-notes-rope-rest"/>
          <path class="rope-base" id="fg-notes-rope-break-upper"/>
          <path class="rope-base rope-loose" id="fg-notes-rope-loose"/>
          <path class="rope-fiber rope-loose" id="fg-notes-rope-loose-fiber"/>
          <g id="fg-notes-snap-fibers" class="snap-fibers"></g>
        </svg>
        <button type="button" class="pin" id="fg-notes-pin" role="slider" aria-label="移动便签悬挂位置" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" title="拖动固定点，左右调整悬挂位置；方向键微调，双击复位。"></button>
        <div class="return-target" id="fg-notes-return-target" aria-hidden="true" hidden><span>拖回这里，可重新挂上</span></div>
        <div class="ground-shadow" id="fg-notes-ground-shadow" aria-hidden="true"></div>
        <button class="paper-stack" id="fg-notes-paper-stack" aria-label="打开便签，也可以按住拖动" aria-expanded="false" aria-controls="fg-notes-note-detail" aria-describedby="fg-notes-gesture-hint">
          <span class="paper paper-back paper-back-two" id="fg-notes-back-two" aria-hidden="true"></span>
          <span class="paper paper-back paper-back-one" id="fg-notes-back-one" aria-hidden="true"></span>
          <span class="paper paper-front" id="fg-notes-paper-front">
            <span class="paper-grain" aria-hidden="true"></span>
            <span class="eyelet" aria-hidden="true"></span>
            <span class="paper-overline">记得</span>
            <span class="paper-preview" id="fg-notes-paper-preview">＋ 写一张</span>
            <span class="paper-footer"><span id="fg-notes-stack-count"></span><span class="tiny-spark">✳︎</span></span>
            <span class="paper-curl" aria-hidden="true"></span>
          </span>
          <span class="knot" aria-hidden="true"></span>
          <span class="pushpin" id="fg-notes-paper-pin" aria-hidden="true"><span></span></span>
        </button>
        <section class="note-detail" id="fg-notes-note-detail" aria-label="便签内容" hidden>
          <span class="paper-grain" aria-hidden="true"></span><span class="detail-hole" aria-hidden="true"></span>
          <div class="detail-top"><span>留给自己</span><button class="icon-button" id="fg-notes-close-note" aria-label="收起便签" title="收起"><svg><use href="#fg-notes-i-close"/></svg></button></div>
          <label class="sr-only" for="fg-notes-note-text">便签内容</label>
          <textarea id="fg-notes-note-text" maxlength="500" aria-label="便签内容" placeholder="有什么想留给稍后的自己？" spellcheck="false"></textarea>
          <div class="note-meta"><button type="button" id="fg-notes-save-status" role="status">已保存</button><span id="fg-notes-char-count">0 / 500</span></div>
          <div class="detail-bottom"><div class="paper-colors" role="group" aria-label="纸张颜色"><button data-color="butter" class="color selected" aria-label="麦芽纸" aria-pressed="true"></button><button data-color="sage" class="color" aria-label="鼠尾草纸" aria-pressed="false"></button><button data-color="rose" class="color" aria-label="蔷薇纸" aria-pressed="false"></button></div><div class="note-actions"><button class="archive-button" id="fg-notes-return-note" hidden>挂回纸叠</button><button class="archive-button" id="fg-notes-archive-note"><svg><use href="#fg-notes-i-archive"/></svg>收走这张</button></div></div>
          <div class="page-controls"><button class="icon-button" id="fg-notes-prev-note" aria-label="上一张"><svg class="flip"><use href="#fg-notes-i-arrow"/></svg></button><span id="fg-notes-page-count" aria-live="polite"></span><button class="icon-button" id="fg-notes-next-note" aria-label="下一张"><svg><use href="#fg-notes-i-arrow"/></svg></button><button class="add-note" id="fg-notes-add-note"><svg><use href="#fg-notes-i-plus"/></svg>再写一张</button></div>
        <div class="note-options"><button id="fg-notes-placement-action">取下一张</button><button id="fg-notes-pause" aria-pressed="false">暂停摆动</button></div></section>
        <p class="gesture-hint" id="fg-notes-gesture-hint"><span class="hint-line"></span><span id="fg-notes-gesture-copy">拉远并保持一下，就能取下来</span></p>
      </div>
<p id="fg-notes-placement-status" class="sr-only" role="status" aria-live="polite"></p><div class="toast" id="fg-notes-toast" role="status" hidden><span id="fg-notes-toast-text"></span><button id="fg-notes-undo" hidden>撤回</button></div>`
