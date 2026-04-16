package com.example.natremote.relay

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Handler
import android.os.HandlerThread
import android.util.Base64
import java.io.ByteArrayOutputStream

class ScreenCaptureStreamer(
    private val context: Context,
    resultCode: Int,
    resultData: Intent,
    private val onFrame: (width: Int, height: Int, data: String) -> Unit
) {
    private val projectionManager = context.getSystemService(MediaProjectionManager::class.java)
    private val displayMetrics = context.resources.displayMetrics
    private val width = displayMetrics.widthPixels
    private val height = displayMetrics.heightPixels
    private val densityDpi = displayMetrics.densityDpi
    private val imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
    private val handlerThread = HandlerThread("screen-capture-thread")
    private lateinit var handler: Handler
    private val mediaProjection: MediaProjection =
        projectionManager.getMediaProjection(resultCode, resultData)
    private var virtualDisplay: VirtualDisplay? = null
    private var lastFrameAt = 0L

    fun start() {
        handlerThread.start()
        handler = Handler(handlerThread.looper)

        imageReader.setOnImageAvailableListener({ reader ->
            val now = System.currentTimeMillis()
            if (now - lastFrameAt < 350L) {
                reader.acquireLatestImage()?.close()
                return@setOnImageAvailableListener
            }

            val image = reader.acquireLatestImage() ?: return@setOnImageAvailableListener
            try {
                val plane = image.planes[0]
                val buffer = plane.buffer
                val pixelStride = plane.pixelStride
                val rowStride = plane.rowStride
                val rowPadding = rowStride - pixelStride * width
                val bitmap = Bitmap.createBitmap(
                    width + rowPadding / pixelStride,
                    height,
                    Bitmap.Config.ARGB_8888
                )
                bitmap.copyPixelsFromBuffer(buffer)
                val croppedBitmap = Bitmap.createBitmap(bitmap, 0, 0, width, height)
                bitmap.recycle()

                val output = ByteArrayOutputStream()
                croppedBitmap.compress(Bitmap.CompressFormat.JPEG, 45, output)
                croppedBitmap.recycle()

                val encoded = Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP)
                lastFrameAt = now
                onFrame(width, height, encoded)
            } finally {
                image.close()
            }
        }, handler)

        virtualDisplay = mediaProjection.createVirtualDisplay(
            "NatRemoteDisplay",
            width,
            height,
            densityDpi,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader.surface,
            null,
            handler
        )
    }

    fun stop() {
        imageReader.setOnImageAvailableListener(null, null)
        virtualDisplay?.release()
        mediaProjection.stop()
        handlerThread.quitSafely()
    }
}
