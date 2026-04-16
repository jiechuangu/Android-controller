import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

const devices = new Map();
const controllers = new Map();

function deviceView(device) {
  return {
    deviceId: device.deviceId,
    platform: device.platform,
    capabilities: device.capabilities,
    onlineAt: device.onlineAt
  };
}

function send(socket, payload) {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(payload));
  }
}

function notifySubscribers(deviceId, payload) {
  const watcherIds = controllers.get(deviceId) || new Set();
  for (const watcherId of watcherIds) {
    const controller = devices.get(watcherId);
    if (controller?.role === "controller") {
      send(controller.socket, payload);
    }
  }
}

function attachController(targetId, controllerId) {
  if (!controllers.has(targetId)) {
    controllers.set(targetId, new Set());
  }
  controllers.get(targetId).add(controllerId);
}

function detachController(targetId, controllerId) {
  if (!controllers.has(targetId)) {
    return;
  }
  const watcherIds = controllers.get(targetId);
  watcherIds.delete(controllerId);
  if (watcherIds.size === 0) {
    controllers.delete(targetId);
  }
}

function unregister(socket) {
  for (const [deviceId, record] of devices.entries()) {
    if (record.socket !== socket) {
      continue;
    }
    devices.delete(deviceId);
    if (record.role === "device") {
      notifySubscribers(deviceId, { type: "device-offline", deviceId });
      controllers.delete(deviceId);
    }
    if (record.role === "controller" && record.targetId) {
      detachController(record.targetId, deviceId);
    }
  }
}

function handleDeviceRegister(socket, payload) {
  const { deviceId, secret, platform, capabilities } = payload;
  if (!deviceId || !secret) {
    send(socket, { type: "error", message: "deviceId and secret are required" });
    return;
  }

  devices.set(deviceId, {
    socket,
    role: "device",
    deviceId,
    secret,
    platform: platform || "unknown",
    capabilities: capabilities || [],
    onlineAt: new Date().toISOString()
  });

  send(socket, {
    type: "registered",
    role: "device",
    device: deviceView(devices.get(deviceId))
  });
}

function handleControllerRegister(socket, payload) {
  const { controllerId, targetId, secret } = payload;
  const target = devices.get(targetId);
  if (!controllerId || !targetId || !secret) {
    send(socket, { type: "error", message: "controllerId, targetId and secret are required" });
    return;
  }
  if (!target || target.role !== "device") {
    send(socket, { type: "error", message: "target device is offline" });
    return;
  }
  if (target.secret !== secret) {
    send(socket, { type: "error", message: "secret is invalid" });
    return;
  }

  devices.set(controllerId, {
    socket,
    role: "controller",
    deviceId: controllerId,
    targetId,
    onlineAt: new Date().toISOString()
  });
  attachController(targetId, controllerId);

  send(socket, {
    type: "registered",
    role: "controller",
    target: deviceView(target)
  });
  send(target.socket, { type: "viewer-joined", controllerId });
}

function handleFrame(socket, payload) {
  const sender = [...devices.values()].find((item) => item.socket === socket);
  if (!sender || sender.role !== "device") {
    return;
  }

  notifySubscribers(sender.deviceId, {
    type: "frame",
    deviceId: sender.deviceId,
    image: payload.image,
    width: payload.width,
    height: payload.height,
    timestamp: payload.timestamp || Date.now()
  });
}

function handleInput(socket, payload) {
  const sender = [...devices.values()].find((item) => item.socket === socket);
  if (!sender || sender.role !== "controller" || !sender.targetId) {
    return;
  }
  const target = devices.get(sender.targetId);
  if (!target?.socket) {
    send(socket, { type: "error", message: "target device is offline" });
    return;
  }
  send(target.socket, {
    type: "input",
    event: payload.event
  });
}

app.use(express.static(path.join(__dirname, "web")));
app.get("/api/devices", (_req, res) => {
  const onlineDevices = [...devices.values()]
    .filter((item) => item.role === "device")
    .map(deviceView);
  res.json({ devices: onlineDevices });
});

wss.on("connection", (socket) => {
  socket.on("message", (data) => {
    let payload;
    try {
      payload = JSON.parse(data.toString());
    } catch {
      send(socket, { type: "error", message: "invalid json" });
      return;
    }

    switch (payload.type) {
      case "register-device":
        handleDeviceRegister(socket, payload);
        break;
      case "register-controller":
        handleControllerRegister(socket, payload);
        break;
      case "frame":
        handleFrame(socket, payload);
        break;
      case "input":
        handleInput(socket, payload);
        break;
      case "ping":
        send(socket, { type: "pong", timestamp: Date.now() });
        break;
      default:
        send(socket, { type: "error", message: `unsupported type: ${payload.type}` });
    }
  });

  socket.on("close", () => unregister(socket));
  socket.on("error", () => unregister(socket));
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Relay server listening on http://0.0.0.0:${PORT}`);
});
