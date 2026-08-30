package com.softbook.cet.audio

import android.net.Uri
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File

class SoftbookAudioPlayerModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext), LifecycleEventListener {
  private var player: ExoPlayer? = null
  private var preparePromise: Promise? = null
  private var playbackToken: String? = null
  private var hasRequestedPlayback = false
  private var listenerCount = 0

  init {
    reactContext.addLifecycleEventListener(this)
  }

  override fun getName() = NAME

  @ReactMethod
  fun prepare(filePath: String, token: String, promise: Promise) {
    reactContext.runOnUiQueueThread {
      if (filePath.isBlank() || token.isBlank()) {
        promise.reject("audio_invalid_input", "Audio input is invalid.")
        return@runOnUiQueueThread
      }

      releasePlayer("audio_replaced", "Audio preparation was replaced.")

      val source = File(filePath)
      if (!source.isFile) {
        promise.reject("audio_missing_file", "Verified audio file is unavailable.")
        return@runOnUiQueueThread
      }

      val newPlayer = ExoPlayer.Builder(reactContext).build()
      playbackToken = token
      hasRequestedPlayback = false
      preparePromise = promise
      player = newPlayer
      newPlayer.setAudioAttributes(
        AudioAttributes.Builder()
          .setContentType(C.AUDIO_CONTENT_TYPE_SPEECH)
          .setUsage(C.USAGE_MEDIA)
          .build(),
        true,
      )
      newPlayer.addListener(
        object : Player.Listener {
          override fun onPlaybackStateChanged(playbackState: Int) {
            if (player !== newPlayer) return

            if (playbackState == Player.STATE_READY) {
              preparePromise?.resolve(null)
              preparePromise = null
            } else if (playbackState == Player.STATE_ENDED) {
              sendEvent("ended")
            }
          }

          override fun onPlayerError(error: PlaybackException) {
            if (player !== newPlayer) return
            preparePromise?.reject("audio_prepare_failed", "Audio preparation failed.")
            preparePromise = null
            sendEvent("error")
          }

          override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) {
            if (
              player === newPlayer &&
                !playWhenReady &&
                reason == Player.PLAY_WHEN_READY_CHANGE_REASON_AUDIO_FOCUS_LOSS
            ) {
              sendEvent("interruption")
            }
          }
        },
      )
      newPlayer.setMediaItem(MediaItem.fromUri(Uri.fromFile(source)))
      newPlayer.prepare()
    }
  }

  @ReactMethod
  fun play(token: String, promise: Promise) {
    reactContext.runOnUiQueueThread {
      val currentPlayer = player
      if (
        currentPlayer == null ||
          playbackToken != token ||
          currentPlayer.playbackState != Player.STATE_READY
      ) {
        promise.reject("audio_not_ready", "Audio is not ready.")
        return@runOnUiQueueThread
      }

      currentPlayer.play()
      hasRequestedPlayback = true
      promise.resolve(null)
    }
  }

  @ReactMethod
  fun pause(token: String, promise: Promise) {
    reactContext.runOnUiQueueThread {
      val currentPlayer = player
      if (currentPlayer == null || playbackToken != token) {
        promise.reject("audio_not_ready", "Audio is not ready.")
        return@runOnUiQueueThread
      }
      currentPlayer.pause()
      promise.resolve(null)
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    reactContext.runOnUiQueueThread {
      releasePlayer("audio_stopped", "Audio preparation was stopped.")
      promise.resolve(null)
    }
  }

  @ReactMethod
  fun addListener(eventName: String) {
    if (eventName == EVENT_NAME) listenerCount += 1
  }

  @ReactMethod
  fun removeListeners(count: Double) {
    listenerCount = (listenerCount - count.toInt()).coerceAtLeast(0)
  }

  override fun onHostResume() = Unit

  override fun onHostPause() {
    if (
      player != null &&
        playbackToken != null &&
        hasRequestedPlayback
    ) {
      player?.pause()
      sendEvent("interruption")
    } else if (
      preparePromise != null ||
        (playbackToken != null && !hasRequestedPlayback)
    ) {
      cancelPendingOrReadyPlaybackForInterruption()
    }
  }

  override fun onHostDestroy() {
    releasePlayer("audio_destroyed", "Audio player was destroyed.")
  }

  override fun invalidate() {
    reactContext.removeLifecycleEventListener(this)
    releasePlayer("audio_invalidated", "Audio player was invalidated.")
    super.invalidate()
  }

  private fun releasePlayer(code: String, message: String) {
    preparePromise?.reject(code, message)
    preparePromise = null
    player?.release()
    player = null
    playbackToken = null
    hasRequestedPlayback = false
  }

  private fun sendEvent(type: String) {
    val token = playbackToken ?: return
    sendEvent(type, token, false)
  }

  private fun sendEvent(type: String, token: String, requiresPrepare: Boolean) {
    if (listenerCount <= 0) return
    val payload = Arguments.createMap().apply {
      putString("type", type)
      putString("playbackToken", token)
      if (requiresPrepare) putBoolean("requiresPrepare", true)
    }
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(EVENT_NAME, payload)
  }

  private fun cancelPendingOrReadyPlaybackForInterruption() {
    val interruptedToken = playbackToken ?: return
    val interruptedPreparePromise = preparePromise
    preparePromise = null
    val interruptedPlayer = player
    player = null
    playbackToken = null
    hasRequestedPlayback = false
    interruptedPlayer?.release()
    sendEvent("interruption", interruptedToken, true)
    interruptedPreparePromise?.reject(
      "audio_prepare_interrupted",
      "Audio preparation was interrupted.",
    )
  }

  companion object {
    private const val NAME = "SoftbookAudioPlayer"
    private const val EVENT_NAME = "SoftbookAudioPlayerEvent"
  }
}
