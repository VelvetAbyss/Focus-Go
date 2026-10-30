import type { HangingNote } from '../../../data/models/types';
import { noteTemplate } from './template';
import { noteTranslations } from './copy';
import { normalizeHangingAnchor } from './model';
type Point = {
    x: number;
    y: number;
};
type Rect = {
    left: number;
    right: number;
    top: number;
    bottom: number;
};
type Geometry = {
    w: number;
    h: number;
    scale: number;
    ax: number;
    ay: number;
    length: number;
    quote: Rect | null;
};
type Body = Point & {
    id: string;
    el: HTMLButtonElement;
    tx: number;
    ty: number;
    vx: number;
    vy: number;
    angle: number;
    av: number;
    kind: 'free' | 'pinned';
};
type Snap = Point & {
    started: number;
    ax: number;
    ay: number;
    id: string;
};
type PointerPosition = Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY'>;
type Drag = {
    id: number;
    capture: HTMLButtonElement;
    body: Body | null;
    created: boolean;
    moved: boolean;
    overSince: number | null;
    returnReady: boolean;
    x: number;
    y: number;
    sx: number;
    sy: number;
    lx: number;
    ly: number;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    angle: number;
    extension: number;
    originFront?: string;
    originPin: HangingNote['pin'] | null;
    originPoint: Point;
};
/** A scoped imperative animation island: React owns mount/unmount, never frame state. */
export function createHangingNotes(root: HTMLElement, initial: HangingNote[], onSave: (next: HangingNote[], before: () => HangingNote[], anchor: { next: number | undefined; before: () => number | undefined }) => Promise<unknown>, zh = true, initialAnchor?: number) {
    const copy = (value: string) => zh ? value : noteTranslations[value] ?? value;
    root.innerHTML = zh ? noteTemplate : Object.entries(noteTranslations).sort((a, b) => b[0].length - a[0].length).reduce((html, [from, to]) => html.replaceAll(from, to), noteTemplate);
    let disposed = false;
    const controller = new AbortController();
    const $ = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
    type NoteEventMap = HTMLElementEventMap & {
        visibilitychange: Event;
    };
    function listen<K extends keyof NoteEventMap>(target: EventTarget, type: K, listener: (event: NoteEventMap[K]) => void) {
        target.addEventListener(type, listener as EventListener, { signal: controller.signal });
    }
    function pointerLocal(event: PointerPosition): Point {
        const rect = root.getBoundingClientRect(), zoom = rect.width / Math.max(1, root.clientWidth);
        return { x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom };
    }
    const COLORS = { butter: '#eee5c9', sage: '#dbe3d2', rose: '#ecd6ca' };
    const clamp = (n: number, a: number, b: number) => Math.min(Math.max(n, a), Math.max(a, b));
    let notes = structuredClone(initial), persisted = structuredClone(initial);
    let anchorU = normalizeHangingAnchor(initialAnchor), persistedAnchor = anchorU;
    let storageOK = true, saveVersion = 0, saving = 0, pending: { notes: HangingNote[]; anchor?: number } | null = null;
    const stage = root, stack = $<HTMLButtonElement>('#fg-notes-paper-stack'), detail = $('#fg-notes-note-detail'), input = $<HTMLTextAreaElement>('#fg-notes-note-text');
    const dashboard = root.parentElement!;
    let scroller: HTMLElement = document.scrollingElement as HTMLElement || document.documentElement;
    let clippingAncestors: HTMLElement[] = [];
    function measureViewport() {
        let owner: HTMLElement | undefined;
        clippingAncestors = [];
        for (let node = dashboard.parentElement; node && node !== document.body; node = node.parentElement) {
            const overflow = getComputedStyle(node).overflowY;
            if (!owner && /^(auto|scroll|overlay)$/.test(overflow) && node.scrollHeight > node.clientHeight + 1)
                owner = node;
            if (/^(auto|scroll|overlay|hidden|clip)$/.test(overflow))
                clippingAncestors.push(node);
        }
        scroller = owner || document.scrollingElement as HTMLElement || document.documentElement;
    }
    function visibleViewport() {
        const visual = window.visualViewport, rect = root.getBoundingClientRect();
        let top = Math.max(rect.top, visual?.offsetTop ?? 0);
        let bottom = Math.min(rect.bottom, (visual?.offsetTop ?? 0) + (visual?.height ?? window.innerHeight));
        for (const node of clippingAncestors) {
            const r = node.getBoundingClientRect(), zoom = r.height / Math.max(1, node.offsetHeight);
            const edge = r.top + node.clientTop * zoom;
            top = Math.max(top, edge);
            bottom = Math.min(bottom, edge + node.clientHeight * zoom);
        }
        return { top, bottom: Math.max(top, bottom) };
    }
    function localViewport() {
        const rect = root.getBoundingClientRect(), zoom = rect.width / Math.max(1, root.clientWidth), view = visibleViewport();
        return { top: (view.top - rect.top) / zoom, bottom: (view.bottom - rect.top) / zoom };
    }
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = media.matches || document.documentElement.dataset.motion === 'reduce', paused = false;
    const wind = .36;
    let elapsed = 0, frontId: string | undefined = notes.find(n => !n.pin)?.id;
    let editId: string | null = null, editorSource: HTMLElement | null = null;
    let drag: Drag | null = null, suppressClick = false, geometry: Geometry, frame: number | undefined, lastFrame = 0;
    let anchorDrag: { id: number; origin: number | undefined; offset: number; startX: number; moved: boolean } | null = null;
    let defaultAnchorX = 0, publishedAnchor = '';
    const anchorPin = $<HTMLButtonElement>('#fg-notes-pin');
    let snap: Snap | null = null, undoEntry: {
        note: HangingNote;
        index: number;
    } | null = null, toastTimer: ReturnType<typeof setTimeout> | undefined;
    let transition: Animation | null = null, transitionSource: HTMLElement | null = null;
    const bodies = new Map<string, Body>();
    const pendulum = { angle: -.025, velocity: 0, extension: 0, ev: 0, paper: -.015, pv: 0, flutter: 0, hovered: false };
    const byId = (id: string | null | undefined) => notes.find(n => n.id === id);
    const hanging = () => notes.filter(n => !n.pin && !(drag?.created && drag.body?.id === n.id));
    const front = () => hanging().find(n => n.id === frontId) || hanging()[0];
    const stackPoint = () => ({ x: geometry.ax + Math.sin(pendulum.angle) * (geometry.length + pendulum.extension), y: geometry.ay + Math.cos(pendulum.angle) * (geometry.length + pendulum.extension) });
    const restPoint = () => ({ x: geometry.ax + Math.sin(elapsed * 1.2) * (reduced || paused ? 0 : 1.1), y: geometry.ay + geometry.length });
    const breakStretch = () => Math.max(160, geometry.scale * 170);
    const BREAK_HOLD_MS = 220;
    const remaining = stack.cloneNode(true) as HTMLButtonElement;
    remaining.removeAttribute('id');
    remaining.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    remaining.classList.add('remaining-stack');
    remaining.setAttribute('aria-hidden', 'true');
    remaining.tabIndex = -1;
    remaining.disabled = true;
    remaining.hidden = true;
    $('#fg-notes-hanging-space').insertBefore(remaining, stack);
    function toast(text: string, undo = false) {
        clearTimeout(toastTimer);
        $('#fg-notes-toast-text').textContent = text;
        $('#fg-notes-undo').hidden = !undo;
        $('#fg-notes-toast').hidden = false;
        positionToast();
        toastTimer = setTimeout(() => { $('#fg-notes-toast').hidden = true; }, undo ? 8000 : 3500);
    }
    function positionToast() {
        const view = localViewport();
        $('#fg-notes-toast').style.top = `${Math.max(12, Math.min(geometry.h, view.bottom) - 76)}px`;
    }
    function saveStatus() {
        $<HTMLButtonElement>('#fg-notes-save-status').textContent = saving ? copy('保存中…') : storageOK ? copy('已保存') : copy('尚未保存，点击重试');
    }
    function persist() {
        const version = ++saveVersion, next = structuredClone(notes), before = () => structuredClone(persisted);
        const anchor = { next: anchorU, before: () => persistedAnchor };
        // Only an acknowledged write advances the baseline. Later saves retry earlier failures.
        pending = null;
        saving++;
        saveStatus();
        void onSave(next, before, anchor).then(() => {
            saving--;
            persisted = next;
            persistedAnchor = anchor.next;
            if (disposed)
                return;
            if (version === saveVersion)
                storageOK = true;
            saveStatus();
        }).catch(() => {
            saving--;
            if (disposed)
                return;
            if (version === saveVersion)
                storageOK = false;
            saveStatus();
            announce(copy('保存未完成，内容仍在此页。请重试。'));
        });
    }
    function announce(text: string) { $('#fg-notes-placement-status').textContent = text; }
    function bounds() {
        const { w, h, scale } = geometry;
        return { left: 120 * scale + 10, right: w - 120 * scale - 10, top: 27 * scale + 10, bottom: h - 194 * scale - 12 };
    }
    function fit(x: number, y: number, avoidQuote = false) {
        const b = bounds();
        x = clamp(x, b.left, b.right);
        y = clamp(y, b.top, b.bottom);
        const q = geometry.quote, half = 120 * geometry.scale, top = 27 * geometry.scale, bottom = 194 * geometry.scale;
        if (avoidQuote && q && x + half > q.left && x - half < q.right && y + bottom > q.top && y - top < q.bottom) {
            const options = [{ x: q.left - half - 12, y }, { x: q.right + half + 12, y }, { x, y: q.bottom + top + 12 }, { x, y: q.top - bottom - 12 }]
                .filter(p => p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom)
                .sort((a, c) => Math.hypot(a.x - x, a.y - y) - Math.hypot(c.x - x, c.y - y));
            if (options[0])
                ({ x, y } = options[0]);
        }
        return { x, y };
    }
    function pointFromPin(pin: NonNullable<HangingNote["pin"]>) {
        const b = bounds();
        return fit(b.left + pin.u * (b.right - b.left), pin.y, true);
    }
    function fillPaper(el: HTMLElement, note: HangingNote | undefined, label = '') {
        el.style.setProperty('--paper', COLORS[note?.color || 'butter']);
        el.querySelector('.paper-preview')!.textContent = note?.text || (note ? copy('一个念头，\n先放在这里。') : copy('＋ 写一张'));
        el.querySelector('.paper-footer>span')!.textContent = label;
        el.setAttribute('aria-label', note ? copy('打开便签：') + (note.text || copy('空白便签')) + copy('。也可以按住拖动。') : copy('写下第一张便签'));
    }
    function updateUI() {
        const list = hanging(), note = front();
        frontId = note?.id;
        fillPaper(stack, note, list.length ? `${String(list.findIndex(n => n.id === frontId) + 1).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}` : copy('纸叠空了，写一张'));
        stack.classList.toggle('is-empty', !note);
        $('#fg-notes-back-one').style.visibility = list.length > 1 ? 'visible' : 'hidden';
        $('#fg-notes-back-two').style.visibility = list.length > 2 ? 'visible' : 'hidden';
        stack.dataset.noteId = frontId || '';
        stack.setAttribute('aria-description', copy('一次取下最上面一张。明显拉远并保持片刻才会断绳；取下的纸可拖回这里重新挂上。'));
        $('#fg-notes-placement-action').textContent = copy('取下这一张');
        $<HTMLButtonElement>('#fg-notes-placement-action').disabled = !note || !!byId(editId)?.pin;
        const count = notes.filter(n => n.pin).length;
        stage.dataset.attachment = drag?.body ? 'free' : 'hanging';
        stage.dataset.hangingCount = String(list.length);
        stage.dataset.pinnedCount = String(count);
        for (const [id, body] of bodies) {
            const n = byId(id);
            if (!n) {
                body.el.remove();
                bodies.delete(id);
                continue;
            }
            fillPaper(body.el, n, copy('留给自己'));
        }
    }
    function updateEditor() {
        const note = byId(editId);
        if (!note)
            return;
        detail.style.setProperty('--paper', COLORS[note.color]);
        input.value = note.text;
        $('#fg-notes-char-count').textContent = `${note.text.length} / 500`;
        const list = hanging(), index = list.findIndex(n => n.id === note.id);
        $('#fg-notes-page-count').textContent = note.pin ? copy('已钉在桌面') : `${index + 1} / ${list.length}`;
        $<HTMLButtonElement>('#fg-notes-prev-note').disabled = $<HTMLButtonElement>('#fg-notes-next-note').disabled = !!note.pin || list.length < 2;
        $('#fg-notes-return-note').hidden = !note.pin;
        detail.classList.toggle('is-pinned-detail', !!note.pin);
        root.querySelectorAll<HTMLElement>('[data-color]').forEach(el => { const active = el.dataset.color === note.color; el.classList.toggle('selected', active); el.setAttribute('aria-pressed', String(active)); });
        saveStatus();
    }
    function makeBody(note: HangingNote, point: Point) {
        let body = bodies.get(note.id);
        if (body)
            return body;
        const el = stack.cloneNode(true) as HTMLButtonElement;
        el.removeAttribute('id');
        el.querySelectorAll('[id]').forEach(child => child.removeAttribute('id'));
        el.querySelectorAll('.paper-back,.knot').forEach(child => child.remove());
        el.className = 'paper-stack loose-note';
        el.dataset.noteId = note.id;
        el.dataset.attachment = note.pin ? 'pinned' : 'free';
        el.style.cursor = '';
        el.removeAttribute('aria-describedby');
        el.setAttribute('aria-expanded', 'false');
        el.inert = false;
        el.setAttribute('aria-description', copy('拖动可换位置；拖回顶栏纸叠，松手即可重新挂上。方向键微调，Shift 加方向键大步移动。'));
        body = { id: note.id, el, x: point.x, y: point.y, tx: point.x, ty: point.y, vx: 0, vy: 0, angle: note.pin?.tilt || 0, av: 0, kind: note.pin ? 'pinned' : 'free' };
        bodies.set(note.id, body);
        $('#fg-notes-hanging-space').append(el);
        fillPaper(el, note, copy('留给自己'));
        bindPaper(el, body);
        renderBody(body);
        return body;
    }
    function animationRect(el: Element) {
        const b = localBox(el);
        return { x: b.left, y: b.top, width: b.right - b.left, height: b.bottom - b.top };
    }
    function localBox(el: Element) {
        const r = el.getBoundingClientRect(), s = stage.getBoundingClientRect(), zoom = s.width / Math.max(1, stage.clientWidth);
        return { left: (r.left - s.left) / zoom, right: (r.right - s.left) / zoom, top: (r.top - s.top) / zoom, bottom: (r.bottom - s.top) / zoom };
    }
    function measure() {
        measureViewport();
        if (disposed)
            return;
        const w = stage.clientWidth, h = stage.clientHeight;
        const anchor = dashboard.querySelector('.dash-notes-anchor');
        if (!w || !h || !anchor)
            return;
        const slot = localBox(anchor), q = dashboard.querySelector('.dash-hero__quote');
        defaultAnchorX = (slot.left + slot.right) / 2;
        geometry = { w, h, scale: .4, ax: defaultAnchorX, ay: slot.top + 4, length: 25, quote: q ? localBox(q) : null };
        placeAnchor();
        for (const note of notes) {
            if (!note.pin)
                continue;
            const point = pointFromPin(note.pin), body = makeBody(note, point);
            if (drag?.body === body)
                continue;
            body.x = body.tx = point.x;
            body.y = body.ty = point.y;
            body.angle = note.pin.tilt;
            renderBody(body);
        }
        if (editId)
            positionEditor();
        updateUI();
        render();
        wake();
    }
    function placeAnchor(impulse = false) {
        const previous = geometry.ax, b = bounds(), q = geometry.quote, half = 160 * geometry.scale;
        let x = clamp(anchorU === undefined ? defaultAnchorX : anchorU * geometry.w, b.left, b.right);
        const top = geometry.ay + geometry.length - 27 * geometry.scale;
        const bottom = geometry.ay + geometry.length + 194 * geometry.scale;
        if (q && top < q.bottom && bottom > q.top && x + half > q.left && x - half < q.right) {
            const choices = [q.left - half - 12, q.right + half + 12].filter(value => value >= b.left && value <= b.right);
            x = choices.sort((a, c) => Math.abs(a - x) - Math.abs(c - x))[0] ?? clamp(defaultAnchorX, b.left, b.right);
        }
        geometry.ax = x;
        anchorPin.style.left = `${x}px`;
        anchorPin.style.top = `${geometry.ay}px`;
        anchorPin.setAttribute('aria-valuenow', String(Math.round(x / geometry.w * 100)));
        if (impulse && !reduced && !paused)
            pendulum.velocity = clamp(pendulum.velocity - clamp((x - previous) * .012, -.15, .15), -1.2, 1.2);
        const header = dashboard.querySelector<HTMLElement>('.dash-header');
        const slot = dashboard.querySelector<HTMLElement>('.dash-notes-anchor');
        if (header && slot) {
            const center = (x - localBox(header).left).toFixed(2);
            slot.dataset.noteAnchorX = center;
            // Move the desk once on release, keeping it still while the pin is dragged.
            if (!anchorDrag && publishedAnchor !== center) {
                publishedAnchor = center;
                header.dispatchEvent(new Event('focusgo:notes-anchor-moved'));
            }
        }
    }
    function moveAnchor(event: PointerPosition) {
        if (!anchorDrag || event.pointerId !== anchorDrag.id)
            return;
        if (!anchorDrag.moved && Math.abs(event.clientX - anchorDrag.startX) < 3)
            return;
        anchorDrag.moved = true;
        anchorU = clamp((pointerLocal(event).x - anchorDrag.offset) / geometry.w, 0, 1);
        placeAnchor(true);
        render();
        wake();
    }
    function endAnchor(cancel = false) {
        if (!anchorDrag)
            return;
        const { id, origin, moved } = anchorDrag;
        anchorDrag = null;
        root.classList.remove('is-moving-anchor');
        if (cancel)
            anchorU = origin;
        if (anchorPin.hasPointerCapture?.(id))
            anchorPin.releasePointerCapture(id);
        placeAnchor();
        if (!cancel && moved && anchorU !== origin) {
            persist();
            announce(copy('悬挂位置已调整。'));
        }
        else if (pending)
            applyIncoming(pending.notes, pending.anchor);
        render();
        wake();
    }
    listen(anchorPin, 'pointerdown', event => {
        if (event.button !== 0 || event.isPrimary === false || drag || anchorDrag)
            return;
        event.preventDefault();
        closeEditor(false);
        anchorPin.focus({ preventScroll: true });
        anchorDrag = { id: event.pointerId, origin: anchorU, offset: pointerLocal(event).x - geometry.ax, startX: event.clientX, moved: false };
        anchorPin.setPointerCapture?.(event.pointerId);
        root.classList.add('is-moving-anchor');
    });
    listen(anchorPin, 'pointermove', moveAnchor);
    listen(anchorPin, 'pointerup', event => { if (anchorDrag?.id === event.pointerId) { moveAnchor(event); endAnchor(); } });
    listen(anchorPin, 'pointercancel', event => { if (anchorDrag?.id === event.pointerId) endAnchor(true); });
    listen(anchorPin, 'lostpointercapture', event => { if (anchorDrag?.id === event.pointerId) endAnchor(true); });
    listen(anchorPin, 'keydown', event => {
        if (drag || anchorDrag || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
            return;
        event.preventDefault();
        closeEditor(false);
        const step = event.shiftKey ? 24 : 8;
        anchorU = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : clamp((geometry.ax + (event.key === 'ArrowLeft' ? -step : step)) / geometry.w, 0, 1);
        placeAnchor(true);
        persist();
        render();
        wake();
    });
    listen(anchorPin, 'dblclick', () => {
        if (drag || anchorDrag)
            return;
        anchorU = undefined;
        placeAnchor(true);
        persist();
        render();
        wake();
    });
    function positionEditor() {
        const body = bodies.get(editId ?? ''), point = body || { x: geometry.ax, y: geometry.ay + 34 };
        const view = localViewport();
        detail.style.maxHeight = `${Math.max(100, view.bottom - view.top - 24)}px`;
        const width = Math.min(330, geometry.w - 24), height = detail.hidden ? 375 : detail.offsetHeight;
        let left = clamp(point.x - width / 2, 12, geometry.w - width - 12);
        let top = clamp(point.y - 13, Math.max(12, view.top + 12), Math.min(geometry.h, view.bottom) - height - 12);
        const q = geometry.quote;
        if (q && left + width > q.left && left < q.right && top < q.bottom && top + height > q.top) {
            if (q.left - width - 12 >= 12)
                left = q.left - width - 12;
            else if (q.bottom + height + 12 < view.bottom)
                top = q.bottom + 12;
        }
        detail.style.left = `${left}px`;
        detail.style.top = `${top}px`;
        detail.style.width = `${width}px`;
    }
    function openEditor(id = front()?.id, focusText = false) {
        if (!id) {
            addNote();
            return;
        }
        if (editId)
            closeEditor(false);
        const note = byId(id);
        if (!note)
            return;
        if (!note.pin)
            frontId = id;
        editorSource = bodies.get(id)?.el || stack;
        const from = animationRect(editorSource);
        editId = id;
        detail.hidden = false;
        updateUI();
        updateEditor();
        positionEditor();
        editorSource.inert = true;
        editorSource.classList.add('is-editing');
        editorSource.setAttribute('aria-expanded', 'true');
        stage.classList.add('is-open');
        if (!reduced) {
            transition?.cancel();
            const to = animationRect(detail);
            transitionSource = detail;
            transition = detail.animate([{ transform: `translate(${from.x + from.width / 2 - to.x - to.width / 2}px,${from.y - to.y}px) scale(${geometry.scale * .65})`, opacity: .2 }, { transform: 'translate(0,0) scale(1)', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.16,1,.3,1)' });
        }
        (focusText ? input : $('#fg-notes-close-note')).focus({ preventScroll: true });
        render();
        wake();
    }
    function closeEditor(focus = true) {
        if (!editId)
            return;
        const source = editorSource, from = animationRect(detail);
        editId = null;
        transition?.cancel();
        detail.hidden = true;
        stage.classList.remove('is-open');
        if (source) {
            source.inert = false;
            source.classList.remove('is-editing');
            source.setAttribute('aria-expanded', 'false');
        }
        updateUI();
        render();
        if (source?.isConnected) {
            const to = animationRect(source);
            if (!reduced) {
                transitionSource = source;
                transition = source.animate([{ translate: `${from.x + from.width / 2 - to.x - to.width / 2}px ${from.y - to.y}px`, scale: Math.min(2, from.width / to.width), opacity: .3 }, { translate: '0px 0px', scale: 1, opacity: 1 }], { duration: 280, easing: 'cubic-bezier(.16,1,.3,1)' });
            }
            if (focus)
                source.focus({ preventScroll: true });
        }
        else if (focus)
            stack.focus({ preventScroll: true });
        editorSource = null;
        if (pending)
            applyIncoming(pending.notes, pending.anchor);
        wake();
    }
    function addNote() {
        closeEditor(false);
        if (notes.length >= 80) {
            toast(copy('这叠纸有点厚了，先收走几张吧。'));
            return;
        }
        const note: HangingNote = { id: crypto.randomUUID(), text: '', color: 'butter' };
        notes.push(note);
        frontId = note.id;
        persist();
        updateUI();
        openEditor(note.id, true);
    }
    function turnPage(direction: number) {
        if (!editId || byId(editId)?.pin)
            return;
        const list = hanging();
        if (list.length < 2)
            return;
        const index = list.findIndex(n => n.id === editId);
        const next = list[(index + direction + list.length) % list.length];
        frontId = editId = next.id;
        updateUI();
        updateEditor();
        if (!reduced) {
            transitionSource = detail;
            transition = detail.animate([{ translate: `${direction * 13}px 0px`, rotate: `${direction * 1.5}deg`, opacity: .5 }, { translate: '0px 0px', rotate: '0deg', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.16,1,.3,1)' });
            wake();
        }
    }
    function archive() {
        const id = editId;
        closeEditor(false);
        const index = notes.findIndex(n => n.id === id);
        if (index < 0)
            return;
        const note = notes[index];
        undoEntry = { note: structuredClone(note), index };
        notes.splice(index, 1);
        bodies.get(note.id)?.el.remove();
        bodies.delete(note.id);
        persist();
        updateUI();
        render();
        stack.focus({ preventScroll: true });
        toast(copy('这张便签已经收走了。'), true);
    }
    function undo() {
        if (!undoEntry)
            return;
        if (notes.length >= 80) {
            toast(copy('便签已满，先收走一张再撤回。'), true);
            return;
        }
        const { note, index } = undoEntry;
        notes.splice(Math.min(index, notes.length), 0, note);
        undoEntry = null;
        if (note.pin)
            makeBody(note, pointFromPin(note.pin));
        else
            frontId = note.id;
        persist();
        updateUI();
        render();
        openEditor(note.id);
        $('#fg-notes-toast').hidden = true;
    }
    function returnSheet() {
        if (editId)
            returnToStack(editId);
    }
    function returnToStack(id: string) {
        if (editId === id)
            closeEditor(false);
        const note = byId(id), body = bodies.get(id);
        if (!note || !body)
            return;
        const from = animationRect(body.el), angle = body.angle;
        transition?.cancel();
        body.el.remove();
        bodies.delete(id);
        delete note.pin;
        frontId = id;
        if (snap?.id === id)
            snap = null;
        resetPendulum();
        persist();
        updateUI();
        render();
        if (!reduced) {
            const to = animationRect(stack), scale = geometry.scale;
            // Animate only the returning front sheet; the rest of the stack stays put.
            $('#fg-notes-paper-front').animate([
                { translate: `${(from.x - to.x) / scale}px ${(from.y - to.y) / scale}px`, rotate: `${angle - pendulum.paper}rad`, opacity: .7 },
                { translate: '0px 0px', rotate: '0rad', opacity: 1 },
            ], { duration: 360, easing: 'cubic-bezier(.16,1,.3,1)' });
            stack.querySelector('.knot')!.animate([{ opacity: 0, scale: .7 }, { opacity: 1, scale: 1 }], { duration: 180, delay: 180, fill: 'backwards', easing: 'ease-out' });
            if (!paused)
                pendulum.velocity = .12;
        }
        stack.focus({ preventScroll: true });
        announce(copy('这一张已重新挂好，其他便签保持原位。'));
        wake();
    }
    function resetPendulum() { Object.assign(pendulum, { angle: -.02, velocity: 0, extension: 0, ev: 0, paper: -.01, pv: 0, flutter: 0 }); }
    function detachTop() {
        const note = front();
        if (!note)
            return null;
        const point = stackPoint();
        snap = reduced ? null : { started: performance.now(), ax: geometry.ax, ay: geometry.ay, x: point.x, y: point.y, id: note.id };
        const body = makeBody(note, point);
        body.kind = 'free';
        body.el.dataset.attachment = 'free';
        body.angle = pendulum.paper;
        if (drag) {
            drag.body = body;
            drag.created = true;
        }
        resetPendulum();
        stage.classList.remove('is-tensioned');
        remaining.hidden = true;
        updateUI();
        announce(copy('只取下这一张。剩下的纸继续挂着，松手即可钉住手里的这一张。'));
        wake();
        return body;
    }
    function pinBody(body: Body, animate = true) {
        const note = byId(body.id);
        if (!note)
            return;
        const previous = { x: body.x, y: body.y }, point = fit(body.tx, body.ty, true), b = bounds();
        body.x = body.tx = point.x;
        body.y = body.ty = point.y;
        body.vx = body.vy = 0;
        body.kind = 'pinned';
        body.angle = clamp(body.angle * .35, -.045, .045);
        note.pin = { u: clamp((point.x - b.left) / Math.max(1, b.right - b.left), 0, 1), y: point.y, tilt: body.angle };
        body.el.dataset.attachment = 'pinned';
        renderBody(body);
        persist();
        updateUI();
        if (animate && !reduced) {
            body.el.animate([{ translate: `${previous.x - point.x}px ${previous.y - point.y}px` }, { translate: '0px 0px' }], { duration: 140, easing: 'cubic-bezier(.16,1,.3,1)' });
            body.el.querySelector('.pushpin')!.animate([{ transform: 'translate(7px,-24px) scale(1.35) rotate(18deg)', opacity: 0 }, { transform: 'translate(1px,-2px) scale(1.04)', opacity: 1, offset: .7 }, { transform: 'translate(0,0) scale(1)', opacity: 1 }], { duration: 300, delay: 70, fill: 'backwards', easing: 'cubic-bezier(.22,1,.36,1)' });
            body.el.animate([{ rotate: '1deg' }, { rotate: '-.4deg', offset: .55 }, { rotate: '0deg' }], { duration: 330, easing: 'ease-out' });
        }
        announce(copy('这一张已钉好。可以继续从纸叠取下一张。'));
        wake();
    }
    function pointerDown(event: PointerEvent, body: Body | null = null) {
        if (anchorDrag) return;
        if (event.button !== 0 || drag || event.isPrimary === false)
            return;
        if (editId)
            closeEditor(false);
        if (body && (bodies.get(body.id) !== body || !byId(body.id) || !body.el.isConnected))
            return;
        if (!body && !front())
            return;
        const el = event.currentTarget as HTMLButtonElement;
        el.getAnimations().forEach(a => a.cancel());
        el.querySelector('.pushpin')?.getAnimations().forEach(a => a.cancel());
        el.querySelector('.paper-front')!.getAnimations().forEach(a => a.cancel());
        transition?.cancel();
        const point = body || stackPoint(), { x: lx, y: ly } = pointerLocal(event);
        drag = { id: event.pointerId, capture: el, body, created: false, moved: false, overSince: null, returnReady: false, x: event.clientX, y: event.clientY, sx: event.clientX, sy: event.clientY, lx, ly, startX: lx, startY: ly, offsetX: lx - point.x, offsetY: ly - point.y, angle: pendulum.angle, extension: pendulum.extension, originFront: frontId, originPin: body ? structuredClone(byId(body.id)!.pin!) : null, originPoint: { x: point.x, y: point.y } };
        el.setPointerCapture(event.pointerId);
        el.style.cursor = 'grabbing';
        suppressClick = false;
        wake();
    }
    function pointerMove(event: PointerPosition) {
        if (!drag || event.pointerId !== drag.id)
            return;
        drag.x = event.clientX;
        drag.y = event.clientY;
        const local = pointerLocal(event);
        drag.lx = local.x;
        drag.ly = local.y;
        if (Math.hypot(drag.x - drag.sx, drag.y - drag.sy) > 5)
            drag.moved = true;
        if (!drag.moved)
            return;
        updateBreakIntent();
        if (drag.body) {
            updateFreeTarget();
        }
        wake();
    }
    function updateBreakIntent() {
        if (!drag?.moved || drag.body)
            return;
        const dx = drag.lx - drag.startX + Math.sin(drag.angle) * geometry.length;
        const dy = drag.ly - drag.startY + Math.cos(drag.angle) * (geometry.length + drag.extension);
        const pull = Math.hypot(dx, dy) - geometry.length, threshold = breakStretch();
        stage.classList.toggle('is-tensioned', pull > threshold * .65);
        stage.classList.add('is-pulling');
        $('#fg-notes-gesture-copy').textContent = pull >= threshold ? copy('保持一下，取下这一张') : copy('再拉远一些，才会取下来');
        if (pull < threshold) {
            drag.overSince = null;
            return;
        }
        drag.overSince ??= performance.now();
        if (performance.now() - drag.overSince >= BREAK_HOLD_MS) {
            detachTop();
            stage.classList.remove('is-pulling');
            updateFreeTarget();
        }
    }
    function updateFreeTarget() {
        if (!drag?.body || !drag.moved)
            return;
        const body = drag.body, x = drag.lx - drag.offsetX, y = drag.ly - drag.offsetY, home = restPoint();
        const rx = Math.max(52, 214 * geometry.scale * .58), ry = Math.max(48, 196 * geometry.scale * .45);
        const ready = Math.abs(x - home.x) <= rx && Math.abs(y - home.y) <= ry;
        if (ready !== drag.returnReady) {
            drag.returnReady = ready;
            if (ready)
                announce(copy('已对准纸叠，松手即可挂回这一张。'));
        }
        const target = ready ? home : fit(x, y);
        body.kind = 'free';
        body.el.dataset.attachment = 'free';
        body.tx = target.x;
        body.ty = target.y;
    }
    function renderReturnTarget() {
        const target = $('#fg-notes-return-target'), visible = !!(drag?.body && drag.moved);
        target.hidden = !visible;
        stage.classList.toggle('return-ready', visible && !!drag?.returnReady);
        if (!visible)
            return;
        const home = restPoint(), width = 214 * geometry.scale + 28, height = 196 * geometry.scale + 26;
        target.style.left = `${home.x - width / 2}px`;
        target.style.top = `${home.y - 15 * geometry.scale - 13}px`;
        target.style.width = `${width}px`;
        target.style.height = `${height}px`;
        target.querySelector('span')!.textContent = drag?.returnReady ? copy('松手，挂回这里') : copy('拖回这里，可重新挂上');
    }
    function finishCapture() {
        const previous = drag;
        drag = null;
        if (!previous)
            return;
        previous.capture.style.cursor = '';
        stage.classList.remove('is-tensioned', 'is-pulling', 'return-ready');
        $('#fg-notes-return-target').hidden = true;
        remaining.hidden = true;
        stack.classList.remove('dragging-one');
        $('#fg-notes-gesture-copy').textContent = copy('拉远并保持一下，就能取下来');
        if (previous.capture.hasPointerCapture(previous.id))
            previous.capture.releasePointerCapture(previous.id);
        return previous;
    }
    function pointerEnd(event: PointerEvent) {
        if (!drag || event.pointerId !== drag.id)
            return;
        // A final position may arrive only with pointerup (touch/coalesced input).
        pointerMove(event);
        const previous = finishCapture();
        if (!previous)
            return;
        suppressClick = previous.moved;
        if (previous.moved && previous.body) {
            if (previous.returnReady)
                returnToStack(previous.body.id);
            else
                pinBody(previous.body);
        }
        else if (paused || reduced)
            resetPendulum();
        updateUI();
        render();
        if (pending)
            applyIncoming(pending.notes, pending.anchor);
        wake();
        if (previous.moved)
            setTimeout(() => { suppressClick = false; }, 100);
    }
    function cancelDrag(event?: {
        pointerId?: number;
    }) {
        if (!drag || (event?.pointerId !== undefined && event.pointerId !== drag.id))
            return;
        const previous = finishCapture();
        if (!previous)
            return;
        if (previous.created && previous.body) {
            previous.body.el.remove();
            bodies.delete(previous.body.id);
            frontId = previous.originFront;
        }
        else if (previous.body) {
            const body = previous.body;
            body.kind = 'pinned';
            body.el.dataset.attachment = 'pinned';
            body.x = body.tx = previous.originPoint.x;
            body.y = body.ty = previous.originPoint.y;
            body.angle = previous.originPin?.tilt ?? 0;
            body.vx = body.vy = 0;
            renderBody(body);
        }
        snap = null;
        resetPendulum();
        suppressClick = true;
        if (pending)
            applyIncoming(pending.notes, pending.anchor);
        updateUI();
        render();
        wake();
        announce(copy('已取消移动，这张纸回到原来的位置。'));
        setTimeout(() => { suppressClick = false; }, 100);
    }
    function bindPaper(el: HTMLButtonElement, body: Body | null = null) {
        listen(el, 'pointerdown', e => pointerDown(e, body));
        listen(el, 'pointermove', pointerMove);
        listen(el, 'pointerup', pointerEnd);
        listen(el, 'pointercancel', cancelDrag);
        listen(el, 'lostpointercapture', e => { if (drag?.capture === el)
            cancelDrag(e); });
        listen(el, 'click', () => { if (!suppressClick)
            openEditor(body?.id || front()?.id); });
        listen(el, 'pointerenter', e => { if (!body && e.pointerType !== 'touch') {
            pendulum.hovered = true;
            if (!paused && !reduced && !drag)
                pendulum.velocity += .075;
            wake();
        } });
        listen(el, 'pointerleave', () => { if (!body) {
            pendulum.hovered = false;
            wake();
        } });
        listen(el, 'keydown', e => {
            if (['Enter', ' '].includes(e.key))
                suppressClick = false;
            if (body && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                e.preventDefault();
                const step = e.shiftKey ? 24 : 8;
                body.tx += e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
                body.ty += e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
                pinBody(body, false);
            }
        });
    }
    function simulate(dt: number) {
        const active = !paused && !reduced, p = pendulum;
        if (drag?.moved && !drag.body) {
            const dx = drag.lx - drag.startX + Math.sin(drag.angle) * geometry.length, dy = drag.ly - drag.startY + Math.cos(drag.angle) * (geometry.length + drag.extension);
            const target = clamp(Math.atan2(dx, Math.max(18, dy)), -.95, .95), extension = clamp(Math.hypot(dx, dy) - geometry.length, -geometry.length * .5, breakStretch() * .72);
            if (active) {
                p.velocity += ((target - p.angle) * 165 - p.velocity * 23) * dt;
                p.ev += ((extension - p.extension) * 155 - p.ev * 22) * dt;
            }
            else {
                p.angle = target;
                p.extension = extension;
                p.velocity = p.ev = 0;
            }
        }
        else if (active) {
            const breeze = wind * (.64 * Math.sin(elapsed * 1.23) + .27 * Math.sin(elapsed * 2.07 + 1.4));
            p.velocity += (-18 * Math.sin(p.angle) - 2.65 * p.velocity + breeze) * dt;
            p.ev += (-p.extension * 90 - p.ev * 13) * dt;
        }
        if (active) {
            p.velocity = clamp(p.velocity, -3.4, 3.4);
            p.angle = clamp(p.angle + p.velocity * dt, -1.08, 1.08);
            p.extension += p.ev * dt;
            const target = p.angle * .42 - p.velocity * .07 + (p.hovered && !drag ? -.025 : 0);
            p.pv += ((target - p.paper) * 100 - p.pv * 13) * dt;
            p.paper += p.pv * dt;
            p.flutter += (p.velocity * .06 + wind * .009 * Math.sin(elapsed * 2.6) - p.flutter) * Math.min(1, dt * 10);
        }
        if (drag?.body && drag.moved) {
            const b = drag.body;
            if (!active) {
                b.x = b.tx;
                b.y = b.ty;
                b.angle = 0;
            }
            else {
                b.vx += ((b.tx - b.x) * 420 - b.vx * 37) * dt;
                b.vy += ((b.ty - b.y) * 420 - b.vy * 37) * dt;
                b.x += b.vx * dt;
                b.y += b.vy * dt;
                b.av += ((clamp(b.vx * .00015, -.09, .09) - b.angle) * 95 - b.av * 16) * dt;
                b.angle += b.av * dt;
            }
        }
    }
    function setPaperPose(el: HTMLElement, x: number, y: number, angle: number) { el.style.transform = `translate3d(${x - 107}px,${y - 15}px,0) scale(${geometry.scale}) rotate(${angle}rad)`; }
    function renderBody(body: Body) { setPaperPose(body.el, body.x, body.y, body.angle); }
    function renderSnap() {
        let upper = '', lower = '', fibers = '';
        if (snap) {
            const t = clamp((performance.now() - snap.started) / 550, 0, 1), eased = 1 - (1 - t) ** 3;
            const cx = snap.ax + (snap.x - snap.ax) * .59, cy = snap.ay + (snap.y - snap.ay) * .59;
            const recoil = Math.sin(t * Math.PI * 3) * (1 - t) * 12;
            upper = `M ${snap.ax} ${snap.ay} Q ${snap.ax + recoil} ${(snap.ay + cy) / 2} ${cx + (snap.ax - cx) * eased} ${cy + (snap.ay + 16 - cy) * eased}`;
            const body = bodies.get(snap.id);
            if (body)
                lower = `M ${body.x} ${body.y} Q ${body.x - recoil * .5} ${body.y + (cy - snap.y) * (1 - eased) * .5} ${body.x + (cx - snap.x) * (1 - eased) + recoil * .4} ${body.y + (cy - snap.y) * (1 - eased)}`;
            for (let i = 0; i < 6; i++) {
                const a = i * Math.PI / 3 + .2, r = 2 + t * 12;
                fibers += `<path d="M ${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r} l ${Math.cos(a) * 3} ${Math.sin(a) * 3}" opacity="${Math.max(0, 1 - t * 2.2)}"/>`;
            }
            if (t >= 1) {
                snap = null;
                upper = lower = fibers = '';
            }
        }
        $('#fg-notes-rope-break-upper').setAttribute('d', upper);
        $('#fg-notes-rope-loose').setAttribute('d', lower);
        $('#fg-notes-rope-loose-fiber').setAttribute('d', lower);
        $('#fg-notes-snap-fibers').innerHTML = fibers;
    }
    function render() {
        if (!geometry)
            return;
        const point = stackPoint(), { ax, ay, scale } = geometry;
        renderReturnTarget();
        if (drag?.moved && !drag.body) {
            $('#fg-notes-gesture-hint').style.left = `${clamp(point.x - 85, 16, geometry.w - 210)}px`;
            $('#fg-notes-gesture-hint').style.top = `${Math.min(geometry.h - 68, point.y + 194 * scale + 15)}px`;
        }
        setPaperPose(stack, point.x, point.y, pendulum.paper);
        $('#fg-notes-back-one').style.transform = `translate(-4px,5px) rotate(${-6 + pendulum.flutter * 180}deg)`;
        $('#fg-notes-back-two').style.transform = `translate(4px,9px) rotate(${7 - pendulum.flutter * 230}deg)`;
        const pullingOne = drag?.moved && !drag.body, viewingOne = editId && !byId(editId)?.pin, rest = hanging().filter(n => n.id !== frontId);
        stack.classList.toggle('dragging-one', !!pullingOne);
        remaining.hidden = !((pullingOne || viewingOne) && rest.length);
        if (!remaining.hidden) {
            fillPaper(remaining, rest[0], `01 / ${String(rest.length).padStart(2, '0')}`);
            remaining.querySelector<HTMLElement>('.paper-back-one')!.style.visibility = rest.length > 1 ? 'visible' : 'hidden';
            remaining.querySelector<HTMLElement>('.paper-back-two')!.style.visibility = rest.length > 2 ? 'visible' : 'hidden';
            const r = restPoint();
            setPaperPose(remaining, r.x, r.y, -.015);
            $('#fg-notes-rope-rest').setAttribute('d', `M ${ax} ${ay} Q ${ax - 1} ${(ay + r.y) / 2} ${r.x} ${r.y}`);
        }
        else
            $('#fg-notes-rope-rest').setAttribute('d', '');
        let ex = point.x, ey = point.y;
        const hangingEditor = editId && !byId(editId)?.pin;
        if (hangingEditor) {
            const r = localBox(detail);
            ex = (r.left + r.right) / 2;
            ey = r.top + 13;
        }
        else if (transition?.playState === 'running' && transitionSource === stack) {
            const r = localBox(stack.querySelector('.eyelet')!);
            ex = (r.left + r.right) / 2;
            ey = (r.top + r.bottom) / 2;
        }
        const path = `M ${ax} ${ay} Q ${(ax + ex) / 2 - (hangingEditor ? 0 : pendulum.velocity * 8)} ${(ay + ey) / 2 + Math.abs(ex - ax) * .08} ${ex} ${ey}`;
        ['rope-base', 'rope-fiber', 'rope-shadow'].forEach(id => $(`#fg-notes-${id}`).setAttribute('d', path));
        if (drag?.body)
            renderBody(drag.body);
        renderSnap();
        $('#fg-notes-ground-shadow').style.left = `${point.x - 85}px`;
        $('#fg-notes-ground-shadow').style.top = `${Math.min(geometry.h - 78, point.y + 213 * scale)}px`;
        $('#fg-notes-ground-shadow').style.transform = `scale(${scale})`;
        $('#fg-notes-ground-shadow').style.opacity = hangingEditor ? '0' : '.45';
    }
    function tick(now: number) {
        frame = undefined;
        const dt = Math.min((now - (lastFrame || now)) / 1000, .032);
        lastFrame = now;
        if (!paused && !reduced)
            elapsed += dt;
        if (drag?.moved && scroller) {
            const r = visibleViewport(), edge = 42;
            const direction = drag.y > r.bottom - edge ? 1 : drag.y < r.top + edge ? -1 : 0;
            if (direction) {
                scroller.scrollTop += direction * 500 * dt;
                pointerMove({ pointerId: drag.id, clientX: drag.x, clientY: drag.y });
            }
        }
        updateBreakIntent();
        for (let i = 0; i < 4; i++)
            simulate(dt / 4);
        render();
        if ((!paused && !reduced && hanging().length) || drag || snap || transition?.playState === 'running')
            wake();
    }
    function wake() { if (!disposed && frame === undefined && !document.hidden)
        frame = requestAnimationFrame(tick); }
    bindPaper(stack);
    listen($('#fg-notes-placement-action'), 'click', () => {
        const id = editId || front()?.id;
        if (!id || byId(id)?.pin)
            return;
        closeEditor(false);
        frontId = id;
        const body = detachTop();
        if (!body)
            return;
        const point = fit(geometry.ax, Math.max(geometry.ay + 165, geometry.quote?.bottom ?? 0) + 30, true);
        body.tx = point.x;
        body.ty = point.y;
        pinBody(body);
        body.el.focus({ preventScroll: true });
    });
    listen($('#fg-notes-close-note'), 'click', () => closeEditor());
    listen($('#fg-notes-add-note'), 'click', addNote);
    listen($('#fg-notes-prev-note'), 'click', () => turnPage(-1));
    listen($('#fg-notes-next-note'), 'click', () => turnPage(1));
    listen($('#fg-notes-archive-note'), 'click', archive);
    listen($('#fg-notes-undo'), 'click', undo);
    listen($('#fg-notes-return-note'), 'click', returnSheet);
    listen($<HTMLButtonElement>('#fg-notes-save-status'), 'click', () => { if (!storageOK)
        persist(); });
    listen(input, 'input', () => { const n = byId(editId); if (!n)
        return; n.text = input.value; $('#fg-notes-char-count').textContent = `${n.text.length} / 500`; persist(); updateUI(); });
    root.querySelectorAll<HTMLElement>('[data-color]').forEach(el => listen(el, 'click', () => { const n = byId(editId); if (!n)
        return; n.color = el.dataset.color as HangingNote['color']; persist(); updateUI(); updateEditor(); }));
    listen($('#fg-notes-pause'), 'click', () => { paused = !paused; $('#fg-notes-pause').setAttribute('aria-pressed', String(paused)); $('#fg-notes-pause').textContent = paused ? copy('继续摆动') : copy('暂停摆动'); if (paused)
        resetPendulum(); render(); wake(); });
    listen(document, 'keydown', e => {
        if (e.defaultPrevented || e.isComposing)
            return;
        if (e.key === 'Escape' && (drag || editId || anchorDrag)) {
            e.preventDefault();
            if (anchorDrag)
                endAnchor(true);
            else if (drag)
                cancelDrag();
            else
                closeEditor();
        }
    });
    listen(document, 'pointerdown', e => { if (editId && e.target instanceof Node && !detail.contains(e.target) && !$('#fg-notes-toast').contains(e.target))
        closeEditor(false); });
    function syncMotion() {
        reduced = media.matches || document.documentElement.dataset.motion === 'reduce';
        transition?.cancel();
        root.getAnimations({ subtree: true }).forEach(a => a.cancel());
        snap = null;
        resetPendulum();
        render();
        wake();
    }
    media.addEventListener('change', syncMotion, { signal: controller.signal });
    const motionObserver = new MutationObserver(syncMotion);
    motionObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    listen(window, 'blur', () => { cancelDrag(); endAnchor(true); });
    window.addEventListener('scroll', event => {
        if (event.target instanceof Node && detail.contains(event.target))
            return;
        if (drag)
            pointerMove({ pointerId: drag.id, clientX: drag.x, clientY: drag.y });
        if (editId)
            positionEditor();
        if (!$('#fg-notes-toast').hidden)
            positionToast();
    }, { passive: true, capture: true, signal: controller.signal });
    listen(document, 'visibilitychange', () => { if (frame)
        cancelAnimationFrame(frame); frame = undefined; lastFrame = 0; if (document.hidden) {
        cancelDrag(); endAnchor(true); }
    else
        wake(); });
    const observer = new ResizeObserver(() => { measure(); });
    observer.observe(stage);
    const header = dashboard.querySelector('.dash-header');
    if (header)
        observer.observe(header);
    // Quote swaps replace the figure; header size alone can remain unchanged.
    const headerObserver = new MutationObserver(() => measure());
    if (header)
        headerObserver.observe(header, { childList: true, subtree: true, characterData: true });
    listen(window, 'resize', measure);
    void document.fonts?.ready.then(() => { if (!disposed)
        measure(); });
    measure();
    updateUI();
    wake();
    function applyIncoming(next: HangingNote[], nextAnchor?: number) {
        nextAnchor = normalizeHangingAnchor(nextAnchor);
        if (disposed)
            return;
        if (JSON.stringify(next) === JSON.stringify(notes) && anchorU === nextAnchor) {
            pending = null;
            return;
        }
        if (drag || anchorDrag || editId || saving || !storageOK) {
            pending = { notes: next, anchor: nextAnchor };
            return;
        }
        pending = null;
        notes = structuredClone(next);
        persisted = structuredClone(next);
        anchorU = persistedAnchor = nextAnchor;
        for (const [id, body] of bodies) {
            if (!notes.find(n => n.id === id)?.pin) {
                body.el.remove();
                bodies.delete(id);
            }
        }
        measure();
    }
    return {
        update: applyIncoming,
        destroy() {
            disposed = true;
            controller.abort();
            observer.disconnect();
            headerObserver.disconnect();
            motionObserver.disconnect();
            if (frame)
                cancelAnimationFrame(frame);
            clearTimeout(toastTimer);
            root.getAnimations({ subtree: true }).forEach(a => a.cancel());
            root.classList.remove('is-moving-anchor');
            root.replaceChildren();
        },
    };
}
