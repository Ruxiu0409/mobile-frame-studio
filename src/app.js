import {
  FRAME_PRESETS,
  PHOTO_ACCEPT_VALUE,
  fitRect,
  isHeicPhotoFile,
  isSupportedPhotoFile,
  normalizeTransform,
} from "./frame-core.js";

const HEIC_CONVERTER_URL = "assets/vendor/heic2any.min.js";

const canvas = document.querySelector("#previewCanvas");
const ctx = canvas.getContext("2d", { alpha: false });
const appShell = document.querySelector(".app-shell");
const panels = document.querySelectorAll("[data-step-panel]");
const backButton = document.querySelector("#backButton");
const startButton = document.querySelector("#startButton");
const photoInput = document.querySelector("#photoInput");
const replacePhotoButton = document.querySelector("#replacePhotoButton");
const fileName = document.querySelector("#fileName");
const frameList = document.querySelector("#frameList");
const previewCards = document.querySelectorAll(".photo-workspace, .final-preview");
const renderedPreviews = document.querySelectorAll(".rendered-preview");
const autoToneToggle = document.querySelector("#autoToneToggle");
const zoomRange = document.querySelector("#zoomRange");
const resetButton = document.querySelector("#resetButton");
const toFrameButton = document.querySelector("#toFrameButton");
const shareButton = document.querySelector("#shareButton");
const makeAnotherButton = document.querySelector("#makeAnotherButton");
const statusMessage = document.querySelector("#statusMessage");

photoInput.accept = PHOTO_ACCEPT_VALUE;

const state = {
  frame: FRAME_PRESETS[0],
  frameConfirmed: false,
  photo: null,
  photoName: "",
  step: 1,
  autoTone: true,
  transform: {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  },
};

const frameCache = new Map();
const framePreviewCache = new Map();
const activePointers = new Map();
let dragStart = null;
let pinchStart = null;
let renderFrame = 0;
let heicConverterPromise = null;

function setStatus(message, { persistent = false } = {}) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("is-visible", Boolean(state.photo) || persistent);
}

function setControlsEnabled() {
  const hasPhoto = Boolean(state.photo);
  const canExport = hasPhoto && state.frameConfirmed;

  appShell.classList.toggle("has-photo", hasPhoto);
  toFrameButton.disabled = !hasPhoto;
  shareButton.disabled = !canExport;
  resetButton.disabled = !hasPhoto;
  zoomRange.disabled = !hasPhoto;
}

function syncPreviewAspect() {
  const aspect = `${state.frame.width} / ${state.frame.height}`;
  previewCards.forEach((card) => {
    card.style.setProperty("--preview-aspect", aspect);
  });
  canvas.style.setProperty("--preview-aspect", aspect);
}

function setStep(step) {
  let nextStep = Math.min(Math.max(step, 1), 4);

  if (nextStep > 2 && !state.photo) {
    nextStep = 2;
  }

  if (nextStep === 4 && !state.frameConfirmed) {
    nextStep = 3;
  }

  state.step = nextStep;
  appShell.dataset.step = String(nextStep);
  backButton.disabled = nextStep === 1;

  panels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.stepPanel === String(nextStep));
  });

  if (nextStep === 2 && state.photo) {
    setStatus("已套用照片，可拖曳預覽調整位置。");
  } else if (nextStep === 2) {
    setStatus("上傳照片開始製作。");
  } else if (nextStep === 3) {
    setStatus("點選相框後會進入完成分享。");
    renderFrameOptions();
  } else if (nextStep === 4) {
    setStatus("相框已套用，可以分享。");
  }

  setControlsEnabled();
  scheduleRender();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function createIconText(frame) {
  return `${frame.width} x ${frame.height} PNG`;
}

function renderFrameOptions() {
  frameList.innerHTML = "";

  FRAME_PRESETS.forEach((frame) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "frame-option";
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(frame.id === state.frame.id));
    option.style.setProperty("--preview-aspect", `${frame.width} / ${frame.height}`);
    option.innerHTML = `
      <img class="frame-option-preview" src="${frame.src}" alt="" loading="lazy" />
      <span class="frame-option-meta">
        <strong>${frame.name}</strong>
        <small>${createIconText(frame)}</small>
      </span>
    `;
    option.addEventListener("click", () => {
      state.frame = frame;
      state.frameConfirmed = true;
      canvas.width = frame.width;
      canvas.height = frame.height;
      syncPreviewAspect();
      normalizeCurrentTransform();
      renderFrameOptions();
      scheduleRender();
      setStep(4);
    });
    frameList.append(option);
    updateFrameOptionPreview(option, frame);
  });
}

async function updateFrameOptionPreview(option, frame) {
  if (!state.photo) {
    return;
  }

  const preview = option.querySelector(".frame-option-preview");
  preview.src = await getFramePreview(frame);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function loadHeicConverter() {
  if (window.heic2any) {
    return Promise.resolve(window.heic2any);
  }

  if (!heicConverterPromise) {
    heicConverterPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = HEIC_CONVERTER_URL;
      script.async = true;
      script.onload = () => {
        if (window.heic2any) {
          resolve(window.heic2any);
        } else {
          reject(new Error("HEIC converter did not initialize"));
        }
      };
      script.onerror = () => reject(new Error("HEIC converter failed to load"));
      document.head.append(script);
    });
  }

  return heicConverterPromise.catch((error) => {
    heicConverterPromise = null;
    throw error;
  });
}

async function convertHeicToRaster(file) {
  const heic2any = await loadHeicConverter();
  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.95,
  });

  return Array.isArray(converted) ? converted[0] : converted;
}

async function loadRasterPhoto(file) {
  const objectUrl = URL.createObjectURL(file);

  try {
    if ("createImageBitmap" in window) {
      try {
        const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
        URL.revokeObjectURL(objectUrl);
        return bitmap;
      } catch {
        // Safari support varies for createImageBitmap options; the image path below is reliable.
      }
    }

    const image = await loadImage(objectUrl);
    URL.revokeObjectURL(objectUrl);
    return image;
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function loadPhoto(file) {
  if (!isHeicPhotoFile(file)) {
    return loadRasterPhoto(file);
  }

  try {
    return await loadRasterPhoto(file);
  } catch {
    setStatus("HEIC 照片轉換中...", { persistent: true });
    const rasterBlob = await convertHeicToRaster(file);
    return loadRasterPhoto(rasterBlob);
  }
}

function createFrameOverlay(image, width, height) {
  const overlay = document.createElement("canvas");
  overlay.width = width;
  overlay.height = height;

  const overlayCtx = overlay.getContext("2d");
  overlayCtx.drawImage(image, 0, 0, width, height);
  return overlay;
}

async function getFrameAsset(frame) {
  if (!frameCache.has(frame.id)) {
    const image = await loadImage(frame.src);
    frameCache.set(frame.id, {
      image,
      overlay: createFrameOverlay(image, frame.width, frame.height),
    });
  }

  return frameCache.get(frame.id);
}

async function getFramePreview(frame) {
  const cacheKey = [
    frame.id,
    state.photoName,
    state.autoTone,
    state.transform.scale.toFixed(3),
    Math.round(state.transform.offsetX),
    Math.round(state.transform.offsetY),
  ].join(":");

  if (!framePreviewCache.has(cacheKey)) {
    framePreviewCache.set(cacheKey, createFramePreview(frame));
  }

  return framePreviewCache.get(cacheKey);
}

async function createFramePreview(frame) {
  const frameAsset = await getFrameAsset(frame);
  const previewWidth = 900;
  const previewHeight = Math.round(previewWidth * (frame.height / frame.width));
  const previewCanvas = document.createElement("canvas");
  previewCanvas.width = previewWidth;
  previewCanvas.height = previewHeight;

  const previewCtx = previewCanvas.getContext("2d");
  drawPaperBackground(previewCtx, previewWidth, previewHeight);

  if (state.photo) {
    const transform = normalizeTransform({
      imageWidth: state.photo.width,
      imageHeight: state.photo.height,
      canvasWidth: frame.width,
      canvasHeight: frame.height,
      scale: state.transform.scale,
      offsetX: state.transform.offsetX,
      offsetY: state.transform.offsetY,
    });
    const rect = fitRect(
      state.photo.width,
      state.photo.height,
      frame.width,
      frame.height,
      transform.scale,
      transform.offsetX,
      transform.offsetY,
    );
    const scaleX = previewWidth / frame.width;
    const scaleY = previewHeight / frame.height;

    previewCtx.save();
    previewCtx.filter = state.autoTone ? "brightness(1.035) contrast(1.08) saturate(1.16)" : "none";
    previewCtx.drawImage(
      state.photo,
      rect.x * scaleX,
      rect.y * scaleY,
      rect.width * scaleX,
      rect.height * scaleY,
    );
    previewCtx.restore();

    if (state.autoTone) {
      drawToneVignette(previewCtx, previewWidth, previewHeight);
    }
  }

  previewCtx.drawImage(frameAsset.overlay, 0, 0, previewWidth, previewHeight);
  return previewCanvas.toDataURL("image/png");
}

function normalizeCurrentTransform() {
  if (!state.photo) {
    state.transform = { scale: 1, offsetX: 0, offsetY: 0 };
    zoomRange.value = "1";
    return;
  }

  state.transform = normalizeTransform({
    imageWidth: state.photo.width,
    imageHeight: state.photo.height,
    canvasWidth: state.frame.width,
    canvasHeight: state.frame.height,
    scale: state.transform.scale,
    offsetX: state.transform.offsetX,
    offsetY: state.transform.offsetY,
  });
  zoomRange.value = String(state.transform.scale);
}

function drawEmptyState() {
  drawPaperBackground(ctx, state.frame.width, state.frame.height);

  ctx.fillStyle = "rgba(75, 54, 18, 0.72)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 86px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("上傳照片開始製作", state.frame.width / 2, state.frame.height / 2);
}

function drawPaperBackground(targetCtx, width, height) {
  const gradient = targetCtx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#fffaf0");
  gradient.addColorStop(1, "#f0e3ca");
  targetCtx.fillStyle = gradient;
  targetCtx.fillRect(0, 0, width, height);
}

function drawPhoto() {
  drawPaperBackground(ctx, state.frame.width, state.frame.height);

  const rect = fitRect(
    state.photo.width,
    state.photo.height,
    state.frame.width,
    state.frame.height,
    state.transform.scale,
    state.transform.offsetX,
    state.transform.offsetY,
  );

  ctx.save();
  ctx.filter = state.autoTone ? "brightness(1.035) contrast(1.08) saturate(1.16)" : "none";
  ctx.drawImage(state.photo, rect.x, rect.y, rect.width, rect.height);
  ctx.restore();

  if (state.autoTone) {
    drawToneVignette(ctx, state.frame.width, state.frame.height);
  }
}

function drawToneVignette(targetCtx, width, height) {
  const vignette = targetCtx.createRadialGradient(
    width / 2,
    height / 2,
    width * 0.18,
    width / 2,
    height / 2,
    width * 0.72,
  );
  vignette.addColorStop(0, "rgba(255, 245, 219, 0.04)");
  vignette.addColorStop(1, "rgba(32, 19, 3, 0.16)");
  targetCtx.fillStyle = vignette;
  targetCtx.fillRect(0, 0, width, height);
}

async function render() {
  const token = ++renderFrame;
  const frameAsset = await getFrameAsset(state.frame);

  if (token !== renderFrame) {
    return;
  }

  ctx.clearRect(0, 0, state.frame.width, state.frame.height);

  if (state.photo) {
    drawPhoto();
  } else {
    drawEmptyState();
  }

  if (state.step >= 3) {
    ctx.drawImage(frameAsset.overlay, 0, 0, state.frame.width, state.frame.height);
  }

  syncRenderedPreviews();
}

function syncRenderedPreviews() {
  if (state.step < 3) {
    return;
  }

  const dataUrl = canvas.toDataURL("image/png");
  renderedPreviews.forEach((preview) => {
    preview.src = dataUrl;
  });
}

function scheduleRender() {
  window.requestAnimationFrame(() => {
    render().catch(() => {
      setStatus("相框載入失敗，請重新整理頁面。", { persistent: true });
    });
  });
}

function updatePhotoUi() {
  const hasPhoto = Boolean(state.photo);
  fileName.textContent = hasPhoto ? state.photoName : "尚未選擇照片";
  setControlsEnabled();
}

async function handlePhotoChange(event) {
  const [file] = event.target.files;

  if (!file) {
    return;
  }

  if (!isSupportedPhotoFile(file)) {
    setStatus("請選擇 HEIC、PNG 或 JPG 照片。", { persistent: true });
    photoInput.value = "";
    return;
  }

  setStatus(isHeicPhotoFile(file) ? "HEIC 照片載入中..." : "照片載入中...", { persistent: true });

  try {
    if (state.photo && typeof state.photo.close === "function") {
      state.photo.close();
    }

    state.photo = await loadPhoto(file);
    state.photoName = file.name;
    state.frameConfirmed = false;
    framePreviewCache.clear();
    state.transform = { scale: 1, offsetX: 0, offsetY: 0 };
    normalizeCurrentTransform();
    updatePhotoUi();
    renderFrameOptions();
    setStatus("已套用照片，可拖曳預覽調整位置。");
    scheduleRender();
    setStep(2);
  } catch {
    const failureMessage = isHeicPhotoFile(file)
      ? "HEIC 照片轉換失敗，請換一張照片或先轉成 JPG。"
      : "照片載入失敗，請換一張圖片試試。";
    setStatus(failureMessage, { persistent: true });
  }
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (state.frame.width / rect.width),
    y: (event.clientY - rect.top) * (state.frame.height / rect.height),
  };
}

function pointerDistance() {
  const points = [...activePointers.values()];
  if (points.length < 2) {
    return 0;
  }

  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

function handlePointerDown(event) {
  if (!state.photo) {
    return;
  }

  canvas.classList.add("is-dragging");
  canvas.setPointerCapture(event.pointerId);
  activePointers.set(event.pointerId, canvasPoint(event));

  if (activePointers.size === 1) {
    dragStart = {
      point: canvasPoint(event),
      offsetX: state.transform.offsetX,
      offsetY: state.transform.offsetY,
    };
  } else if (activePointers.size === 2) {
    pinchStart = {
      distance: pointerDistance(),
      scale: state.transform.scale,
    };
  }
}

function handlePointerMove(event) {
  if (!state.photo || !activePointers.has(event.pointerId)) {
    return;
  }

  activePointers.set(event.pointerId, canvasPoint(event));

  if (activePointers.size === 1 && dragStart) {
    const point = canvasPoint(event);
    state.transform.offsetX = dragStart.offsetX + point.x - dragStart.point.x;
    state.transform.offsetY = dragStart.offsetY + point.y - dragStart.point.y;
  } else if (activePointers.size >= 2 && pinchStart) {
    const distance = pointerDistance();
    state.transform.scale = pinchStart.scale * (distance / pinchStart.distance);
  }

  normalizeCurrentTransform();
  scheduleRender();
}

function handlePointerEnd(event) {
  activePointers.delete(event.pointerId);

  if (activePointers.size === 0) {
    canvas.classList.remove("is-dragging");
    dragStart = null;
    pinchStart = null;
    return;
  }

  const point = [...activePointers.values()][0];
  dragStart = {
    point,
    offsetX: state.transform.offsetX,
    offsetY: state.transform.offsetY,
  };
}

function blobFromCanvas() {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Canvas export failed"));
      }
    }, "image/png");
  });
}

function downloadBlob(blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "熠序相框.png";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportBlob() {
  await render();
  return blobFromCanvas();
}

async function handleShare() {
  if (!state.photo) {
    return;
  }

  shareButton.disabled = true;
  setStatus("正在準備分享圖...");

  try {
    const blob = await exportBlob();
    const file = new File([blob], "熠序相框.png", { type: "image/png" });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "熠序相框",
        text: "我的熠序相框照片",
      });
      setStatus("分享流程已開啟。");
    } else {
      downloadBlob(blob);
      setStatus("此瀏覽器不支援直接分享檔案，已改為下載 PNG。");
    }
  } catch (error) {
    if (error.name === "AbortError") {
      setStatus("已取消分享。");
    } else {
      setStatus("分享失敗，請改用下載。");
    }
  } finally {
    shareButton.disabled = false;
  }
}

function resetCreationFlow() {
  if (state.photo && typeof state.photo.close === "function") {
    state.photo.close();
  }

  state.frame = FRAME_PRESETS[0];
  state.frameConfirmed = false;
  state.photo = null;
  state.photoName = "";
  state.autoTone = true;
  state.transform = { scale: 1, offsetX: 0, offsetY: 0 };

  photoInput.value = "";
  autoToneToggle.checked = true;
  canvas.width = state.frame.width;
  canvas.height = state.frame.height;
  syncPreviewAspect();
  framePreviewCache.clear();
  activePointers.clear();
  renderedPreviews.forEach((preview) => {
    preview.removeAttribute("src");
  });

  normalizeCurrentTransform();
  renderFrameOptions();
  updatePhotoUi();
  setStatus("上傳照片開始製作。");
  setStep(1);
}

photoInput.addEventListener("change", handlePhotoChange);
replacePhotoButton.addEventListener("click", () => {
  photoInput.click();
});

function startCreation() {
  setStep(2);
}

startButton.addEventListener("click", startCreation);
startButton.addEventListener("pointerup", startCreation);

backButton.addEventListener("click", () => {
  setStep(state.step - 1);
});

toFrameButton.addEventListener("click", () => {
  setStep(3);
});

autoToneToggle.addEventListener("change", () => {
  state.autoTone = autoToneToggle.checked;
  framePreviewCache.clear();
  scheduleRender();
});

zoomRange.addEventListener("input", () => {
  state.transform.scale = Number(zoomRange.value);
  normalizeCurrentTransform();
  framePreviewCache.clear();
  scheduleRender();
});

resetButton.addEventListener("click", () => {
  state.transform = { scale: 1, offsetX: 0, offsetY: 0 };
  normalizeCurrentTransform();
  framePreviewCache.clear();
  scheduleRender();
});

shareButton.addEventListener("click", handleShare);
makeAnotherButton.addEventListener("click", resetCreationFlow);

canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerup", handlePointerEnd);
canvas.addEventListener("pointercancel", handlePointerEnd);

canvas.width = state.frame.width;
canvas.height = state.frame.height;
syncPreviewAspect();
renderFrameOptions();
updatePhotoUi();
setStep(1);
