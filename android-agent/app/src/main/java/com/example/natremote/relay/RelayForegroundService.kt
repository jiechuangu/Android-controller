package com.example.natremote.relay

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.example.natremote.control.RemoteCommand
import com.example.natremote.control.RemoteControlBus
import org.json.JSONArray
import org.json.JSONObject

class RelayForegroundService : Service() {
    private var client: RelaySocketClient? = null
    private var streamer: ScreenCaptureStreamer? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startRelay(intent)
            ACTION_STOP -> stopRelay()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        stopRelay()
        super.onDestroy()
    }

    private fun startRelay(intent: Intent) {
        val serverUrl = intent.getStringExtra(EXTRA_SERVER_URL).orEmpty()
        val deviceId = intent.getStringExtra(EXTRA_DEVICE_ID).orEmpty()
        val secret = intent.getStringExtra(EXTRA_SECRET).orEmpty()
        val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0)
        val resultData = intent.compatParcelableIntentExtra(EXTRA_RESULT_DATA) ?: return

        stopRelay(keepService = true)

        startForeground(
            NOTIFICATION_ID,
            buildNotification("Remote agent is running")
        )

        client = RelaySocketClient(
            serverUrl = serverUrl,
            onOpenAction = { socketClient ->
                socketClient.sendText(
                    JSONObject()
                        .put("type", "register-device")
                        .put("deviceId", deviceId)
                        .put("secret", secret)
                        .put("platform", "android")
                        .put(
                            "capabilities",
                            JSONArray(listOf("screen", "tap", "swipe", "navigation", "text"))
                        )
                        .toString()
                )
            },
            onInputEvent = { payload ->
                when (payload.optString("type")) {
                    "pointerdown" -> {
                        RemoteControlBus.publish(
                            RemoteCommand.Tap(
                                x = payload.optDouble("x").toFloat(),
                                y = payload.optDouble("y").toFloat()
                            )
                        )
                    }

                    "swipe" -> {
                        RemoteControlBus.publish(
                            RemoteCommand.Swipe(
                                x1 = payload.optDouble("x1").toFloat(),
                                y1 = payload.optDouble("y1").toFloat(),
                                x2 = payload.optDouble("x2").toFloat(),
                                y2 = payload.optDouble("y2").toFloat(),
                                durationMs = payload.optLong("duration", 240L)
                            )
                        )
                    }

                    "text" -> {
                        RemoteControlBus.publish(RemoteCommand.Text(payload.optString("value")))
                    }

                    "keydown" -> {
                        when (payload.optString("key")) {
                            "Escape" -> RemoteControlBus.publish(RemoteCommand.Back)
                            "Home" -> RemoteControlBus.publish(RemoteCommand.Home)
                            "RecentApps" -> RemoteControlBus.publish(RemoteCommand.RecentApps)
                        }
                    }
                }
            }
        )
        client?.connect()

        streamer = ScreenCaptureStreamer(
            context = this,
            resultCode = resultCode,
            resultData = resultData
        ) { width, height, data ->
            client?.sendFrame(width, height, data)
        }
        streamer?.start()
    }

    private fun stopRelay(keepService: Boolean = false) {
        streamer?.stop()
        streamer = null
        client?.close()
        client = null
        if (!keepService) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
    }

    private fun buildNotification(content: String): Notification {
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Nat Remote", NotificationManager.IMPORTANCE_LOW)
            )
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_warning)
            .setContentTitle("Nat Remote")
            .setContentText(content)
            .setOngoing(true)
            .build()
    }

    @Suppress("DEPRECATION")
    private fun Intent.compatParcelableIntentExtra(name: String): Intent? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getParcelableExtra(name, Intent::class.java)
        } else {
            getParcelableExtra(name)
        }
    }

    companion object {
        const val ACTION_START = "nat.remote.START"
        const val ACTION_STOP = "nat.remote.STOP"
        const val EXTRA_SERVER_URL = "server_url"
        const val EXTRA_DEVICE_ID = "device_id"
        const val EXTRA_SECRET = "secret"
        const val EXTRA_RESULT_CODE = "result_code"
        const val EXTRA_RESULT_DATA = "result_data"
        private const val CHANNEL_ID = "nat_remote"
        private const val NOTIFICATION_ID = 101
    }
}
