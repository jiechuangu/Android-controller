package com.example.natremote.control

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.os.Bundle
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class RemoteAccessibilityService : AccessibilityService() {
    private val listener: (RemoteCommand) -> Unit = { command ->
        when (command) {
            is RemoteCommand.Tap -> performRemoteTap(command.x, command.y)
            is RemoteCommand.Swipe -> performRemoteSwipe(
                x1 = command.x1,
                y1 = command.y1,
                x2 = command.x2,
                y2 = command.y2,
                durationMs = command.durationMs
            )

            is RemoteCommand.Text -> performRemoteText(command.value)
            RemoteCommand.Back -> performGlobalAction(GLOBAL_ACTION_BACK)
            RemoteCommand.Home -> performGlobalAction(GLOBAL_ACTION_HOME)
            RemoteCommand.RecentApps -> performGlobalAction(GLOBAL_ACTION_RECENTS)
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

    private fun performRemoteTap(x: Float, y: Float) {
        val path = Path().apply {
            moveTo(x, y)
            lineTo(x + 1f, y + 1f)
        }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 60))
            .build()
        dispatchGesture(gesture, null, null)
    }

    private fun performRemoteSwipe(
        x1: Float,
        y1: Float,
        x2: Float,
        y2: Float,
        durationMs: Long
    ) {
        val path = Path().apply {
            moveTo(x1, y1)
            lineTo(x2, y2)
        }
        val gesture = GestureDescription.Builder()
            .addStroke(
                GestureDescription.StrokeDescription(
                    path,
                    0,
                    durationMs.coerceAtLeast(80L)
                )
            )
            .build()
        dispatchGesture(gesture, null, null)
    }

    private fun performRemoteText(text: String) {
        if (text.isBlank()) {
            return
        }

        val target = rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
            ?: rootInActiveWindow?.let(::findEditableNode)
            ?: return

        val args = Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
        }
        target.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
    }

    private fun findEditableNode(node: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        if (node.isEditable) {
            return node
        }
        for (index in 0 until node.childCount) {
            val child = node.getChild(index) ?: continue
            val editable = findEditableNode(child)
            if (editable != null) {
                return editable
            }
        }
        return null
    }
}
