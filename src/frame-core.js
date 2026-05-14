export const FRAME_PRESETS = [
  {
    id: "shine-horizontal",
    name: "熠序橫式相框",
    src: "assets/frames/shine-horizontal.png",
    width: 2400,
    height: 1800,
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
