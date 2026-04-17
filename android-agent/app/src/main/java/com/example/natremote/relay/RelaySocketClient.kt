package com.example.natremote.relay

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class RelaySocketClient(
    private val serverUrl: String,
    private val onOpenAction: (RelaySocketClient) -> Unit,
    private val onInputEvent: (JSONObject) -> Unit
) {
    private val httpClient = OkHttpClient.Builder()
        .retryOnConnectionFailure(true)
        .pingInterval(20, TimeUnit.SECONDS)
        .build()

    private var webSocket: WebSocket? = null

    fun connect() {
        val request = Request.Builder().url(serverUrl).build()
        webSocket = httpClient.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                this@RelaySocketClient.webSocket = webSocket
                onOpenAction(this@RelaySocketClient)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                val payload = JSONObject(text)
                if (payload.optString("type") == "input") {
                    onInputEvent(payload.getJSONObject("event"))
                }
            }
        })
    }

    fun sendText(payload: String) {
        webSocket?.send(payload)
    }

    fun sendFrame(width: Int, height: Int, base64Jpeg: String) {
        val payload = JSONObject()
            .put("type", "frame")
            .put("width", width)
            .put("height", height)
            .put("image", base64Jpeg)
            .put("timestamp", System.currentTimeMillis())
            .toString()
        sendText(payload)
    }

    fun close() {
        webSocket?.close(1000, "manual-stop")
    }
}
