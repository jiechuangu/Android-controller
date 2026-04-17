const statusEl = document.getElementById("status");
const deviceSelect = document.getElementById("deviceSelect");
const displayInfoEl = document.getElementById("displayInfo");
const deviceTitleEl = document.getElementById("deviceTitle");
const canvas = document.getElementById("screenCanvas");
const ctx = canvas.getContext("2d");
const textInput = document.getElementById("textInput");
const remoteTargetEl = document.getElementById("remoteTarget");
const connectRemoteBtn = document.getElementById("connectRemote");
const disconnectRemoteBtn = document.getElementById("disconnectRemote");
const enableTcpipBtn = document.getElementById("enableTcpip");
const lowBandwidthModeEl = document.getElementById("lowBandwidthMode");

let currentSerial = "";
let display = { width: 0, height: 0 };
let frameTimer = null;
let gestureStart = null;
let loadingFrame = false;
const REMOTE_TARGET_KEY = "adb_remote_target";
const LOW_BANDWIDTH_MODE_KEY = "low_bandwidth_mode";
let lowBandwidthMode = false;

const FRAME_INTERVAL_MS = {
  normal: 700,
  low: 1800
};

function currentFrameInterval() {
  return lowBandwidthMode ? FRAME_INTERVAL_MS.low : FRAME_INTERVAL_MS.normal;
}

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "#ff8a80" : "";
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

async function refreshDevices() {
  const previousSerial = currentSerial;
  const data = await fetchJson("/api/devices");
  deviceSelect.innerHTML = "";
  for (const device of data.devices.filter((item) => item.state === "device")) {
    const option = document.createElement("option");
    option.value = device.serial;
    option.textContent = `${device.model} (${device.serial})`;
    deviceSelect.appendChild(option);
  }
  if (deviceSelect.options.length > 0) {
    const preserved = Array.from(deviceSelect.options).find((item) => item.value === previousSerial);
    if (preserved) {
      deviceSelect.value = previousSerial;
    } else if (!deviceSelect.value) {
      deviceSelect.selectedIndex = 0;
    }
  }
  if (deviceSelect.value) {
    await selectDevice(deviceSelect.value);
  } else {
    currentSerial = "";
    deviceTitleEl.textContent = "未选择设备";
    displayInfoEl.textContent = "0 x 0";
    clearInterval(frameTimer);
    setStatus("未发现已连接设备", true);
  }
}

async function selectDevice(serial) {
  currentSerial = serial;
  const info = await fetchJson(`/api/display/${encodeURIComponent(serial)}`);
  display = info;
  canvas.width = info.width;
  canvas.height = info.height;
  displayInfoEl.textContent = `${info.width} x ${info.height}`;
  deviceTitleEl.textContent = serial;
  setStatus(`已连接 ${serial}`);
  startFrameLoop();
}

async function loadFrame() {
  if (!currentSerial || loadingFrame) {
    return;
  }
  loadingFrame = true;
  try {
    const response = await fetch(`/api/frame/${encodeURIComponent(currentSerial)}?t=${Date.now()}`, {
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error("Failed to fetch frame");
    }
    const blob = await response.blob();
    const image = await createImageBitmap(blob);
    ctx.drawImage(image, 0, 0, display.width, display.height);
    image.close();
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    loadingFrame = false;
  }
}

function startFrameLoop() {
  clearInterval(frameTimer);
  loadFrame();
  frameTimer = setInterval(loadFrame, currentFrameInterval());
}

function canvasPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.round(((clientX - rect.left) / rect.width) * display.width),
    y: Math.round(((clientY - rect.top) / rect.height) * display.height)
  };
}

async function sendAction(action) {
  if (!currentSerial) {
    return;
  }
  await fetchJson(`/api/action/${encodeURIComponent(currentSerial)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action)
  });
  window.setTimeout(loadFrame, lowBandwidthMode ? 320 : 120);
}

async function connectRemoteTarget(target) {
  const normalized = String(target || "").trim();
  if (!normalized) {
    throw new Error("请输入远程地址，例如 100.x.x.x:5555");
  }
  const result = await fetchJson("/api/adb/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target: normalized })
  });
  localStorage.setItem(REMOTE_TARGET_KEY, normalized);
  remoteTargetEl.value = normalized;
  await refreshDevices();
  const hasConnectedDevice = Array.from(deviceSelect.options).some((item) => item.value === normalized);
  if (hasConnectedDevice) {
    await selectDevice(normalized);
  }
  setStatus(result.output || `已连接 ${normalized}`);
}

async function disconnectRemoteTarget(target) {
  const normalized = String(target || "").trim();
  const result = await fetchJson("/api/adb/disconnect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target: normalized })
  });
  await refreshDevices();
  setStatus(result.output || "已断开远程连接");
}

async function enableTcpipForCurrentDevice() {
  if (!currentSerial) {
    throw new Error("请先选择设备");
  }
  const result = await fetchJson("/api/adb/tcpip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serial: currentSerial, port: 5555 })
  });
  setStatus(result.output || `已对 ${currentSerial} 开启 5555`);
}

canvas.addEventListener("pointerdown", (event) => {
  gestureStart = canvasPoint(event.clientX, event.clientY);
});

canvas.addEventListener("pointerup", async (event) => {
  if (!gestureStart) {
    return;
  }
  const end = canvasPoint(event.clientX, event.clientY);
  const dx = end.x - gestureStart.x;
  const dy = end.y - gestureStart.y;
  const distance = Math.hypot(dx, dy);
  try {
    if (distance < 18) {
      await sendAction({ type: "tap", x: end.x, y: end.y });
    } else {
      await sendAction({
        type: "swipe",
        x1: gestureStart.x,
        y1: gestureStart.y,
        x2: end.x,
        y2: end.y,
        duration: 240
      });
    }
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    gestureStart = null;
  }
});

document.getElementById("refreshDevices").addEventListener("click", async () => {
  try {
    await refreshDevices();
  } catch (error) {
    setStatus(error.message, true);
  }
});

deviceSelect.addEventListener("change", async (event) => {
  try {
    await selectDevice(event.target.value);
  } catch (error) {
    setStatus(error.message, true);
  }
});

document.querySelectorAll("[data-key]").forEach((button) => {
  button.addEventListener("click", async () => {
    try {
      await sendAction({ type: "keyevent", keycode: button.dataset.key });
    } catch (error) {
      setStatus(error.message, true);
    }
  });
});

document.getElementById("sendText").addEventListener("click", async () => {
  const text = textInput.value.trim();
  if (!text) {
    return;
  }
  try {
    await sendAction({ type: "text", text });
  } catch (error) {
    setStatus(error.message, true);
  }
});

connectRemoteBtn.addEventListener("click", async () => {
  try {
    await connectRemoteTarget(remoteTargetEl.value);
  } catch (error) {
    setStatus(error.message, true);
  }
});

disconnectRemoteBtn.addEventListener("click", async () => {
  try {
    await disconnectRemoteTarget(remoteTargetEl.value);
  } catch (error) {
    setStatus(error.message, true);
  }
});

enableTcpipBtn.addEventListener("click", async () => {
  try {
    await enableTcpipForCurrentDevice();
  } catch (error) {
    setStatus(error.message, true);
  }
});

lowBandwidthModeEl.addEventListener("change", () => {
  lowBandwidthMode = Boolean(lowBandwidthModeEl.checked);
  localStorage.setItem(LOW_BANDWIDTH_MODE_KEY, lowBandwidthMode ? "1" : "0");
  startFrameLoop();
  setStatus(lowBandwidthMode ? "低带宽模式已开启（刷新更慢）" : "低带宽模式已关闭");
});

remoteTargetEl.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") {
    return;
  }
  event.preventDefault();
  try {
    await connectRemoteTarget(remoteTargetEl.value);
  } catch (error) {
    setStatus(error.message, true);
  }
});

window.addEventListener("keydown", async (event) => {
  if (!currentSerial) {
    return;
  }
  try {
    if (event.key === "Escape") {
      event.preventDefault();
      await sendAction({ type: "keyevent", keycode: "KEYCODE_BACK" });
    } else if (event.key.toLowerCase() === "h") {
      event.preventDefault();
      await sendAction({ type: "keyevent", keycode: "KEYCODE_HOME" });
    }
  } catch (error) {
    setStatus(error.message, true);
  }
});

remoteTargetEl.value = localStorage.getItem(REMOTE_TARGET_KEY) || "";
lowBandwidthMode = localStorage.getItem(LOW_BANDWIDTH_MODE_KEY) === "1";
lowBandwidthModeEl.checked = lowBandwidthMode;
refreshDevices().catch((error) => setStatus(error.message, true));
