const statusEl = document.getElementById("status");
const targetLabel = document.getElementById("target-label");
const stream = document.getElementById("stream");
const deviceList = document.getElementById("device-list");
const form = document.getElementById("connect-form");
const textInput = document.getElementById("text-input");
const ctx = stream.getContext("2d");

let socket;
let connectedTarget = null;
let frameWidth = stream.width;
let frameHeight = stream.height;
let gestureStart = null;
let gestureStartAt = 0;

function wsUrl() {
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${window.location.host}/ws`;
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function sendInput(event) {
  if (!socket || socket.readyState !== WebSocket.OPEN || !connectedTarget) {
    return;
  }
  socket.send(JSON.stringify({ type: "input", event }));
}

function mapPoint(clientX, clientY) {
  const rect = stream.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * frameWidth;
  const y = ((clientY - rect.top) / rect.height) * frameHeight;
  return {
    x: Math.max(0, Math.min(frameWidth, Math.round(x))),
    y: Math.max(0, Math.min(frameHeight, Math.round(y)))
  };
}

function connect({ controllerId, targetId, secret }) {
  if (socket) {
    socket.close();
  }

  socket = new WebSocket(wsUrl());

  socket.addEventListener("open", () => {
    socket.send(
      JSON.stringify({
        type: "register-controller",
        controllerId,
        targetId,
        secret
      })
    );
  });

  socket.addEventListener("message", (message) => {
    const payload = JSON.parse(message.data);
    if (payload.type === "registered") {
      connectedTarget = payload.target.deviceId;
      targetLabel.textContent = `${payload.target.deviceId} / ${payload.target.platform}`;
      setStatus(`已连接 ${payload.target.deviceId}`);
      return;
    }
    if (payload.type === "frame") {
      const image = new Image();
      frameWidth = payload.width || frameWidth;
      frameHeight = payload.height || frameHeight;
      image.onload = () => {
        stream.width = frameWidth;
        stream.height = frameHeight;
        ctx.drawImage(image, 0, 0, frameWidth, frameHeight);
      };
      image.src = `data:image/jpeg;base64,${payload.image}`;
      return;
    }
    if (payload.type === "device-offline") {
      setStatus(`${payload.deviceId} 已离线`, true);
      return;
    }
    if (payload.type === "error") {
      setStatus(payload.message, true);
    }
  });

  socket.addEventListener("close", () => {
    connectedTarget = null;
    setStatus("连接已关闭", true);
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  connect({
    controllerId: document.getElementById("controller-id").value.trim(),
    targetId: document.getElementById("target-id").value.trim(),
    secret: document.getElementById("secret").value.trim()
  });
});

stream.addEventListener("pointerdown", (event) => {
  gestureStart = mapPoint(event.clientX, event.clientY);
  gestureStartAt = Date.now();
});

stream.addEventListener("pointerup", (event) => {
  if (!gestureStart) {
    return;
  }

  const end = mapPoint(event.clientX, event.clientY);
  const dx = end.x - gestureStart.x;
  const dy = end.y - gestureStart.y;
  const distance = Math.hypot(dx, dy);
  const duration = Math.max(120, Date.now() - gestureStartAt);

  if (distance < 18) {
    sendInput({ type: "pointerdown", x: end.x, y: end.y });
  } else {
    sendInput({
      type: "swipe",
      x1: gestureStart.x,
      y1: gestureStart.y,
      x2: end.x,
      y2: end.y,
      duration
    });
  }
  gestureStart = null;
});

window.addEventListener("keydown", (event) => {
  if (!connectedTarget) {
    return;
  }
  if (["Escape", "Home"].includes(event.key)) {
    event.preventDefault();
    sendInput({ type: "keydown", key: event.key });
  }
});

document.querySelectorAll("[data-key]").forEach((button) => {
  button.addEventListener("click", () => {
    sendInput({ type: "keydown", key: button.dataset.key });
  });
});

document.getElementById("send-text").addEventListener("click", () => {
  const value = textInput.value.trim();
  if (!value) {
    return;
  }
  sendInput({ type: "text", value });
});

document.getElementById("refresh-devices").addEventListener("click", async () => {
  const response = await fetch("/api/devices");
  const data = await response.json();
  deviceList.innerHTML = "";
  for (const device of data.devices) {
    const card = document.createElement("div");
    card.className = "device-card";
    card.innerHTML = `
      <div>
        <strong>${device.deviceId}</strong>
        <span>${device.platform}</span>
      </div>
      <span>${device.capabilities.join(", ")}</span>
    `;
    deviceList.appendChild(card);
  }
});
