package com.example.natremote.relay

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.example.natremote.R
import com.example.natremote.control.RemoteCommand
import com.example.natremote.control.RemoteControlBus
import org.json.JSONObject

class RelayForegroundService : Service() {
    private var client: RelaySocketClient? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                startForeground(NOTIFICATION_ID, buildNotification("代理运行中"))
                val serverUrl = intent.getStringExtra(EXTRA_SERVER_URL).orEmpty()
                val deviceId = intent.getStringExtra(EXTRA_DEVICE_ID).orEmpty()
                val secret = intent.getStringExtra(EXTRA_SECRET).orEmpty()
                client?.close()
                client = RelaySocketClient(
                    serverUrl = serverUrl,
                    onOpenAction = { socket ->
                        socket.send(
                            JSONObject()
                                .put("type", "register-device")
                                .put("deviceId", deviceId)
                                .put("secret", secret)
                                .put("platform", "android")
                                .put("capabilities", listOf("touch", "screen"))
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

                            "keydown" -> {
                                when (payload.optString("key")) {
                                    "Escape" -> RemoteControlBus.publish(RemoteCommand.Back)
                                    "Home" -> RemoteControlBus.publish(RemoteCommand.Home)
                                }
                            }
                        }
                    }
                )
                client?.connect()
            }

            ACTION_STOP -> {
                client?.close()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }

        return START_STICKY
    }

    private fun buildNotification(content: String): Notification {
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Nat Remote", NotificationManager.IMPORTANCE_LOW)
            )
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Nat Remote")
            .setContentText(content)
            .build()
    }

    companion object {
        const val ACTION_START = "nat.remote.START"
        const val ACTION_STOP = "nat.remote.STOP"
        const val EXTRA_SERVER_URL = "server_url"
        const val EXTRA_DEVICE_ID = "device_id"
        const val EXTRA_SECRET = "secret"
        private const val CHANNEL_ID = "nat_remote"
        private const val NOTIFICATION_ID = 101
    }
}
