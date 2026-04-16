package com.example.natremote

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import android.provider.Settings
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.example.natremote.databinding.ActivityMainBinding
import com.example.natremote.relay.RelayForegroundService
import com.google.android.material.snackbar.Snackbar

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private lateinit var projectionManager: MediaProjectionManager

    private var pendingServerUrl = ""
    private var pendingDeviceId = ""
    private var pendingSecret = ""

    private val projectionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode != Activity.RESULT_OK || result.data == null) {
            binding.statusText.text = "Status: screen capture permission denied"
            Snackbar.make(binding.root, "Screen capture permission is required", Snackbar.LENGTH_SHORT).show()
            return@registerForActivityResult
        }

        val intent = Intent(this, RelayForegroundService::class.java).apply {
            action = RelayForegroundService.ACTION_START
            putExtra(RelayForegroundService.EXTRA_SERVER_URL, pendingServerUrl)
            putExtra(RelayForegroundService.EXTRA_DEVICE_ID, pendingDeviceId)
            putExtra(RelayForegroundService.EXTRA_SECRET, pendingSecret)
            putExtra(RelayForegroundService.EXTRA_RESULT_CODE, result.resultCode)
            putExtra(RelayForegroundService.EXTRA_RESULT_DATA, result.data)
        }
        startForegroundService(intent)
        binding.statusText.text = "Status: starting"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        projectionManager = getSystemService(MediaProjectionManager::class.java)

        binding.serverUrlInput.setText("ws://10.0.2.2:8080/ws")
        binding.deviceIdInput.setText("android-01")

        binding.startButton.setOnClickListener {
            pendingServerUrl = binding.serverUrlInput.text?.toString().orEmpty().trim()
            pendingDeviceId = binding.deviceIdInput.text?.toString().orEmpty().trim()
            pendingSecret = binding.secretInput.text?.toString().orEmpty().trim()

            if (pendingServerUrl.isBlank() || pendingDeviceId.isBlank() || pendingSecret.isBlank()) {
                Snackbar.make(binding.root, "Server URL, device ID and secret are required", Snackbar.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            projectionLauncher.launch(projectionManager.createScreenCaptureIntent())
        }

        binding.accessibilityButton.setOnClickListener {
            try {
                startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            } catch (_: ActivityNotFoundException) {
                Snackbar.make(binding.root, "Unable to open accessibility settings", Snackbar.LENGTH_SHORT).show()
            }
        }

        binding.stopButton.setOnClickListener {
            val intent = Intent(this, RelayForegroundService::class.java).apply {
                action = RelayForegroundService.ACTION_STOP
            }
            startService(intent)
            binding.statusText.text = "Status: stopped"
        }
    }
}
