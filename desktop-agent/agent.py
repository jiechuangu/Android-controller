import base64
import io
import json
import sys
import threading
import time
from pathlib import Path

import mss
import pyautogui
from PIL import Image
from websocket import WebSocketApp

pyautogui.FAILSAFE = False


class DesktopAgent:
    def __init__(self, config_path: Path):
        self.config = json.loads(config_path.read_text(encoding="utf-8"))
        self.ws = None
        self.running = True
        self.latest_size = (0, 0)

    def register(self):
        self.ws.send(
            json.dumps(
                {
                    "type": "register-device",
                    "deviceId": self.config["device_id"],
                    "secret": self.config["secret"],
                    "platform": "windows-desktop",
                    "capabilities": ["screen", "mouse", "keyboard"]
                }
            )
        )

    def capture_loop(self):
        fps = max(1, int(self.config.get("fps", 3)))
        delay = 1 / fps
        with mss.mss() as sct:
            monitor = sct.monitors[1]
            while self.running:
                if not self.ws or not self.ws.sock or not self.ws.sock.connected:
                    time.sleep(1)
                    continue

                shot = sct.grab(monitor)
                image = Image.frombytes("RGB", shot.size, shot.rgb)
                self.latest_size = image.size
                buffer = io.BytesIO()
                image.save(buffer, format="JPEG", quality=50, optimize=True)
                encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
                self.ws.send(
                    json.dumps(
                        {
                            "type": "frame",
                            "width": image.width,
                            "height": image.height,
                            "image": encoded,
                            "timestamp": int(time.time() * 1000)
                        }
                    )
                )
                time.sleep(delay)

    def handle_input(self, event):
        kind = event.get("type")
        if kind in {"pointerdown", "pointermove", "pointerup"}:
            x = int(event.get("x", 0))
            y = int(event.get("y", 0))
            pyautogui.moveTo(x, y)
            if kind == "pointerdown":
                pyautogui.mouseDown()
            elif kind == "pointerup":
                pyautogui.mouseUp()
            return

        if kind == "keydown":
            key = self.normalize_key(event.get("key", ""))
            modifiers = [
                alias
                for pressed, alias in (
                    (event.get("ctrlKey"), "ctrl"),
                    (event.get("altKey"), "alt"),
                    (event.get("shiftKey"), "shift"),
                    (event.get("metaKey"), "win"),
                )
                if pressed
            ]
            if not key:
                return
            if modifiers:
                pyautogui.hotkey(*modifiers, key)
            else:
                pyautogui.press(key)

    @staticmethod
    def normalize_key(key):
        if not key:
            return None
        special = {
            "ArrowUp": "up",
            "ArrowDown": "down",
            "ArrowLeft": "left",
            "ArrowRight": "right",
            "Escape": "esc",
            "Enter": "enter",
            "Backspace": "backspace",
            "Delete": "delete",
            "Tab": "tab",
            " ": "space"
        }
        if key in special:
            return special[key]
        if len(key) == 1:
            return key.lower()
        return None

    def on_open(self, ws):
        self.ws = ws
        self.register()

    def on_message(self, _ws, message):
        payload = json.loads(message)
        if payload.get("type") == "input":
            self.handle_input(payload["event"])
        elif payload.get("type") == "error":
            print(f"server error: {payload['message']}", file=sys.stderr)

    def on_close(self, _ws, status, message):
        print(f"disconnected: {status} {message}")

    def on_error(self, _ws, error):
        print(f"socket error: {error}", file=sys.stderr)

    def run(self):
        threading.Thread(target=self.capture_loop, daemon=True).start()
        while self.running:
            self.ws = WebSocketApp(
                self.config["server_url"],
                on_open=self.on_open,
                on_message=self.on_message,
                on_close=self.on_close,
                on_error=self.on_error,
            )
            self.ws.run_forever()
            time.sleep(3)


if __name__ == "__main__":
    config_path = Path(sys.argv[1] if len(sys.argv) > 1 else "config.json")
    if not config_path.exists():
        raise SystemExit(f"config file not found: {config_path}")

    DesktopAgent(config_path).run()
