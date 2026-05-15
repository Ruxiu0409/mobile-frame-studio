export const FRAME_PRESETS = [
  {
    id: "yixu-horizontal",
    name: "熠序橫式",
    src: "assets/frames/frame-horizontal-0.png",
    width: 3848,
    height: 2886,
  },
  {
    id: "yixu-vertical-logo-bottom",
    name: "熠序直式 1",
    src: "assets/frames/frame-vertical-1.png",
    width: 1800,
    height: 3200,
  },
  {
    id: "yixu-vertical-wordmark-bottom",
    name: "熠序直式 2",
    src: "assets/frames/frame-vertical-2.png",
    width: 1800,
    height: 3200,
  },
];

const ACCEPTED_PHOTO_EXTENSIONS = new Set([".heic", ".heif", ".jpg", ".jpeg", ".png"]);
const HEIC_PHOTO_EXTENSIONS = new Set([".heic", ".heif"]);
const ACCEPTED_PHOTO_MIME_TYPES = new Set([
  "image/heic",
  "image/heic-sequence",
  "image/heif",
  "image/heif-sequence",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);
const HEIC_PHOTO_MIME_TYPES = new Set([
  "image/heic",
  "image/heic-sequence",
  "image/heif",
  "image/heif-sequence",
]);

export const PHOTO_ACCEPT_VALUE = [
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  ".heic",
  ".heif",
  ".jpg",
  ".jpeg",
  ".png",
].join(",");

export function fileExtension(fileName = "") {
  const normalizedName = String(fileName).trim().toLowerCase();
  const queryStart = normalizedName.search(/[?#]/);
  const cleanName = queryStart === -1 ? normalizedName : normalizedName.slice(0, queryStart);
  const dotIndex = cleanName.lastIndexOf(".");

  return dotIndex === -1 ? "" : cleanName.slice(dotIndex);
}

export function isHeicPhotoFile(file) {
  const mimeType = String(file?.type ?? "").trim().toLowerCase();
  const extension = fileExtension(file?.name);

  return HEIC_PHOTO_MIME_TYPES.has(mimeType) || HEIC_PHOTO_EXTENSIONS.has(extension);
}

export function isSupportedPhotoFile(file) {
  const mimeType = String(file?.type ?? "").trim().toLowerCase();
  const extension = fileExtension(file?.name);

  return ACCEPTED_PHOTO_MIME_TYPES.has(mimeType) || ACCEPTED_PHOTO_EXTENSIONS.has(extension);
}

export function frameOrientation(frame) {
  return frame.width > frame.height ? "landscape" : "portrait";
}

export function clamp(value, min, max) {
  const clamped = Math.min(Math.max(value, min), max);
  return Object.is(clamped, -0) ? 0 : clamped;
}

export function fitScaleForImage(imageWidth, imageHeight, canvasWidth, canvasHeight) {
  if (!imageWidth || !imageHeight || !canvasWidth || !canvasHeight) {
    return 1;
  }

  return Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight);
}

export function fitRect(
  imageWidth,
  imageHeight,
  canvasWidth,
  canvasHeight,
  scale = 1,
  offsetX = 0,
  offsetY = 0,
) {
  const baseScale = fitScaleForImage(imageWidth, imageHeight, canvasWidth, canvasHeight);
  const drawScale = baseScale * scale;
  const width = imageWidth * drawScale;
  const height = imageHeight * drawScale;

  return {
    x: (canvasWidth - width) / 2 + offsetX,
    y: (canvasHeight - height) / 2 + offsetY,
    width,
    height,
  };
}

export function normalizeTransform({
  imageWidth,
  imageHeight,
  canvasWidth,
  canvasHeight,
  scale,
  offsetX,
  offsetY,
}) {
  const nextScale = clamp(scale, 1, 3);
  const rect = fitRect(imageWidth, imageHeight, canvasWidth, canvasHeight, nextScale, 0, 0);
  const maxOffsetX = Math.max(0, (rect.width - canvasWidth) / 2);
  const maxOffsetY = Math.max(0, (rect.height - canvasHeight) / 2);

  return {
    scale: nextScale,
    offsetX: clamp(offsetX, -maxOffsetX, maxOffsetX),
    offsetY: clamp(offsetY, -maxOffsetY, maxOffsetY),
  };
}

export function transformWithGesture({
  imageWidth,
  imageHeight,
  canvasWidth,
  canvasHeight,
  currentTransform,
  scaleDelta = 1,
  offsetDeltaX = 0,
  offsetDeltaY = 0,
}) {
  const scale = Number.isFinite(currentTransform?.scale) ? currentTransform.scale : 1;
  const offsetX = Number.isFinite(currentTransform?.offsetX) ? currentTransform.offsetX : 0;
  const offsetY = Number.isFinite(currentTransform?.offsetY) ? currentTransform.offsetY : 0;

  return normalizeTransform({
    imageWidth,
    imageHeight,
    canvasWidth,
    canvasHeight,
    scale: scale * scaleDelta,
    offsetX: offsetX + offsetDeltaX,
    offsetY: offsetY + offsetDeltaY,
  });
}
