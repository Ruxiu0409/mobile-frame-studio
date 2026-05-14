# 耀序相框製作

手機優先的單頁相框工具。使用者可以上傳照片、選擇相框、切換自動調色，最後用 Web Share API 分享 PNG；不支援檔案分享的瀏覽器會自動改成下載。

## 本機預覽

```bash
npm run serve
```

打開 `http://localhost:5173`。

## 新增相框

1. 把新的 PNG 放進 `assets/frames/`。
2. 在 `src/frame-core.js` 的 `FRAME_PRESETS` 加一筆設定。
3. 建議輸出尺寸維持 4:3，或同步調整 canvas 尺寸與測試。
