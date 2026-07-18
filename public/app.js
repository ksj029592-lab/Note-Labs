function byId(id) {
  return document.getElementById(id);
}

function parseJson(text, label) {
  try {
    return JSON.parse(text || "[]");
  } catch {
    throw new Error(label + " JSON 파싱 실패");
  }
}

const state = {
  notes: [],
  selectedNoteId: "",
  pages: [],
  selectedPageIndex: 0,
  draggingPageIndex: null,
  findCursor: 0,
  authToken: window.localStorage.getItem("auth-token") || "",
  authUser: null,
  editorMode: "text",
  activeHighlight: "",
  activeTextColor: "",
  activeAlign: "left",
  drawTool: "pen",
  drawColor: "#1b2225",
  drawWidth: 3,
  strokes: [],
  drawingSession: null,
  hasUnsavedChanges: false,
  autoSaveTimerId: null,
  autoSaveInFlight: false
};

const API_BASE = window.location.protocol === "file:" ? "http://localhost:3000" : "";
const QUICK_ACCOUNT_PASSWORD = "Notes!2026";
const AUTO_SAVE_DELAY_MS = 900;

function apiUrl(path) {
  return API_BASE + path;
}

function fields() {
  return {
    noteId: byId("noteId").value.trim(),
    title: byId("title").value.trim(),
    expectedVersion: Number(byId("expectedVersion").value),
    strokes: state.strokes
  };
}

function authHeaders(extra) {
  const headers = Object.assign({}, extra || {});
  if (state.authToken) {
    headers.Authorization = "Bearer " + state.authToken;
  }

  return headers;
}

function isLoggedIn() {
  return Boolean(state.authToken && state.authUser);
}

function requireLogin() {
  if (!isLoggedIn()) {
    throw new Error("로그인이 필요합니다.");
  }
}

function setAuthUserLabel() {
  const label = byId("authUserLabel");
  if (label) {
    label.textContent = state.authUser ? state.authUser.username : "로그아웃 상태";
  }
}

function setAuthMessage(text, tone) {
  const node = byId("authMessage");
  if (!node) {
    return;
  }

  node.textContent = text;
  if (tone === "warn") {
    node.style.background = "#ffe9d9";
    node.style.borderColor = "#e5ad8f";
    node.style.color = "#7f2f15";
    return;
  }

  node.style.background = "#e5f4ee";
  node.style.borderColor = "#9fd7c8";
  node.style.color = "#0c5c4f";
}

function validateSignupPassword(password) {
  if (password.length < 8) {
    return "비밀번호가 너무 짧습니다. 8자 이상으로 다시 입력해주세요.";
  }

  if (!/[a-z]/.test(password)) {
    return "소문자를 포함해 다시 입력해주세요.";
  }

  if (!/[0-9]/.test(password)) {
    return "숫자를 포함해 다시 입력해주세요.";
  }

  if (!(/[A-Z]/.test(password) || /[^A-Za-z0-9]/.test(password))) {
    return "대문자 또는 특수문자 중 하나를 포함해 다시 입력해주세요.";
  }

  return null;
}

function setStatus(text, tone) {
  const pill = byId("statusPill");
  pill.textContent = text;
  if (tone === "warn") {
    pill.style.background = "#ffe9d9";
    pill.style.borderColor = "#e5ad8f";
    pill.style.color = "#7f2f15";
    return;
  }

  pill.style.background = "#e5f4ee";
  pill.style.borderColor = "#9fd7c8";
  pill.style.color = "#0c5c4f";
}

function editorElement() {
  return byId("pageText");
}

function noteSurfaceElement() {
  return byId("noteSurface");
}

function canvasElement() {
  return byId("drawCanvas");
}

function canvasContext() {
  return canvasElement().getContext("2d");
}

function getEditorTextFromHtml(html) {
  const container = document.createElement("div");
  container.innerHTML = html;
  return (container.textContent || "").replace(/\u00a0/g, " ");
}

function syncStrokesField() {
  byId("strokesJson").value = JSON.stringify(state.strokes);
}

function markUnsavedChanges() {
  state.hasUnsavedChanges = true;
  scheduleAutoSave();
}

function clearUnsavedChanges() {
  state.hasUnsavedChanges = false;
}

function cancelAutoSave() {
  if (state.autoSaveTimerId !== null) {
    window.clearTimeout(state.autoSaveTimerId);
    state.autoSaveTimerId = null;
  }
}

async function triggerAutoSave() {
  if (!isLoggedIn() || !state.selectedNoteId || !state.hasUnsavedChanges) {
    return;
  }

  if (state.autoSaveInFlight) {
    scheduleAutoSave();
    return;
  }

  state.autoSaveInFlight = true;
  try {
    await syncCurrentDraftSilently();
  } finally {
    state.autoSaveInFlight = false;
    if (state.hasUnsavedChanges) {
      scheduleAutoSave();
    }
  }
}

function scheduleAutoSave() {
  if (!isLoggedIn() || !state.selectedNoteId) {
    return;
  }

  cancelAutoSave();
  state.autoSaveTimerId = window.setTimeout(() => {
    state.autoSaveTimerId = null;
    triggerAutoSave().catch((error) => {
      console.error(error);
    });
  }, AUTO_SAVE_DELAY_MS);
}

function normalizeStroke(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const points = Array.isArray(raw.points)
    ? raw.points
        .map((point) => ({ x: Number(point.x), y: Number(point.y) }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    : [];

  if (points.length < 2) {
    return null;
  }

  const stroke = {
    pageIndex: Number(raw.pageIndex),
    toolType: String(raw.toolType || "pen"),
    color: String(raw.color || "#1b2225"),
    width: Math.max(1, Number(raw.width) || 1),
    points
  };

  if (!Number.isFinite(stroke.pageIndex)) {
    return null;
  }

  return stroke;
}

function resizeCanvas() {
  const surface = noteSurfaceElement();
  const canvas = canvasElement();
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.floor(surface.clientWidth));
  const height = Math.max(1, Math.floor(surface.clientHeight));

  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";

  const ctx = canvasContext();
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  redrawCanvas();
}

function strokeAlpha(stroke) {
  if (stroke.toolType === "marker") {
    return 0.35;
  }

  return 1;
}

function drawStrokeOnContext(ctx, stroke) {
  if (!stroke || stroke.points.length < 2) {
    return;
  }

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = stroke.width;
  ctx.globalAlpha = strokeAlpha(stroke);

  if (stroke.toolType === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = stroke.color;
  }

  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length; i += 1) {
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
  }
  ctx.stroke();
  ctx.restore();
}

function redrawCanvas() {
  const ctx = canvasContext();
  const canvas = canvasElement();
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  const width = canvas.width / ratio;
  const height = canvas.height / ratio;

  ctx.clearRect(0, 0, width, height);

  state.strokes
    .filter((stroke) => stroke.pageIndex === state.selectedPageIndex)
    .forEach((stroke) => drawStrokeOnContext(ctx, stroke));
}

function getCanvasPointFromEvent(event) {
  const rect = canvasElement().getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function currentStrokeType() {
  if (state.drawTool === "marker") {
    return "marker";
  }

  if (state.drawTool === "eraser") {
    return "eraser";
  }

  return "pen";
}

function beginDrawing(event) {
  if (state.editorMode !== "draw") {
    return;
  }

  event.preventDefault();
  const point = getCanvasPointFromEvent(event);
  state.drawingSession = {
    pageIndex: state.selectedPageIndex,
    toolType: currentStrokeType(),
    color: state.drawColor,
    width: state.drawWidth,
    points: [point]
  };

  canvasElement().setPointerCapture(event.pointerId);
}

function continueDrawing(event) {
  if (!state.drawingSession) {
    return;
  }

  event.preventDefault();
  const point = getCanvasPointFromEvent(event);
  state.drawingSession.points.push(point);
  redrawCanvas();
  drawStrokeOnContext(canvasContext(), state.drawingSession);
}

function finishDrawing() {
  if (!state.drawingSession) {
    return;
  }

  if (state.drawingSession.points.length >= 2) {
    state.strokes.push(state.drawingSession);
    syncStrokesField();
    markUnsavedChanges();
  }

  state.drawingSession = null;
  redrawCanvas();
  renderPageTabs();
}

function setEditorMode(mode) {
  state.editorMode = mode;
  const editor = editorElement();
  const canvas = canvasElement();
  const textMode = mode === "text";

  editor.contentEditable = textMode ? "true" : "false";
  editor.classList.toggle("readonly", !textMode);
  editor.style.cursor = textMode ? "text" : "default";
  canvas.style.pointerEvents = textMode ? "none" : "auto";

  byId("btnTextMode").classList.toggle("active", textMode);
  byId("btnDrawMode").classList.toggle("active", !textMode);
  byId("toolSectionText")?.classList.toggle("hidden-section", !textMode);
  byId("toolSectionDraw")?.classList.toggle("hidden-section", textMode);

  if (textMode) {
    editor.focus();
    setStatus("텍스트 모드", "ok");
  } else {
    setStatus("그림 모드", "ok");
  }
}

function setDrawTool(tool) {
  state.drawTool = tool;
  byId("btnPenTool").classList.toggle("active", tool === "pen");
  byId("btnMarkerTool").classList.toggle("active", tool === "marker");
  byId("btnEraserTool").classList.toggle("active", tool === "eraser");
}

function applyDrawColor(color) {
  state.drawColor = color;
  byId("drawColorPicker").value = color;
  document.querySelectorAll(".draw-color-chip").forEach((chip) => {
    const chipColor = chip.getAttribute("data-draw-color") || "";
    chip.classList.toggle("active", chipColor.toLowerCase() === color.toLowerCase());
  });
}

function getSelectionInsideEditor() {
  const editor = editorElement();
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const anchorNode = selection.anchorNode;
  if (!anchorNode || !editor.contains(anchorNode)) {
    return null;
  }

  return range;
}

function focusEditor() {
  if (state.editorMode !== "text") {
    setEditorMode("text");
  }

  editorElement().focus();
}

function applyToAllWhenNoSelection(command, value) {
  const editor = editorElement();
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const hasSelection = getSelectionInsideEditor() && !selection.isCollapsed;
  if (hasSelection) {
    document.execCommand(command, false, value);
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(editor);
  selection.removeAllRanges();
  selection.addRange(range);
  document.execCommand(command, false, value);
  selection.removeAllRanges();
}

function applyEditorCommand(command, value) {
  focusEditor();
  document.execCommand("styleWithCSS", false, "true");
  applyToAllWhenNoSelection(command, value);
  saveCurrentPageDraft();
  markUnsavedChanges();
  renderPageTabs();
  updateToolStats();
}

function updateToolStats() {
  const text = getEditorTextFromHtml(editorElement().innerHTML).trim();
  const chars = text.length;
  const words = text.length === 0 ? 0 : text.split(/\s+/).filter(Boolean).length;
  byId("toolCharCount").textContent = String(chars);
  byId("toolWordCount").textContent = String(words);
}

function insertAtCursor(text) {
  focusEditor();
  document.execCommand("insertText", false, text);
  saveCurrentPageDraft();
  markUnsavedChanges();
  renderPageTabs();
  updateToolStats();
}

function insertHtmlAtCursor(html) {
  focusEditor();
  document.execCommand("insertHTML", false, html);
  saveCurrentPageDraft();
  markUnsavedChanges();
  renderPageTabs();
  updateToolStats();
}

function adjustFontSize(delta) {
  const editor = editorElement();
  const current = Number(editor.dataset.fontSize || "17");
  const next = Math.max(12, Math.min(32, current + delta));
  editor.dataset.fontSize = String(next);
  applyEditorCommand("fontSize", "4");

  editor.querySelectorAll("font[size='4']").forEach((fontElement) => {
    const span = document.createElement("span");
    span.style.fontSize = next + "px";
    span.innerHTML = fontElement.innerHTML;
    fontElement.replaceWith(span);
  });

  byId("fontSizeValue").textContent = String(next);
  saveCurrentPageDraft();
}

function queryFormatBlock() {
  const value = (document.queryCommandValue("formatBlock") || "").toLowerCase();
  return value.replace(/[<>]/g, "");
}

function toggleBlockQuote() {
  const current = queryFormatBlock();
  if (current === "blockquote") {
    applyEditorCommand("formatBlock", "p");
    setStatus("인용 해제", "ok");
    return;
  }

  applyEditorCommand("formatBlock", "blockquote");
  setStatus("인용 적용", "ok");
}

function setAlignment(target) {
  const map = {
    left: "justifyLeft",
    center: "justifyCenter",
    right: "justifyRight"
  };

  const command = map[target] || "justifyLeft";
  if (state.activeAlign === target && target !== "left") {
    applyEditorCommand("justifyLeft");
    state.activeAlign = "left";
    setStatus("정렬 해제(왼쪽 복귀)", "ok");
    return;
  }

  applyEditorCommand(command);
  state.activeAlign = target;
  setStatus("정렬 적용", "ok");
}

function toggleHighlight(color) {
  if (state.activeHighlight === color) {
    applyEditorCommand("hiliteColor", "transparent");
    applyEditorCommand("backColor", "transparent");
    state.activeHighlight = "";
    setStatus("형광펜 해제", "ok");
    return;
  }

  applyEditorCommand("hiliteColor", color);
  applyEditorCommand("backColor", color);
  state.activeHighlight = color;
  setStatus("형광펜 색상 적용", "ok");
}

function applyTextColor() {
  const color = byId("textColorPicker").value || "#0b7a69";
  if (state.activeTextColor === color) {
    applyEditorCommand("foreColor", "#1b2225");
    state.activeTextColor = "";
    setStatus("글자색 해제", "ok");
    return;
  }

  applyEditorCommand("foreColor", color);
  state.activeTextColor = color;
  setStatus("글자색 적용", "ok");
}

function setCurrentNoteLabel() {
  const label = byId("currentNoteLabel");
  const menuLabel = byId("menuCurrentNote");
  const title = byId("title").value.trim();
  if (!state.selectedNoteId) {
    label.textContent = "노트를 선택하세요";
    menuLabel.textContent = "선택 없음";
    return;
  }

  const visible = title ? title : state.selectedNoteId;
  label.textContent = visible;
  menuLabel.textContent = visible;
}

function refreshToolButtonState() {
  const setActive = (id, active) => {
    const element = byId(id);
    if (element) {
      element.classList.toggle("active", Boolean(active));
    }
  };

  setActive("btnBold", document.queryCommandState("bold"));
  setActive("btnItalic", document.queryCommandState("italic"));
  setActive("btnUnderline", document.queryCommandState("underline"));
  setActive("btnQuote", queryFormatBlock() === "blockquote");
  setActive("btnAlignLeft", state.activeAlign === "left");
  setActive("btnAlignCenter", state.activeAlign === "center");
  setActive("btnAlignRight", state.activeAlign === "right");

  document.querySelectorAll(".color-chip").forEach((chip) => {
    const color = chip.getAttribute("data-highlight") || "";
    chip.classList.toggle("active", color === state.activeHighlight);
  });
}

function nextIdempotencyKey(noteId) {
  const storageKey = "sync-seq:" + noteId;
  const current = Number(window.localStorage.getItem(storageKey) || "0");
  const next = current + 1;
  window.localStorage.setItem(storageKey, String(next));
  return noteId + "-" + next;
}

async function request(path, options) {
  const normalized = Object.assign({}, options || {});
  normalized.headers = authHeaders(normalized.headers);

  const response = await fetch(apiUrl(path), normalized);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error((data && data.message) || "요청 실패");
    error.data = data;
    throw error;
  }

  return data;
}

function sortPages(pages) {
  return pages.slice().sort((left, right) => left.pageIndex - right.pageIndex);
}

function saveCurrentPageDraft() {
  const index = state.pages.findIndex((page) => page.pageIndex === state.selectedPageIndex);
  if (index === -1) {
    return;
  }

  state.pages[index] = {
    pageIndex: state.pages[index].pageIndex,
    text: editorElement().innerHTML
  };
}

function renderPageEditor() {
  const selected = state.pages.find((page) => page.pageIndex === state.selectedPageIndex);
  editorElement().innerHTML = selected ? selected.text : "";
  state.findCursor = 0;
  updateToolStats();
  redrawCanvas();
}

function previewText(page) {
  const text = getEditorTextFromHtml(page.text || "").split("\n")[0].trim();
  const strokeCount = state.strokes.filter((stroke) => stroke.pageIndex === page.pageIndex).length;
  const prefix = strokeCount > 0 ? "[그림 " + strokeCount + "] " : "";
  return prefix + (text || "비어있는 페이지");
}

function renderPageTabs() {
  const tabs = byId("pageTabs");
  tabs.innerHTML = "";

  state.pages.forEach((page) => {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML =
      '<span class="tab-title">페이지 ' +
      (page.pageIndex + 1) +
      '</span><span class="tab-preview">' +
      previewText(page).replace(/</g, "&lt;") +
      "</span>";
    button.draggable = true;
    button.dataset.pageIndex = String(page.pageIndex);
    button.classList.toggle("active", page.pageIndex === state.selectedPageIndex);

    button.addEventListener("dragstart", () => {
      saveCurrentPageDraft();
      state.draggingPageIndex = page.pageIndex;
      button.classList.add("dragging");
    });

    button.addEventListener("dragend", () => {
      state.draggingPageIndex = null;
      button.classList.remove("dragging");
      tabs.querySelectorAll("button").forEach((tabButton) => tabButton.classList.remove("drop-target"));
    });

    button.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (state.draggingPageIndex !== null && state.draggingPageIndex !== page.pageIndex) {
        button.classList.add("drop-target");
      }
    });

    button.addEventListener("dragleave", () => {
      button.classList.remove("drop-target");
    });

    button.addEventListener("drop", (event) => {
      event.preventDefault();
      button.classList.remove("drop-target");
      if (state.draggingPageIndex === null || state.draggingPageIndex === page.pageIndex) {
        return;
      }

      reorderPages(state.draggingPageIndex, page.pageIndex);
    });

    button.addEventListener("click", () => {
      saveCurrentPageDraft();
      state.selectedPageIndex = page.pageIndex;
      renderPageTabs();
      renderPageEditor();
    });

    tabs.appendChild(button);
  });
}

function reorderPages(fromPageIndex, toPageIndex) {
  const ordered = sortPages(state.pages);
  const fromPosition = ordered.findIndex((page) => page.pageIndex === fromPageIndex);
  const toPosition = ordered.findIndex((page) => page.pageIndex === toPageIndex);
  if (fromPosition === -1 || toPosition === -1 || fromPosition === toPosition) {
    return;
  }

  const [moved] = ordered.splice(fromPosition, 1);
  ordered.splice(toPosition, 0, moved);
  const mapped = new Map();
  ordered.forEach((page, index) => mapped.set(page.pageIndex, index));

  state.strokes = state.strokes.map((stroke) => ({ ...stroke, pageIndex: mapped.get(stroke.pageIndex) ?? 0 }));
  state.pages = ordered.map((page, index) => ({ pageIndex: index, text: page.text }));
  state.selectedPageIndex = toPosition;
  syncStrokesField();
  renderPageTabs();
  renderPageEditor();
  setStatus("페이지 순서 변경 완료", "ok");
}

function setPages(pages) {
  const sorted = sortPages(pages);
  state.pages = sorted.length > 0 ? sorted : [{ pageIndex: 0, text: "" }];
  if (!state.pages.some((page) => page.pageIndex === state.selectedPageIndex)) {
    state.selectedPageIndex = state.pages[0].pageIndex;
  }

  renderPageTabs();
  renderPageEditor();
}

function addPage() {
  saveCurrentPageDraft();
  const maxPageIndex = state.pages.reduce((max, page) => (page.pageIndex > max ? page.pageIndex : max), -1);
  state.pages.push({ pageIndex: maxPageIndex + 1, text: "" });
  markUnsavedChanges();
  state.selectedPageIndex = maxPageIndex + 1;
  setPages(state.pages);
  setStatus("페이지 추가 완료", "ok");
}

function deleteCurrentPage() {
  if (state.pages.length <= 1) {
    setStatus("최소 1개 페이지는 유지해야 합니다", "warn");
    return;
  }

  const removed = state.selectedPageIndex;
  markUnsavedChanges();
  state.pages = state.pages.filter((page) => page.pageIndex !== removed);
  state.strokes = state.strokes
    .filter((stroke) => stroke.pageIndex !== removed)
    .map((stroke) => ({ ...stroke, pageIndex: stroke.pageIndex > removed ? stroke.pageIndex - 1 : stroke.pageIndex }));

  const reindexed = sortPages(state.pages).map((page, index) => ({ pageIndex: index, text: page.text }));
  state.selectedPageIndex = 0;
  syncStrokesField();
  setPages(reindexed);
  setStatus("페이지 삭제 완료", "ok");
}

function duplicateCurrentPage() {
  const current = state.pages.find((page) => page.pageIndex === state.selectedPageIndex);
  if (!current) {
    return;
  }

  const sourceIndex = state.selectedPageIndex;
  const insertAt = sourceIndex + 1;
  const ordered = sortPages(state.pages);
  ordered.splice(insertAt, 0, { pageIndex: -1, text: current.text });

  const reindexedPages = ordered.map((page, index) => ({ pageIndex: index, text: page.text }));

  const shiftedStrokes = state.strokes.map((stroke) => ({
    ...stroke,
    pageIndex: stroke.pageIndex > sourceIndex ? stroke.pageIndex + 1 : stroke.pageIndex,
    points: stroke.points.map((point) => ({ ...point }))
  }));

  const copiedStrokes = state.strokes
    .filter((stroke) => stroke.pageIndex === sourceIndex)
    .map((stroke) => ({
      ...stroke,
      pageIndex: insertAt,
      points: stroke.points.map((point) => ({ ...point }))
    }));

  state.pages = reindexedPages;
  state.strokes = shiftedStrokes.concat(copiedStrokes);
  markUnsavedChanges();
  state.selectedPageIndex = insertAt;
  syncStrokesField();
  renderPageTabs();
  renderPageEditor();
  setStatus("페이지 복제 완료", "ok");
}

function removeCurrentPageDrawings() {
  markUnsavedChanges();
  state.strokes = state.strokes.filter((stroke) => stroke.pageIndex !== state.selectedPageIndex);
  syncStrokesField();
  redrawCanvas();
  renderPageTabs();
  setStatus("현재 페이지 그림 삭제", "ok");
}

function renderNotes() {
  const list = byId("notesList");
  list.innerHTML = "";

  if (state.notes.length === 0) {
    const li = document.createElement("li");
    li.textContent = "노트가 없습니다. 새 노트를 생성하세요.";
    list.appendChild(li);
    return;
  }

  state.notes.forEach((note) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = note.title + " (v" + note.version + ")";
    button.classList.toggle("active", note.id === state.selectedNoteId);
    button.addEventListener("click", () => selectNote(note));
    li.appendChild(button);
    list.appendChild(li);
  });
}

async function loadNoteContent(noteId) {
  const [pages, strokes] = await Promise.all([
    request("/notes/pages?noteId=" + encodeURIComponent(noteId), { method: "GET" }),
    request("/notes/strokes?noteId=" + encodeURIComponent(noteId), { method: "GET" })
  ]);

  setPages(Array.isArray(pages) ? pages : [{ pageIndex: 0, text: "" }]);
  state.strokes = (Array.isArray(strokes) ? strokes : []).map(normalizeStroke).filter(Boolean);
  syncStrokesField();
  clearUnsavedChanges();
  redrawCanvas();
}

async function loadNotes() {
  requireLogin();
  const notes = await request("/notes", { method: "GET" });
  state.notes = Array.isArray(notes) ? notes : [];
  renderNotes();

  if (state.notes.length === 0) {
    const created = await request("/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "note-" + Date.now(), title: "첫 노트" })
    });

    state.notes = [created];
    renderNotes();
    await selectNote(created);
    setStatus("첫 노트를 자동으로 생성했습니다.", "ok");
    return;
  }

  if (!state.selectedNoteId && state.notes.length > 0) {
    await selectNote(state.notes[0]);
  }
}

async function selectNote(note) {
  requireLogin();
  state.selectedNoteId = note.id;
  byId("noteId").value = note.id;
  byId("title").value = note.title;
  byId("expectedVersion").value = String(note.version);
  setCurrentNoteLabel();
  renderNotes();
  await loadNoteContent(note.id);
  setStatus("노트 로드 완료", "ok");
}

async function createNote() {
  requireLogin();
  const title = byId("newTitle").value.trim() || "새 노트";
  const noteId = "note-" + Date.now();
  const data = await request("/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: noteId, title })
  });

  await loadNotes();
  await selectNote(data);
  setStatus("노트 생성 완료", "ok");
}

async function renameNote() {
  requireLogin();
  const f = fields();
  if (!f.noteId) {
    throw new Error("먼저 노트를 선택하세요.");
  }

  const data = await request("/notes/rename", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ noteId: f.noteId, title: f.title, expectedVersion: f.expectedVersion })
  });

  byId("expectedVersion").value = String(data.version);
  setCurrentNoteLabel();
  await loadNotes();
  setStatus("제목 변경 완료", "ok");
}

async function syncNote() {
  requireLogin();
  cancelAutoSave();
  const f = fields();
  if (!f.noteId) {
    throw new Error("먼저 노트를 선택하세요.");
  }

  saveCurrentPageDraft();
  syncStrokesField();

  const data = await request("/api/notebooks/" + encodeURIComponent(f.noteId) + "/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": nextIdempotencyKey(f.noteId)
    },
    body: JSON.stringify({
      expectedVersion: f.expectedVersion,
      pages: sortPages(state.pages),
      strokes: state.strokes
    })
  }).catch((error) => {
    const payload = error.data;
    if (payload && payload.status === "conflict") {
      if (typeof payload.serverVersion === "number") {
        byId("expectedVersion").value = String(payload.serverVersion);
      }

      setStatus("충돌 발생: 서버 버전으로 갱신 후 다시 저장하세요", "warn");
      return null;
    }

    throw error;
  });

  if (!data) {
    return;
  }

  if (typeof data.noteVersion === "number") {
    byId("expectedVersion").value = String(data.noteVersion);
  }

  await loadNotes();
  clearUnsavedChanges();
  setStatus("동기화 저장 완료", "ok");
}

async function syncCurrentDraftSilently() {
  if (!state.authUser || !state.selectedNoteId || !state.hasUnsavedChanges) {
    return true;
  }

  const f = fields();
  if (!f.noteId) {
    return true;
  }

  saveCurrentPageDraft();
  syncStrokesField();

  try {
    const data = await request("/api/notebooks/" + encodeURIComponent(f.noteId) + "/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": nextIdempotencyKey(f.noteId)
      },
      body: JSON.stringify({
        expectedVersion: f.expectedVersion,
        pages: sortPages(state.pages),
        strokes: state.strokes
      })
    });

    if (typeof data.noteVersion === "number") {
      byId("expectedVersion").value = String(data.noteVersion);
    }

    clearUnsavedChanges();
    return true;
  } catch (error) {
    console.error(error);
    setStatus("계정 전환 전 자동 저장에 실패했습니다. 동기화 저장 버튼을 눌러주세요.", "warn");
    return false;
  }
}

async function exportPdf() {
  requireLogin();
  const f = fields();
  if (!f.noteId) {
    throw new Error("먼저 노트를 선택하세요.");
  }

  await request("/notes/" + encodeURIComponent(f.noteId) + "/export/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });

  setStatus("PDF 생성 완료", "ok");
}

async function authRequest(path) {
  const username = byId("authUsername").value.trim();
  const password = byId("authPassword").value;
  return authRequestWithCredentials(path, { username, password });
}

async function authRequestWithCredentials(path, credentials) {
  const username = (credentials?.username || "").trim();
  const password = credentials?.password || "";
  if (!username || !password) {
    throw new Error("아이디/비밀번호를 입력하세요.");
  }

  if (path === "/auth/signup") {
    const validationMessage = validateSignupPassword(password);
    if (validationMessage) {
      setAuthMessage(validationMessage, "warn");
      throw new Error(validationMessage);
    }
  }

  const switchingAccount = Boolean(state.authUser && state.authUser.username !== username);
  if (switchingAccount) {
    cancelAutoSave();
    await syncCurrentDraftSilently();
  }

  const data = await request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  state.authToken = data.token;
  state.authUser = data.user;
  state.selectedNoteId = "";
  state.notes = [];
  state.pages = [{ pageIndex: 0, text: "" }];
  state.strokes = [];
  clearUnsavedChanges();
  byId("noteId").value = "";
  byId("title").value = "";
  window.localStorage.setItem("auth-token", state.authToken);
  byId("authPassword").value = "";
  setAuthUserLabel();
  setPages(state.pages);
  syncStrokesField();
  await loadNotes();
  return data;
}

async function enterQuickAccount(username) {
  const credentials = { username, password: QUICK_ACCOUNT_PASSWORD };
  setAuthMessage(username + " 계정으로 진입 중...", "ok");

  byId("authUsername").value = username;
  byId("authPassword").value = QUICK_ACCOUNT_PASSWORD;

  try {
    const result = await authRequestWithCredentials("/auth/login", credentials);
    setAuthMessage("로그인 완료: " + result.user.username + " (계정별 노트 분리 저장)", "ok");
    setStatus(result.user.username + " 계정 로그인", "ok");
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : "로그인 실패";

    if (message !== "invalid credentials") {
      setAuthMessage(message, "warn");
      throw error;
    }
  }

  const signupResult = await authRequestWithCredentials("/auth/signup", credentials);
  setAuthMessage("회원가입 후 로그인 완료: " + signupResult.user.username + " (계정별 노트 분리 저장)", "ok");
  setStatus(signupResult.user.username + " 계정 생성 및 로그인", "ok");
}

async function signup() {
  try {
    const result = await authRequest("/auth/signup");
    setAuthMessage("회원가입 완료: " + result.user.username + " 계정으로 로그인되었습니다.", "ok");
    setStatus("회원가입 및 로그인 완료", "ok");
  } catch (error) {
    const message = error instanceof Error ? error.message : "회원가입 실패";
    setAuthMessage(message || "비밀번호가 적절하지 않습니다. 다시 입력해주세요.", "warn");
    throw error;
  }
}

async function login() {
  try {
    const result = await authRequest("/auth/login");
    setAuthMessage("로그인 완료: " + result.user.username, "ok");
    setStatus("로그인 완료", "ok");
  } catch (error) {
    const message = error instanceof Error ? error.message : "로그인 실패";
    setAuthMessage(message || "로그인에 실패했습니다. 아이디/비밀번호를 다시 확인해주세요.", "warn");
    throw error;
  }
}

async function logout() {
  cancelAutoSave();
  await syncCurrentDraftSilently();

  if (state.authToken) {
    await request("/auth/logout", { method: "POST" });
  }

  state.authToken = "";
  state.authUser = null;
  window.localStorage.removeItem("auth-token");
  state.notes = [];
  state.strokes = [];
  state.selectedNoteId = "";
  clearUnsavedChanges();
  renderNotes();
  setPages([{ pageIndex: 0, text: "" }]);
  syncStrokesField();
  setCurrentNoteLabel();
  setAuthUserLabel();
  setAuthMessage("로그아웃 되었습니다.", "ok");
  redrawCanvas();
  setStatus("로그아웃 완료", "ok");
}

async function tryRestoreSession() {
  if (!state.authToken) {
    setAuthUserLabel();
    return;
  }

  try {
    const me = await request("/auth/me", { method: "GET" });
    state.authUser = { id: me.userId, username: me.username };
    setAuthUserLabel();
    await loadNotes();
  } catch {
    state.authToken = "";
    state.authUser = null;
    window.localStorage.removeItem("auth-token");
    setAuthUserLabel();
  }
}

function wire(id, fn) {
  const element = byId(id);
  if (!element) {
    return;
  }

  element.addEventListener("click", async () => {
    try {
      await fn();
    } catch (error) {
      const message = error instanceof Error ? error.message : "요청 실패";
      setStatus(message || "요청 실패", "warn");
      console.error(error);
    }
  });
}

function openMenu() {
  closeTools();
  byId("menuDrawer").classList.add("open");
  byId("menuBackdrop").classList.add("open");
  byId("menuDrawer").setAttribute("aria-hidden", "false");
  byId("btnMenu").setAttribute("aria-expanded", "true");
}

function closeMenu() {
  byId("menuDrawer").classList.remove("open");
  byId("menuBackdrop").classList.remove("open");
  byId("menuDrawer").setAttribute("aria-hidden", "true");
  byId("btnMenu").setAttribute("aria-expanded", "false");
}

function openTools() {
  closeMenu();
  byId("btnTools").classList.add("is-hidden");
  byId("toolsDrawer").classList.add("open");
  byId("toolsBackdrop").classList.add("open");
  byId("toolsDrawer").setAttribute("aria-hidden", "false");
  byId("btnTools").setAttribute("aria-expanded", "true");
}

function closeTools() {
  byId("btnTools").classList.remove("is-hidden");
  byId("toolsDrawer").classList.remove("open");
  byId("toolsBackdrop").classList.remove("open");
  byId("toolsDrawer").setAttribute("aria-hidden", "true");
  byId("btnTools").setAttribute("aria-expanded", "false");
}

function setSelectionByOffsets(start, end) {
  const editor = editorElement();
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let node;
  let currentOffset = 0;
  let startNode = null;
  let startOffset = 0;
  let endNode = null;
  let endOffset = 0;

  while ((node = walker.nextNode())) {
    const nextOffset = currentOffset + node.textContent.length;
    if (!startNode && start >= currentOffset && start <= nextOffset) {
      startNode = node;
      startOffset = start - currentOffset;
    }
    if (!endNode && end >= currentOffset && end <= nextOffset) {
      endNode = node;
      endOffset = end - currentOffset;
      break;
    }
    currentOffset = nextOffset;
  }

  if (!startNode || !endNode) {
    return false;
  }

  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  const selection = window.getSelection();
  if (!selection) {
    return false;
  }

  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

function findNextInEditor() {
  focusEditor();
  const query = byId("toolFindQuery").value.trim();
  if (!query) {
    setStatus("찾을 텍스트를 입력하세요", "warn");
    return;
  }

  const text = getEditorTextFromHtml(editorElement().innerHTML);
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();

  let startIndex = lower.indexOf(needle, state.findCursor);
  if (startIndex === -1) {
    startIndex = lower.indexOf(needle, 0);
  }
  if (startIndex === -1) {
    setStatus("찾는 텍스트가 없습니다", "warn");
    return;
  }

  const endIndex = startIndex + needle.length;
  if (!setSelectionByOffsets(startIndex, endIndex)) {
    setStatus("찾기 위치를 선택할 수 없습니다", "warn");
    return;
  }

  state.findCursor = endIndex;
  setStatus("텍스트 찾기 완료", "ok");
}

function initEvents() {
  wire("btnCreate", createNote);
  wire("btnLoadNotes", loadNotes);
  wire("btnRename", renameNote);
  wire("btnSync", syncNote);
  wire("btnExport", exportPdf);
  wire("btnAddPage", async () => addPage());
  wire("btnToolAddPage", async () => addPage());
  wire("btnToolDeletePage", async () => deleteCurrentPage());
  wire("btnDeletePage", async () => deleteCurrentPage());
  wire("btnDuplicatePage", async () => duplicateCurrentPage());
  wire("btnSignup", signup);
  wire("btnLogin", login);
  wire("btnLogout", logout);
  wire("btnLogoutQuick", logout);
  wire("btnQuickUser1", async () => enterQuickAccount("user1"));
  wire("btnQuickUser2", async () => enterQuickAccount("user2"));
  wire("btnQuickUser3", async () => enterQuickAccount("user3"));

  byId("btnMenu").addEventListener("click", () => {
    if (byId("btnMenu").getAttribute("aria-expanded") === "true") {
      closeMenu();
      return;
    }

    openMenu();
  });

  byId("btnCloseMenu").addEventListener("click", closeMenu);
  byId("menuBackdrop").addEventListener("click", closeMenu);

  byId("btnTools").addEventListener("click", () => {
    if (byId("btnTools").getAttribute("aria-expanded") === "true") {
      closeTools();
      return;
    }

    openTools();
  });

  byId("btnCloseTools").addEventListener("click", closeTools);
  byId("toolsBackdrop").addEventListener("click", closeTools);

  byId("btnTextMode").addEventListener("click", () => setEditorMode("text"));
  byId("btnDrawMode").addEventListener("click", () => setEditorMode("draw"));

  byId("btnPenTool").addEventListener("click", () => setDrawTool("pen"));
  byId("btnMarkerTool").addEventListener("click", () => setDrawTool("marker"));
  byId("btnEraserTool").addEventListener("click", () => setDrawTool("eraser"));
  byId("btnClearDrawing").addEventListener("click", removeCurrentPageDrawings);

  byId("drawColorPicker").addEventListener("input", () => {
    applyDrawColor(byId("drawColorPicker").value);
  });

  document.querySelectorAll(".draw-color-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const color = chip.getAttribute("data-draw-color") || "#1b2225";
      applyDrawColor(color);
      setStatus("그림 색상 변경", "ok");
    });
  });

  byId("drawWidthRange").addEventListener("input", () => {
    state.drawWidth = Number(byId("drawWidthRange").value);
    byId("drawWidthValue").textContent = String(state.drawWidth);
  });

  byId("btnInsertTemplate").addEventListener("click", () => {
    insertAtCursor("새 텍스트 블록\n");
    setStatus("텍스트 추가 완료", "ok");
  });

  byId("btnInsertChecklist").addEventListener("click", () => {
    insertAtCursor("[ ] 할 일\n");
    setStatus("체크리스트 추가", "ok");
  });

  byId("btnInsertBullet").addEventListener("click", () => {
    insertAtCursor("- 목록 항목\n");
    setStatus("불릿 목록 추가", "ok");
  });

  byId("btnInsertDivider").addEventListener("click", () => {
    insertHtmlAtCursor('<hr style="border:0;border-top:1px solid #d7c8a9;margin:10px 0;"/>');
    setStatus("구분선 추가", "ok");
  });

  byId("btnInsertDate").addEventListener("click", () => {
    insertAtCursor(new Date().toLocaleString("ko-KR") + "\n");
    setStatus("날짜 삽입 완료", "ok");
  });

  byId("btnBold").addEventListener("click", () => {
    applyEditorCommand("bold");
    setStatus(document.queryCommandState("bold") ? "굵게 적용" : "굵게 해제", "ok");
    refreshToolButtonState();
  });

  byId("btnItalic").addEventListener("click", () => {
    applyEditorCommand("italic");
    setStatus(document.queryCommandState("italic") ? "기울임 적용" : "기울임 해제", "ok");
    refreshToolButtonState();
  });

  byId("btnUnderline").addEventListener("click", () => {
    applyEditorCommand("underline");
    setStatus(document.queryCommandState("underline") ? "밑줄 적용" : "밑줄 해제", "ok");
    refreshToolButtonState();
  });

  byId("btnFontInc").addEventListener("click", () => {
    adjustFontSize(1);
    setStatus("글자 크기 증가", "ok");
  });

  byId("btnFontDec").addEventListener("click", () => {
    adjustFontSize(-1);
    setStatus("글자 크기 감소", "ok");
  });

  byId("btnApplyTextColor").addEventListener("click", () => {
    applyTextColor();
    refreshToolButtonState();
  });

  document.querySelectorAll(".color-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      toggleHighlight(chip.getAttribute("data-highlight") || "#fff59d");
      refreshToolButtonState();
    });
  });

  byId("btnAlignLeft").addEventListener("click", () => {
    setAlignment("left");
    refreshToolButtonState();
  });
  byId("btnAlignCenter").addEventListener("click", () => {
    setAlignment("center");
    refreshToolButtonState();
  });
  byId("btnAlignRight").addEventListener("click", () => {
    setAlignment("right");
    refreshToolButtonState();
  });

  byId("btnQuote").addEventListener("click", () => {
    toggleBlockQuote();
    refreshToolButtonState();
  });

  byId("btnClearFormat").addEventListener("click", () => {
    applyEditorCommand("removeFormat");
    setStatus("서식 제거", "ok");
  });

  byId("btnUndo").addEventListener("click", () => {
    if (state.editorMode === "draw") {
      for (let i = state.strokes.length - 1; i >= 0; i -= 1) {
        if (state.strokes[i].pageIndex === state.selectedPageIndex) {
          state.strokes.splice(i, 1);
          syncStrokesField();
          redrawCanvas();
          renderPageTabs();
          setStatus("마지막 그림 선 실행취소", "ok");
          return;
        }
      }
      setStatus("되돌릴 그림 선이 없습니다", "warn");
      return;
    }

    applyEditorCommand("undo");
    setStatus("실행취소", "ok");
  });

  byId("btnRedo").addEventListener("click", () => {
    applyEditorCommand("redo");
    setStatus("다시실행", "ok");
  });

  byId("btnFindNext").addEventListener("click", findNextInEditor);

  byId("title").addEventListener("input", setCurrentNoteLabel);

  byId("pageText").addEventListener("input", () => {
    saveCurrentPageDraft();
    markUnsavedChanges();
    renderPageTabs();
    updateToolStats();
    refreshToolButtonState();
  });

  window.addEventListener("resize", resizeCanvas);

  canvasElement().addEventListener("pointerdown", beginDrawing);
  canvasElement().addEventListener("pointermove", continueDrawing);
  canvasElement().addEventListener("pointerup", finishDrawing);
  canvasElement().addEventListener("pointerleave", finishDrawing);
  canvasElement().addEventListener("pointercancel", finishDrawing);

  document.addEventListener("selectionchange", () => {
    const editor = editorElement();
    const selection = window.getSelection();
    if (!selection || !selection.anchorNode || !editor.contains(selection.anchorNode)) {
      return;
    }

    refreshToolButtonState();
  });
}

function bootstrap() {
  setPages([{ pageIndex: 0, text: "" }]);
  syncStrokesField();
  setCurrentNoteLabel();
  editorElement().dataset.fontSize = "17";
  byId("fontSizeValue").textContent = "17";
  setDrawTool("pen");
  applyDrawColor(state.drawColor);
  setEditorMode("text");
  setAuthMessage("로그인 후 계정별 노트가 저장됩니다.", "ok");
  updateToolStats();
  refreshToolButtonState();
  initEvents();
  resizeCanvas();

  tryRestoreSession().catch((error) => {
    console.error(error);
    setStatus("세션 복구 실패", "warn");
  });
}

bootstrap();
