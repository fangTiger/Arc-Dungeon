import { createApp } from "./runtime/app.js";

const canvas = document.querySelector("#game");
const fallback = document.querySelector("#fallback");

if (!(canvas instanceof HTMLCanvasElement)) {
  showFallback("你的浏览器暂不支持 Canvas。");
} else {
  try {
    const app = await createApp(canvas);
    app.start();
    window.dispatchEvent(new Event("rialo:startup-complete"));
  } catch (error) {
    console.error("游戏启动失败", error);
    showFallback(
      "游戏启动失败。请尝试硬刷新（Cmd/Ctrl+Shift+R），详情见浏览器控制台。",
    );
  }
}

function showFallback(message) {
  if (!fallback) {
    return;
  }

  fallback.textContent = message;
  fallback.hidden = false;
}
