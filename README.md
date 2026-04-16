# Android Remote Control Workspace

这个仓库现在有两条路线：

- `mac-android-controller`：推荐。MacBook 通过 `adb` 直接控制 Android，可直接运行。
- `relay-server` + `desktop-agent` + `android-agent`：早期的跨端中继 MVP，目前仍保留，但没有 `mac-android-controller` 这条链路成熟。

## 推荐路线：MacBook 控制 Android

如果你的目标是“在 MacBook 上直接操控 Android 手机”，优先使用：

- [mac-android-controller/server.js](/C:/Users/zhao.mufei/Downloads/codex-workspace/内网穿透/mac-android-controller/server.js)
- [mac-android-controller/web/app.js](/C:/Users/zhao.mufei/Downloads/codex-workspace/内网穿透/mac-android-controller/web/app.js)

这条链路依赖本机 `adb`，通过下面这些能力实现控制：

- `adb exec-out screencap -p` 获取手机画面
- `adb shell input tap/swipe/keyevent/text` 注入操作
- 本地浏览器作为控制台

### 启动

```bash
cd mac-android-controller
npm install
npm start
```

打开：

```text
http://127.0.0.1:8090
```

### 前置要求

- Mac 已安装 `adb`
- Android 已开启开发者选项和 USB 调试
- `adb devices` 能看到目标手机，且状态是 `device`

如果要走无线调试，可以先执行：

```bash
adb tcpip 5555
adb connect 手机IP:5555
```

## 旧路线

这些目录仍然保留：

- [relay-server/server.js](/C:/Users/zhao.mufei/Downloads/codex-workspace/内网穿透/relay-server/server.js)
- [desktop-agent/agent.py](/C:/Users/zhao.mufei/Downloads/codex-workspace/内网穿透/desktop-agent/agent.py)
- [android-agent/app/src/main/java/com/example/natremote/relay/RelayForegroundService.kt](/C:/Users/zhao.mufei/Downloads/codex-workspace/内网穿透/android-agent/app/src/main/java/com/example/natremote/relay/RelayForegroundService.kt)

它们更适合后续继续做“穿透 + 双向远控”版本，不是这次最推荐的可运行方案。
