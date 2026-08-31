package com.softbook.cet

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import org.json.JSONObject

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "SoftbookCET"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {
        override fun getLaunchOptions(): Bundle? {
          val baseUrl = BuildConfig.SOFTBOOK_LOCAL_PRODUCT_BASE_URL.trim()
          if (!BuildConfig.DEBUG || baseUrl.isEmpty()) {
            return null
          }

          val remoteProfile = Bundle().apply {
            putString("baseUrl", baseUrl)
            putString("learningTrack", BuildConfig.SOFTBOOK_LOCAL_PRODUCT_TRACK)
            val publicKeysJson =
                BuildConfig.SOFTBOOK_LOCAL_PRODUCT_PUBLIC_KEYS.trim()
            if (publicKeysJson.isNotEmpty()) {
              val publicKeys = Bundle()
              val parsed = JSONObject(publicKeysJson)
              parsed.keys().forEach { key ->
                publicKeys.putString(key, parsed.getString(key))
              }
              putBundle("contentManifestPublicKeys", publicKeys)
            }
          }
          return Bundle().apply {
            putBundle("softbookRemoteRuntimeProfile", remoteProfile)
          }
        }
      }
}
