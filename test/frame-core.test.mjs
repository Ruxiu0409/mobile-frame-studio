import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  FRAME_PRESETS,
  PHOTO_ACCEPT_VALUE,
  clamp,
  fileExtension,
  fitRect,
  fitScaleForImage,
  isHeicPhotoFile,
  isSupportedPhotoFile,
  normalizeTransform,
} from "../src/frame-core.js";

function pngSize(filePath) {
  const buffer = readFileSync(filePath);

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test("frame presets expose the three Yixu ceremony frames", () => {
  assert.equal(FRAME_PRESETS.length, 3);
  assert.deepEqual(
    FRAME_PRESETS.map(({ id }) => id),
    ["yixu-horizontal", "yixu-vertical-logo-bottom", "yixu-vertical-wordmark-bottom"],
  );
  assert.deepEqual(
    FRAME_PRESETS.map(({ width, height }) => [width, height]),
    [
      [3848, 2886],
      [1800, 3200],
      [1800, 3200],
    ],
  );
});

test("frame preset assets exist and match their configured dimensions", () => {
  FRAME_PRESETS.forEach((frame) => {
    const assetUrl = new URL(`../${frame.src}`, import.meta.url);
    assert.deepEqual(pngSize(assetUrl), {
      width: frame.width,
      height: frame.height,
    });
  });
});

test("photo picker accepts HEIC, PNG, and JPG inputs", () => {
  assert.match(PHOTO_ACCEPT_VALUE, /image\/heic/);
  assert.match(PHOTO_ACCEPT_VALUE, /\.png/);
  assert.match(PHOTO_ACCEPT_VALUE, /\.jpe?g/);
});

test("fileExtension normalizes names safely", () => {
  assert.equal(fileExtension("IMG_1234.HEIC"), ".heic");
  assert.equal(fileExtension("photo.JPG?cache=1"), ".jpg");
  assert.equal(fileExtension("untitled"), "");
});

test("isSupportedPhotoFile allows only the supported photo formats", () => {
  assert.equal(isSupportedPhotoFile({ name: "photo.heic", type: "" }), true);
  assert.equal(isSupportedPhotoFile({ name: "photo.png", type: "image/png" }), true);
  assert.equal(isSupportedPhotoFile({ name: "photo.jpg", type: "image/jpeg" }), true);
  assert.equal(isSupportedPhotoFile({ name: "photo.webp", type: "image/webp" }), false);
  assert.equal(isSupportedPhotoFile({ name: "photo.pdf", type: "application/pdf" }), false);
});

test("isHeicPhotoFile detects HEIC and HEIF photos by type or name", () => {
  assert.equal(isHeicPhotoFile({ name: "photo", type: "image/heic" }), true);
  assert.equal(isHeicPhotoFile({ name: "photo.HEIF", type: "" }), true);
  assert.equal(isHeicPhotoFile({ name: "photo.jpg", type: "image/jpeg" }), false);
});

test("fitRect keeps matching-ratio photos full size", () => {
  const rect = fitRect(4000, 3000, 2400, 1800, 1, 0, 0);

  assert.deepEqual(rect, { x: 0, y: 0, width: 2400, height: 1800 });
});

test("fitRect centers portrait photos without forcing a crop", () => {
  const rect = fitRect(1200, 1800, 2400, 1800, 1, 0, 0);

  assert.equal(rect.height, 1800);
  assert.equal(rect.y, 0);
  assert.equal(rect.x, 600);
  assert.equal(rect.width, 1200);
});

test("fitScaleForImage returns the natural contain scale", () => {
  assert.equal(fitScaleForImage(1200, 1800, 2400, 1800), 1);
  assert.equal(fitScaleForImage(4000, 3000, 2400, 1800), 0.6);
});

test("normalizeTransform clamps scale and offsets", () => {
  const transform = normalizeTransform({
    imageWidth: 1200,
    imageHeight: 1800,
    canvasWidth: 2400,
    canvasHeight: 1800,
    scale: 0.2,
    offsetX: 5000,
    offsetY: -5000,
  });

  assert.equal(transform.scale, 1);
  assert.equal(transform.offsetX, 0);
  assert.equal(transform.offsetY, 0);
});

test("clamp constrains values inclusively", () => {
  assert.equal(clamp(10, 0, 5), 5);
  assert.equal(clamp(-3, 0, 5), 0);
  assert.equal(clamp(3, 0, 5), 3);
});
