package com.example.natremote.relay

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject

class RelaySocketClient(
    private val serverUrl: String,
    private val onOpenAction: (WebSocket) -> Unit,
    private val onInputEvent: (JSONObject) -> Unit
) {
    private val httpClient = OkHttpClient()
    private var webSocket: WebSocket? = null

    fun connect() {
        val request = Request.Builder().url(serverUrl).build()
        webSocket = httpClient.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                onOpenAction(webSocket)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                val payload = JSONObject(text)
                if (payload.optString("type") == "input") {
                    onInputEvent(payload.getJSONObject("event"))
                }
            }
        })
    }

    fun close() {
        webSocket?.close(1000, "manual-stop")
    }
}
