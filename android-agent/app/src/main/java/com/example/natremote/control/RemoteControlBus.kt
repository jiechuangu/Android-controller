package com.example.natremote.control

import java.util.concurrent.CopyOnWriteArraySet

object RemoteControlBus {
    private val listeners = CopyOnWriteArraySet<(RemoteCommand) -> Unit>()

    fun subscribe(listener: (RemoteCommand) -> Unit) {
        listeners += listener
    }

    fun unsubscribe(listener: (RemoteCommand) -> Unit) {
        listeners -= listener
    }

    fun publish(command: RemoteCommand) {
        listeners.forEach { it(command) }
    }
}
