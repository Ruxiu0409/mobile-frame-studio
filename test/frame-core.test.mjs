import test from "node:test";
import assert from "node:assert/strict";

import {
  FRAME_PRESETS,
  clamp,
  coverRect,
  fitScaleForImage,
  normalizeTransform,
} from "../src/frame-core.js";

test("frame presets keep the first mobile share frame available", () => {
  assert.equal(FRAME_PRESETS.length, 1);
  assert.equal(FRAME_PRESETS[0].id, "shine-horizontal");
  assert.equal(FRAME_PRESETS[0].width, 2400);
  assert.equal(FRAME_PRESETS[0].height, 1800);
});

test("coverRect fills the frame while preserving image ratio", () => {
  const rect = coverRect(4000, 3000, 2400, 1800, 1, 0, 0);

  assert.deepEqual(rect, { x: 0, y: 0, width: 2400, height: 1800 });
});

test("coverRect centers portrait photos and keeps the canvas covered", () => {
  const rect = coverRect(1200, 1800, 2400, 1800, 1, 0, 0);

  assert.equal(rect.height, 3600);
  assert.equal(rect.y, -900);
  assert.equal(rect.x, 0);
  assert.equal(rect.width, 2400);
});

test("fitScaleForImage returns the natural cover scale", () => {
  assert.equal(fitScaleForImage(1200, 1800, 2400, 1800), 2);
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
  assert.equal(transform.offsetY, -900);
});

test("clamp constrains values inclusively", () => {
  assert.equal(clamp(10, 0, 5), 5);
  assert.equal(clamp(-3, 0, 5), 0);
  assert.equal(clamp(3, 0, 5), 3);
});
