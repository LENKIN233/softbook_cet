package com.softbook.cet.runtime

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.softbook.cet.BuildConfig
import java.io.IOException

class SoftbookAppInfoModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName() = NAME

  override fun getConstants(): Map<String, Any> = mapOf(
    "platform" to "android",
    "releaseRuntimeProfileJson" to readReleaseRuntimeProfile(),
    "version" to BuildConfig.VERSION_NAME,
  )

  private fun readReleaseRuntimeProfile(): String = try {
    reactApplicationContext.assets
      .open("softbook-release-runtime-profile.json")
      .bufferedReader(Charsets.UTF_8)
      .use { it.readText() }
  } catch (_: IOException) {
    ""
  }

  companion object {
    private const val NAME = "SoftbookAppInfo"
  }
}
