const statusEl = document.getElementById("status");
const deviceSelect = document.getElementById("deviceSelect");
const displayInfoEl = document.getElementById("displayInfo");
const deviceTitleEl = document.getElementById("deviceTitle");
const canvas = document.getElementById("screenCanvas");
const ctx = canvas.getContext("2d");
const textInput = document.getElementById("textInput");

let currentSerial = "";
let display = { width: 0, height: 0 };
let frameTimer = null;
let gestureStart = null;
let loadingFrame = false;

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
  const data = await fetchJson("/api/devices");
  deviceSelect.innerHTML = "";
  for (const device of data.devices.filter((item) => item.state === "device")) {
    const option = document.createElement("option");
    option.value = device.serial;
    option.textContent = `${device.model} (${device.serial})`;
    deviceSelect.appendChild(option);
  }
  if (!deviceSelect.value && deviceSelect.options.length > 0) {
    deviceSelect.selectedIndex = 0;
  }
  if (deviceSelect.value) {
    await selectDevice(deviceSelect.value);
  } else {
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
  frameTimer = setInterval(loadFrame, 700);
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
  window.setTimeout(loadFrame, 120);
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

refreshDevices().catch((error) => setStatus(error.message, true));
