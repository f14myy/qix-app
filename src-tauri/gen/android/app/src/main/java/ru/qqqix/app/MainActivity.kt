package ru.qqqix.app

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : TauriActivity() {
    private var webView: WebView? = null

    /**
     * Set when the activity is launched by tapping a notification, and delivered
     * to the frontend once the WebView exists. The frontend listens for
     * `qix-open-href` (see src/routes/+layout.svelte).
     */
    private var pendingHref: String? = null

    private val prefs by lazy { getSharedPreferences(PREFS, Context.MODE_PRIVATE) }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        // Give the Rust notification bridge the JavaVM + ApplicationContext
        // before any Tauri IPC command can run.
        initNotificationBridge()

        // The window is what shows during the cold start, before the WebView has
        // painted anything. Left at the Material default it follows the *system*
        // theme, so a dark-themed app on a light phone flashes white — and the
        // reverse. The last colour the frontend reported is a much better guess.
        window.setBackgroundDrawable(ColorDrawable(storedBackgroundColor()))
        applySystemBarAppearance(prefs.getBoolean(KEY_DARK, false))

        pendingHref = intent?.getStringExtra(EXTRA_HREF)
        requestNotificationPermission()
    }

    override fun onResume() {
        super.onResume()
        // A configuration change can reset the controller flags behind our back.
        applySystemBarAppearance(prefs.getBoolean(KEY_DARK, false))
        pendingHref?.let {
            if (deliverHref(it)) pendingHref = null
        }
    }

    /**
     * `launchMode` is singleTask, so tapping a notification while the app is
     * already open reuses this instance instead of calling onCreate again.
     */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val href = intent.getStringExtra(EXTRA_HREF) ?: return
        if (!deliverHref(href)) pendingHref = href
    }

    /** wry calls this once the WebView is attached. */
    override fun onWebViewCreate(webView: WebView) {
        this.webView = webView
        // Local, CSP-restricted content only, and `frame-src 'none'` keeps any
        // third-party frame from reaching this object.
        webView.addJavascriptInterface(WebBridge(), BRIDGE_NAME)
        applyWindowInsets(webView)
        pendingHref?.let {
            if (deliverHref(it)) pendingHref = null
        }
    }

    // ── Bridge ────────────────────────────────────────────────────────────────

    /**
     * Lets the frontend drive the parts of the system UI that CSS cannot reach.
     *
     * Qix picks its own theme and palette in localStorage, independent of the
     * phone's dark mode. Android does not know that, so without this the status
     * bar icons follow the *system* setting: a light Qix look on a dark phone
     * draws white icons on a near-white header and the clock disappears.
     */
    inner class WebBridge {
        /**
         * @param dark whether the app is currently rendering its dark theme
         * @param color the resolved surface colour behind the system bars
         */
        @JavascriptInterface
        fun setSystemBars(dark: Boolean, color: String) {
            val parsed = runCatching { Color.parseColor(color) }.getOrNull()
            prefs.edit()
                .putBoolean(KEY_DARK, dark)
                .apply { if (parsed != null) putInt(KEY_BG, parsed) }
                .apply()

            runOnUiThread {
                applySystemBarAppearance(dark)
                if (parsed != null) window.setBackgroundDrawable(ColorDrawable(parsed))
            }
        }

        /**
         * Re-runs the inset listener.
         *
         * Insets are first delivered when the WebView is attached, which can be
         * before the document exists — the script that writes `--safe-*` would
         * then land on nothing and the safe areas would stay at zero until the
         * next rotation. The frontend calls this once it has mounted.
         */
        @JavascriptInterface
        fun requestInsets() {
            runOnUiThread { webView?.let { ViewCompat.requestApplyInsets(it) } }
        }
    }

    private fun storedBackgroundColor(): Int =
        prefs.getInt(KEY_BG, Color.parseColor(DEFAULT_BG))

    /**
     * Dark app → light icons, light app → dark icons. The bars themselves stay
     * transparent; the page draws its own colour underneath them.
     */
    private fun applySystemBarAppearance(dark: Boolean) {
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.isAppearanceLightStatusBars = !dark
        controller.isAppearanceLightNavigationBars = !dark
    }

    // ── Insets ────────────────────────────────────────────────────────────────

    /**
     * Feeds the real window insets to the stylesheet, and makes room for the
     * keyboard.
     *
     * Safe areas: the layout is edge-to-edge and the CSS positions its chrome
     * with `--safe-top` / `--safe-bottom`, which tokens.css derives from
     * `env(safe-area-inset-*)`. The Android WebView reports those inconsistently
     * across versions — often as 0 — which puts the top bar under the status bar
     * and the tab bar under the gesture pill.
     *
     * Keyboard: with edge-to-edge enforced on recent Android, `adjustResize` no
     * longer shrinks the window, so the composer ends up behind the keyboard.
     * Padding the WebView shrinks its viewport for real, which keeps
     * `window.innerHeight` and `visualViewport` in agreement and lets the
     * existing chat layout do the rest.
     */
    private fun applyWindowInsets(webView: WebView) {
        ViewCompat.setOnApplyWindowInsetsListener(webView) { view, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
            val density = resources.displayMetrics.density.takeIf { it > 0f } ?: 1f

            view.setPadding(0, 0, 0, ime)

            val top = (bars.top / density).toInt()
            val left = (bars.left / density).toInt()
            val right = (bars.right / density).toInt()
            // While the keyboard is up it covers the navigation bar, and the
            // padding above already accounts for the whole gap — adding the bar
            // inset on top of it would leave a dead strip under the composer.
            val bottom = if (ime > 0) 0 else (bars.bottom / density).toInt()

            view.post {
                webView.evaluateJavascript(
                    """
                    (function(){
                      var s = document.documentElement.style;
                      s.setProperty('--safe-top', '${top}px');
                      s.setProperty('--safe-bottom', '${bottom}px');
                      s.setProperty('--safe-left', '${left}px');
                      s.setProperty('--safe-right', '${right}px');
                    })();
                    """.trimIndent(),
                    null
                )
            }
            insets
        }
        ViewCompat.requestApplyInsets(webView)
    }

    // ── Notification routing ──────────────────────────────────────────────────

    /**
     * Hands the target route to the frontend router. Returns false while the
     * WebView is not ready yet, so the caller can hold on to it.
     */
    private fun deliverHref(href: String): Boolean {
        val view = webView ?: return false
        val payload = org.json.JSONObject().put("href", href).toString()
        view.post {
            view.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('qix-open-href',{detail:$payload}))",
                null
            )
        }
        return true
    }

    /**
     * Android 13+ will silently drop notifications without this. Asked for once
     * at launch; the background service is useless if it is denied.
     */
    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        val granted = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
        if (granted) return
        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.POST_NOTIFICATIONS),
            REQUEST_NOTIFICATIONS
        )
    }

    /** Passes the JavaVM and Application context to the Rust notification bridge. */
    private external fun initNotificationBridge()

    companion object {
        const val EXTRA_HREF = "qix_href"
        const val BRIDGE_NAME = "QixNative"

        private const val REQUEST_NOTIFICATIONS = 8801
        private const val PREFS = "qix_ui"
        private const val KEY_DARK = "theme_dark"
        private const val KEY_BG = "bg_color"

        /** Matches the default `citrus` light surface in tokens.css. */
        private const val DEFAULT_BG = "#f7f9ec"
    }
}
