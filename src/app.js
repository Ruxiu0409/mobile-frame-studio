import {
  FRAME_PRESETS,
  coverRect,
  normalizeTransform,
} from "./frame-core.js";

const canvas = document.querySelector("#previewCanvas");
const ctx = canvas.getContext("2d", { alpha: false });
const photoInput = document.querySelector("#photoInput");
const fileName = document.querySelector("#fileName");
const frameList = document.querySelector("#frameList");
const autoToneToggle = document.querySelector("#autoToneToggle");
const zoomRange = document.querySelector("#zoomRange");
const resetButton = document.querySelector("#resetButton");
const shareButton = document.querySelector("#shareButton");
const downloadButton = document.querySelector("#downloadButton");
const statusMessage = document.querySelector("#statusMessage");

const state = {
  frame: FRAME_PRESETS[0],
  photo: null,
  photoName: "",
  autoTone: true,
  transform: {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  },
};

const frameCache = new Map();
const activePointers = new Map();
let dragStart = null;
let pinchStart = null;
let renderFrame = 0;

function setStatus(message) {
  statusMessage.textContent = message;
}

function setControlsEnabled(enabled) {
  shareButton.disabled = !enabled;
  downloadButton.disabled = !enabled;
  resetButton.disabled = !enabled;
  zoomRange.disabled = !enabled;
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
    option.innerHTML = `
      <img src="${frame.src}" alt="" loading="lazy" />
      <span>
        <strong>${frame.name}</strong>
        <small>${createIconText(frame)}</small>
      </span>
    `;
    option.addEventListener("click", () => {
      state.frame = frame;
      canvas.width = frame.width;
      canvas.height = frame.height;
      normalizeCurrentTransform();
      renderFrameOptions();
      scheduleRender();
    });
    frameList.append(option);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function loadPhoto(file) {
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

function createTransparentFrame(image, width, height) {
  const overlay = document.createElement("canvas");
  overlay.width = width;
  overlay.height = height;

  const overlayCtx = overlay.getContext("2d");
  overlayCtx.drawImage(image, 0, 0, width, height);

  const imageData = overlayCtx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const alpha = pixels[index + 3];
    const isPaperWhite = red > 244 && green > 241 && blue > 235 && alpha > 0;

    if (isPaperWhite) {
      pixels[index + 3] = 0;
    }
  }

  overlayCtx.putImageData(imageData, 0, 0);
  return overlay;
}

async function getFrameAsset(frame) {
  if (!frameCache.has(frame.id)) {
    const image = await loadImage(frame.src);
    frameCache.set(frame.id, {
      image,
      overlay: createTransparentFrame(image, frame.width, frame.height),
    });
  }

  return frameCache.get(frame.id);
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
  const gradient = ctx.createLinearGradient(0, 0, state.frame.width, state.frame.height);
  gradient.addColorStop(0, "#fffaf0");
  gradient.addColorStop(1, "#f0e3ca");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, state.frame.width, state.frame.height);

  ctx.fillStyle = "rgba(75, 54, 18, 0.72)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 86px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("上傳照片開始製作", state.frame.width / 2, state.frame.height / 2);
}

function drawPhoto() {
  const rect = coverRect(
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
    const vignette = ctx.createRadialGradient(
      state.frame.width / 2,
      state.frame.height / 2,
      state.frame.width * 0.18,
      state.frame.width / 2,
      state.frame.height / 2,
      state.frame.width * 0.72,
    );
    vignette.addColorStop(0, "rgba(255, 245, 219, 0.04)");
    vignette.addColorStop(1, "rgba(32, 19, 3, 0.16)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, state.frame.width, state.frame.height);
  }
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

  ctx.drawImage(frameAsset.overlay, 0, 0, state.frame.width, state.frame.height);
}

function scheduleRender() {
  window.requestAnimationFrame(() => {
    render().catch(() => {
      setStatus("相框載入失敗，請重新整理頁面。");
    });
  });
}

function updatePhotoUi() {
  const hasPhoto = Boolean(state.photo);
  fileName.textContent = hasPhoto ? state.photoName : "尚未選擇照片";
  setControlsEnabled(hasPhoto);
}

async function handlePhotoChange(event) {
  const [file] = event.target.files;

  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/")) {
    setStatus("請選擇圖片檔。");
    return;
  }

  setStatus("照片載入中...");

  try {
    if (state.photo && typeof state.photo.close === "function") {
      state.photo.close();
    }

    state.photo = await loadPhoto(file);
    state.photoName = file.name;
    state.transform = { scale: 1, offsetX: 0, offsetY: 0 };
    normalizeCurrentTransform();
    updatePhotoUi();
    setStatus("已套用照片，可拖曳預覽調整位置。");
    scheduleRender();
  } catch {
    setStatus("照片載入失敗，請換一張圖片試試。");
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
  link.download = "耀序相框.png";
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
    const file = new File([blob], "耀序相框.png", { type: "image/png" });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "耀序相框",
        text: "我的耀序相框照片",
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

async function handleDownload() {
  if (!state.photo) {
    return;
  }

  downloadButton.disabled = true;
  setStatus("正在輸出 PNG...");

  try {
    const blob = await exportBlob();
    downloadBlob(blob);
    setStatus("PNG 已輸出。");
  } catch {
    setStatus("輸出失敗，請重新整理後再試。");
  } finally {
    downloadButton.disabled = false;
  }
}

photoInput.addEventListener("change", handlePhotoChange);

autoToneToggle.addEventListener("change", () => {
  state.autoTone = autoToneToggle.checked;
  scheduleRender();
});

zoomRange.addEventListener("input", () => {
  state.transform.scale = Number(zoomRange.value);
  normalizeCurrentTransform();
  scheduleRender();
});

resetButton.addEventListener("click", () => {
  state.transform = { scale: 1, offsetX: 0, offsetY: 0 };
  normalizeCurrentTransform();
  scheduleRender();
});

shareButton.addEventListener("click", handleShare);
downloadButton.addEventListener("click", handleDownload);

canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerup", handlePointerEnd);
canvas.addEventListener("pointercancel", handlePointerEnd);

canvas.width = state.frame.width;
canvas.height = state.frame.height;
renderFrameOptions();
updatePhotoUi();
scheduleRender();
