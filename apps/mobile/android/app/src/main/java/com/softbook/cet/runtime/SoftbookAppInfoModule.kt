package com.softbook.cet.runtime

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.softbook.cet.BuildConfig

class SoftbookAppInfoModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName() = NAME

  override fun getConstants(): Map<String, Any> = mapOf(
    "platform" to "android",
    "version" to BuildConfig.VERSION_NAME,
  )

  companion object {
    private const val NAME = "SoftbookAppInfo"
  }
}
