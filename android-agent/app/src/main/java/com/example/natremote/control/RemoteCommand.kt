package com.example.natremote.control

sealed class RemoteCommand {
    data class Tap(val x: Float, val y: Float) : RemoteCommand()

    data class Swipe(
        val x1: Float,
        val y1: Float,
        val x2: Float,
        val y2: Float,
        val durationMs: Long
    ) : RemoteCommand()

    data class Text(val value: String) : RemoteCommand()

    object Back : RemoteCommand()
    object Home : RemoteCommand()
    object RecentApps : RemoteCommand()
}
