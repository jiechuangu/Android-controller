package com.example.natremote.control

sealed class RemoteCommand {
    data class Tap(val x: Float, val y: Float) : RemoteCommand()
    data class Move(val x: Float, val y: Float) : RemoteCommand()
    object Release : RemoteCommand()
    object Back : RemoteCommand()
    object Home : RemoteCommand()
}
