const statusEl = document.getElementById("status");
const targetLabel = document.getElementById("target-label");
const stream = document.getElementById("stream");
const deviceList = document.getElementById("device-list");
const form = document.getElementById("connect-form");
const ctx = stream.getContext("2d");

let socket;
let connectedTarget = null;
let frameWidth = stream.width;
let frameHeight = stream.height;

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
  stream.setPointerCapture(event.pointerId);
  sendInput({ type: "pointerdown", ...mapPoint(event.clientX, event.clientY) });
});
stream.addEventListener("pointermove", (event) => {
  if (event.buttons === 0) {
    return;
  }
  sendInput({ type: "pointermove", ...mapPoint(event.clientX, event.clientY) });
});
stream.addEventListener("pointerup", (event) => {
  sendInput({ type: "pointerup", ...mapPoint(event.clientX, event.clientY) });
});

window.addEventListener("keydown", (event) => {
  if (!connectedTarget) {
    return;
  }
  event.preventDefault();
  sendInput({
    type: "keydown",
    key: event.key,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
    metaKey: event.metaKey
  });
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
