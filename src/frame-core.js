export const FRAME_PRESETS = [
  {
    id: "shine-horizontal",
    name: "耀序橫式相框",
    src: "assets/frames/shine-horizontal.png",
    width: 2400,
    height: 1800,
  },
];

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function fitScaleForImage(imageWidth, imageHeight, canvasWidth, canvasHeight) {
  if (!imageWidth || !imageHeight || !canvasWidth || !canvasHeight) {
    return 1;
  }

  return Math.max(canvasWidth / imageWidth, canvasHeight / imageHeight);
}

export function coverRect(
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
  const rect = coverRect(imageWidth, imageHeight, canvasWidth, canvasHeight, nextScale, 0, 0);
  const maxOffsetX = Math.max(0, (rect.width - canvasWidth) / 2);
  const maxOffsetY = Math.max(0, (rect.height - canvasHeight) / 2);

  return {
    scale: nextScale,
    offsetX: clamp(offsetX, -maxOffsetX, maxOffsetX),
    offsetY: clamp(offsetY, -maxOffsetY, maxOffsetY),
  };
}
