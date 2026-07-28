# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ── Qix ───────────────────────────────────────────────────────────────────────
# QixNotificationService.start/stop are called only from Rust over JNI
# (src-tauri/src/notifications.rs). R8 sees no Java-side caller, so without this
# it strips or renames them and background notifications silently stop working in
# release builds while debug builds keep passing.
-keep class ru.qqqix.app.QixNotificationService { *; }

# Instantiated by the system from the manifest's intent-filter.
-keep class ru.qqqix.app.BootReceiver { *; }

# Referenced by name when the service builds its PendingIntent.
-keep class ru.qqqix.app.MainActivity { *; }

# MainActivity$WebBridge is reached only from JavaScript through
# addJavascriptInterface, and it is an inner class, so the MainActivity rule
# above does not cover it. AGP's default proguard-android-optimize.txt already
# keeps @JavascriptInterface methods, but relying on that is a silent
# release-only failure waiting to happen — state it here too.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class ru.qqqix.app.MainActivity$WebBridge { *; }