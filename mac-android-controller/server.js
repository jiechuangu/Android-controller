import express from "express";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const PORT = Number(process.env.PORT || 8090);
const ADB_PATH = process.env.ADB_PATH || "adb";

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "web")));

function quote(value) {
  return String(value ?? "").replace(/'/g, "'\\''");
}

async function adb(args, options = {}) {
  return execFileAsync(ADB_PATH, args, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    ...options
  });
}

async function adbShell(serial, command) {
  const args = serial ? ["-s", serial, "shell", command] : ["shell", command];
  const { stdout } = await adb(args);
  return stdout.trim();
}

function getRequiredText(input, fieldName) {
  const value = String(input ?? "").trim();
  if (!value) {
    throw new Error(`${fieldName} is required`);
  }
  return value;
}

async function listDevices() {
  const { stdout } = await adb(["devices", "-l"]);
  return stdout
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("*"))
    .map((line) => {
      const [serial, state, ...rest] = line.split(/\s+/);
      const fields = Object.fromEntries(
        rest
          .filter((token) => token.includes(":"))
          .map((token) => {
            const [key, ...value] = token.split(":");
            return [key, value.join(":")];
          })
      );
      return {
        serial,
        state,
        model: fields.model || "unknown",
        device: fields.device || "unknown",
        transportId: fields.transport_id || ""
      };
    });
}

async function getDisplayInfo(serial) {
  const wmSize = await adbShell(serial, "wm size");
  const match = wmSize.match(/Physical size:\s*(\d+)x(\d+)/i) || wmSize.match(/Override size:\s*(\d+)x(\d+)/i);
  if (!match) {
    return { width: 1080, height: 1920 };
  }
  return {
    width: Number(match[1]),
    height: Number(match[2])
  };
}

function normalizeAndroidText(text) {
  return String(text)
    .replace(/%/g, "%s")
    .replace(/ /g, "%s")
    .replace(/&/g, "\\&")
    .replace(/</g, "\\<")
    .replace(/>/g, "\\>")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

async function runAction(serial, action) {
  switch (action.type) {
    case "tap":
      await adbShell(serial, `input tap ${Math.round(action.x)} ${Math.round(action.y)}`);
      return;
    case "swipe":
      await adbShell(
        serial,
        `input swipe ${Math.round(action.x1)} ${Math.round(action.y1)} ${Math.round(action.x2)} ${Math.round(action.y2)} ${Math.max(50, Math.round(action.duration || 220))}`
      );
      return;
    case "keyevent":
      await adbShell(serial, `input keyevent ${quote(action.keycode)}`);
      return;
    case "text":
      await adbShell(serial, `input text '${normalizeAndroidText(action.text)}'`);
      return;
    default:
      throw new Error(`Unsupported action type: ${action.type}`);
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, adbPath: ADB_PATH });
});

app.get("/api/devices", async (_req, res) => {
  try {
    res.json({ devices: await listDevices() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/display/:serial", async (req, res) => {
  try {
    res.json(await getDisplayInfo(req.params.serial));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/frame/:serial", async (req, res) => {
  try {
    const args = ["-s", req.params.serial, "exec-out", "screencap", "-p"];
    const { stdout } = await adb(args, { encoding: "buffer" });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    res.send(stdout);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/action/:serial", async (req, res) => {
  try {
    await runAction(req.params.serial, req.body);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/adb/connect", async (req, res) => {
  try {
    const target = getRequiredText(req.body?.target, "target");
    const { stdout, stderr } = await adb(["connect", target]);
    const output = `${stdout}\n${stderr}`.trim();
    res.json({ ok: true, target, output });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/adb/disconnect", async (req, res) => {
  try {
    const target = String(req.body?.target ?? "").trim();
    const args = target ? ["disconnect", target] : ["disconnect"];
    const { stdout, stderr } = await adb(args);
    const output = `${stdout}\n${stderr}`.trim();
    res.json({ ok: true, target, output });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/adb/tcpip", async (req, res) => {
  try {
    const serial = getRequiredText(req.body?.serial, "serial");
    const portRaw = Number(req.body?.port ?? 5555);
    const port = Number.isInteger(portRaw) ? portRaw : 5555;
    if (port < 1 || port > 65535) {
      throw new Error("port must be in range 1-65535");
    }
    const { stdout, stderr } = await adb(["-s", serial, "tcpip", String(port)]);
    const output = `${stdout}\n${stderr}`.trim();
    res.json({ ok: true, serial, port, output });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Mac Android controller listening on http://127.0.0.1:${PORT}`);
});
