package com.example.natremote.control

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.view.accessibility.AccessibilityEvent

class RemoteAccessibilityService : AccessibilityService() {
    private val listener: (RemoteCommand) -> Unit = { command ->
        when (command) {
            is RemoteCommand.Tap -> performRemoteTap(command.x, command.y)
            is RemoteCommand.Move -> Unit
            RemoteCommand.Release -> Unit
            RemoteCommand.Back -> performGlobalAction(GLOBAL_ACTION_BACK)
            RemoteCommand.Home -> performGlobalAction(GLOBAL_ACTION_HOME)
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit

    override fun onInterrupt() = Unit

    override fun onServiceConnected() {
        super.onServiceConnected()
        RemoteControlBus.subscribe(listener)
    }

    override fun onDestroy() {
        RemoteControlBus.unsubscribe(listener)
        super.onDestroy()
    }

    fun performRemoteTap(x: Float, y: Float) {
        val path = Path().apply {
            moveTo(x, y)
        }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 50))
            .build()
        dispatchGesture(gesture, null, null)
    }
}
