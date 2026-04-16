# MacBook 控制 Android

这是当前仓库里最容易直接跑起来的版本。Mac 端通过 `adb` 直接：

- 轮询 `screencap -p` 获取手机画面
- 调用 `input tap/swipe/keyevent/text` 注入操作
- 在本地浏览器里显示控制台

## 前置要求

- macOS 已安装 `adb`
- Android 手机已开启开发者选项和 USB 调试
- 手机已通过 `adb devices` 显示为 `device`

如果你要走无线调试，可以先在 USB 连线状态下执行：

```bash
adb tcpip 5555
adb connect 手机IP:5555
```

## 启动

```bash
cd mac-android-controller
npm install
npm start
```

默认会监听：

```text
http://127.0.0.1:8090
```

## 操作

- 点击画面：发送 `tap`
- 拖拽画面：发送 `swipe`
- 顶部按钮：返回 / Home / 任务 / 电源
- 输入框：向当前焦点输入框发送文本
- 键盘 `Escape`：返回
- 键盘 `h`：Home

## 限制

- 画面是截图轮询，不是低延迟视频流
- 某些输入框对 `adb shell input text` 的中文支持不稳定
- 复杂多指手势、音频回传、剪贴板同步还没做
