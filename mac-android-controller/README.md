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

如果要跨网络远程（不在同一个 Wi-Fi），推荐使用 Tailscale：

- Mac 和手机都安装并登录 Tailscale，同一 tailnet
- 手机端保持 `adb tcpip 5555` 已开启
- 在 Mac 上使用 `adb connect 手机的TailscaleIP:5555`
- 或者直接在页面里填 `TailscaleIP:5555`，点「连接远程设备」

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
- 「对当前设备开启 5555」：对已选设备执行 `adb -s <serial> tcpip 5555`
- 「连接远程设备」：执行 `adb connect <IP:5555>`
- 「断开远程连接」：执行 `adb disconnect <IP:5555>`（输入框留空则断开全部）
- 「低带宽模式」：把画面轮询从约 700ms 降到约 1800ms，弱网更稳定、流量更低

## 限制

- 画面是截图轮询，不是低延迟视频流
- 某些输入框对 `adb shell input text` 的中文支持不稳定
- 复杂多指手势、音频回传、剪贴板同步还没做
- 锁屏密码界面在部分 ROM（如部分华为机型）无法通过 `screencap` 实时获取
