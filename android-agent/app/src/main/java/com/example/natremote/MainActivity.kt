package com.example.natremote

import android.content.ActivityNotFoundException
import android.content.Intent
import android.provider.Settings
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.example.natremote.databinding.ActivityMainBinding
import com.example.natremote.relay.RelayForegroundService
import com.google.android.material.snackbar.Snackbar

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.serverUrlInput.setText("ws://10.0.2.2:8080/ws")
        binding.deviceIdInput.setText("android-01")

        binding.startButton.setOnClickListener {
            val intent = Intent(this, RelayForegroundService::class.java).apply {
                action = RelayForegroundService.ACTION_START
                putExtra(RelayForegroundService.EXTRA_SERVER_URL, binding.serverUrlInput.text?.toString().orEmpty())
                putExtra(RelayForegroundService.EXTRA_DEVICE_ID, binding.deviceIdInput.text?.toString().orEmpty())
                putExtra(RelayForegroundService.EXTRA_SECRET, binding.secretInput.text?.toString().orEmpty())
            }
            startForegroundService(intent)
            binding.statusText.text = "状态：启动中"
        }

        binding.accessibilityButton.setOnClickListener {
            try {
                startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            } catch (_: ActivityNotFoundException) {
                Snackbar.make(binding.root, "无法打开无障碍设置", Snackbar.LENGTH_SHORT).show()
            }
        }

        binding.stopButton.setOnClickListener {
            val intent = Intent(this, RelayForegroundService::class.java).apply {
                action = RelayForegroundService.ACTION_STOP
            }
            startService(intent)
            binding.statusText.text = "状态：已停止"
        }
    }
}
