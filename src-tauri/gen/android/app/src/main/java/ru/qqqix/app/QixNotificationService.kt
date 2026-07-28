package ru.qqqix.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

/**
 * Keeps the app reachable while it is closed.
 *
 * The site delivers background notifications with Web Push through a service
 * worker. Neither exists in a Tauri webview, so this service holds the same
 * `/api/events` SSE stream the web client uses and turns the events into native
 * notifications. It is started from the frontend via a Rust command (see
 * `src-tauri/src/notifications.rs`) and remembers its settings so
 * [BootReceiver] can bring it back after a reboot.
 */
class QixNotificationService : Service() {
    private val running = AtomicBoolean(false)
    private var worker: Thread? = null

    @Volatile private var server: String = ""
    @Volatile private var token: String = ""

    /** Filled from /api/me/settings so we honour the user's notification prefs. */
    @Volatile private var notifyMessages = true

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        server = intent?.getStringExtra(EXTRA_SERVER) ?: prefs.getString(KEY_SERVER, "") ?: ""
        token = intent?.getStringExtra(EXTRA_TOKEN) ?: prefs.getString(KEY_TOKEN, "") ?: ""

        // Android kills us if startForeground is not called within a few seconds,
        // so the ongoing notification goes up before anything else.
        createChannels()
        startInForeground()

        if (server.isEmpty() || token.isEmpty()) {
            stopSelf()
            return START_NOT_STICKY
        }

        prefs.edit()
            .putString(KEY_SERVER, server)
            .putString(KEY_TOKEN, token)
            .putBoolean(KEY_ENABLED, true)
            .apply()

        if (running.compareAndSet(false, true)) {
            worker = thread(name = "qix-sse", isDaemon = true) { streamLoop() }
        }

        // START_STICKY: if the system reclaims us under memory pressure, come back.
        return START_STICKY
    }

    override fun onDestroy() {
        running.set(false)
        worker?.interrupt()
        worker = null
        super.onDestroy()
    }

    // ── Connection ────────────────────────────────────────────────────────────

    /**
     * Reconnecting SSE reader.
     *
     * The server never sends heartbeats, so an idle connection eventually dies
     * to a NAT timeout and surfaces as a read timeout — that is expected, not an
     * error, and simply reconnects. Real failures back off up to a minute so a
     * server outage does not drain the battery.
     */
    private fun streamLoop() {
        var backoffMs = 2_000L
        loadSettings()

        while (running.get()) {
            var connection: HttpURLConnection? = null
            try {
                connection = (URL("$server/api/events?t=$token").openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    setRequestProperty("Accept", "text/event-stream")
                    setRequestProperty("Cache-Control", "no-cache")
                    connectTimeout = 15_000
                    readTimeout = READ_TIMEOUT_MS
                    doInput = true
                }

                when (connection.responseCode) {
                    HttpURLConnection.HTTP_OK -> {
                        backoffMs = 2_000L
                        readStream(connection)
                    }
                    HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN -> {
                        // The session is gone; nothing to reconnect to.
                        Log.i(TAG, "session rejected, stopping service")
                        disable(this)
                        stopSelf()
                        return
                    }
                    else -> Log.w(TAG, "events returned ${connection.responseCode}")
                }
            } catch (e: InterruptedException) {
                return
            } catch (e: Exception) {
                // Read timeouts are the normal way an idle stream ends.
                Log.d(TAG, "stream ended: ${e.javaClass.simpleName}")
            } finally {
                connection?.disconnect()
            }

            if (!running.get()) return
            try {
                Thread.sleep(backoffMs)
            } catch (e: InterruptedException) {
                return
            }
            backoffMs = (backoffMs * 2).coerceAtMost(60_000L)
        }
    }

    /** Parses the `event:` / `data:` frames the server writes in lib/server/events.ts. */
    private fun readStream(connection: HttpURLConnection) {
        BufferedReader(InputStreamReader(connection.inputStream)).use { reader ->
            var event = ""
            val data = StringBuilder()

            while (running.get()) {
                val line = reader.readLine() ?: return

                when {
                    line.startsWith(":") -> Unit // comment / keep-alive
                    line.startsWith("event:") -> event = line.substring(6).trim()
                    line.startsWith("data:") -> data.append(line.substring(5).trim())
                    line.isEmpty() -> {
                        if (event.isNotEmpty() && data.isNotEmpty()) {
                            handleEvent(event, data.toString())
                        }
                        event = ""
                        data.setLength(0)
                    }
                }
            }
        }
    }

    private fun handleEvent(event: String, data: String) {
        try {
            when (event) {
                "chat_update" -> {
                    if (!notifyMessages) return
                    val chatId = JSONObject(data).optString("chatId")
                    if (chatId.isNotEmpty()) notifyChat(chatId)
                }
                "message_request" -> notify(
                    id = "request".hashCode(),
                    title = getString(R.string.app_name),
                    body = getString(R.string.notification_message_request),
                    href = "/requests"
                )
                "call_invite" -> {
                    val payload = JSONObject(data)
                    val from = payload.optJSONObject("from")
                    val name = from?.optString("displayName").takeUnless { it.isNullOrEmpty() }
                        ?: from?.optString("username").orEmpty()
                    notify(
                        id = "call".hashCode(),
                        title = name.ifEmpty { getString(R.string.app_name) },
                        body = getString(R.string.notification_incoming_call),
                        href = "/chat/${payload.optString("chatId")}"
                    )
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "bad $event payload", e)
        }
    }

    // ── Server lookups ────────────────────────────────────────────────────────

    private fun loadSettings() {
        val body = getJson("/api/me/settings") ?: return
        notifyMessages = body.optJSONObject("settings")?.optBoolean("notifyMessages", true) ?: true
    }

    /**
     * `chat_update` only carries a chat id, so the chat list is re-read to build
     * a notification that says who wrote and what — the same preview the web
     * client shows.
     */
    private fun notifyChat(chatId: String) {
        val chats = getJson("/api/chats")?.optJSONArray("chats") ?: return
        val chat = findChat(chats, chatId) ?: return
        if (chat.optBoolean("muted", false)) return

        val peer = chat.optJSONObject("peer")
        val channel = chat.optJSONObject("channel")
        val title = when {
            peer != null ->
                peer.optString("displayName").takeUnless { it.isNullOrEmpty() || it == "null" }
                    ?: peer.optString("username")
            channel != null -> channel.optString("title")
            else -> getString(R.string.app_name)
        }

        val last = chat.optJSONObject("lastMessage")
        val body = when {
            last == null -> return
            last.optBoolean("deleted", false) -> return
            // Encrypted bodies are opaque to us, exactly as they are to the server.
            last.optString("body").startsWith("e2ee:1:") ->
                getString(R.string.notification_encrypted)
            last.optString("kind") == "voice" -> getString(R.string.notification_voice)
            last.optString("kind") == "video" -> getString(R.string.notification_video)
            last.optString("body").isNotEmpty() -> last.optString("body")
            last.optBoolean("hasAttachment", false) -> getString(R.string.notification_photo)
            else -> getString(R.string.notification_new_message)
        }

        notify(id = chatId.hashCode(), title = title, body = body, href = "/chat/$chatId")
    }

    private fun findChat(chats: JSONArray, chatId: String): JSONObject? {
        for (i in 0 until chats.length()) {
            val chat = chats.optJSONObject(i) ?: continue
            if (chat.optString("id") == chatId) return chat
        }
        return null
    }

    private fun getJson(path: String): JSONObject? {
        var connection: HttpURLConnection? = null
        return try {
            connection = (URL("$server$path").openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                setRequestProperty("Authorization", "Bearer $token")
                connectTimeout = 10_000
                readTimeout = 10_000
            }
            if (connection.responseCode != HttpURLConnection.HTTP_OK) return null
            JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
        } catch (e: Exception) {
            Log.d(TAG, "GET $path failed: ${e.javaClass.simpleName}")
            null
        } finally {
            connection?.disconnect()
        }
    }

    // ── Notifications ─────────────────────────────────────────────────────────

    private fun createChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)

        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_MESSAGES,
                getString(R.string.channel_messages),
                NotificationManager.IMPORTANCE_HIGH
            )
        )

        // MIN keeps the mandatory "app is running" entry out of the way.
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_SERVICE,
                getString(R.string.channel_service),
                NotificationManager.IMPORTANCE_MIN
            ).apply { setShowBadge(false) }
        )
    }

    private fun startInForeground() {
        val notification = Notification.Builder(this, CHANNEL_SERVICE)
            .setContentTitle(getString(R.string.service_running))
            .setSmallIcon(R.drawable.ic_stat_qix)
            .setOngoing(true)
            .setContentIntent(openAppIntent(null, SERVICE_INTENT_ID))
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(SERVICE_NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(SERVICE_NOTIFICATION_ID, notification)
        }
    }

    private fun notify(id: Int, title: String, body: String, href: String?) {
        val notification = Notification.Builder(this, CHANNEL_MESSAGES)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(Notification.BigTextStyle().bigText(body))
            .setSmallIcon(R.drawable.ic_stat_qix)
            .setAutoCancel(true)
            .setContentIntent(openAppIntent(href, id))
            .build()

        getSystemService(NotificationManager::class.java).notify(id, notification)
    }

    /** Opens the app and, when given an href, routes it to that screen. */
    private fun openAppIntent(href: String?, requestCode: Int): PendingIntent {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            if (href != null) putExtra(MainActivity.EXTRA_HREF, href)
        }
        return PendingIntent.getActivity(
            this,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    companion object {
        private const val TAG = "QixNotifications"

        private const val PREFS = "qix_notifications"
        private const val KEY_SERVER = "server"
        private const val KEY_TOKEN = "token"
        private const val KEY_ENABLED = "enabled"

        private const val EXTRA_SERVER = "server"
        private const val EXTRA_TOKEN = "token"

        private const val CHANNEL_MESSAGES = "qix_messages"
        private const val CHANNEL_SERVICE = "qix_service"
        private const val SERVICE_NOTIFICATION_ID = 1
        private const val SERVICE_INTENT_ID = 0

        /** Long enough to be idle overnight, short enough to notice a dead socket. */
        private const val READ_TIMEOUT_MS = 5 * 60 * 1000

        /** Called from Rust via JNI when the user enables background notifications. */
        @JvmStatic
        fun start(context: Context, server: String, token: String) {
            try {
                val intent = Intent(context, QixNotificationService::class.java).apply {
                    putExtra(EXTRA_SERVER, server)
                    putExtra(EXTRA_TOKEN, token)
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start notification service: ${e.message}")
            }
        }

        @JvmStatic
        fun stop(context: Context) {
            try {
                disable(context)
                context.stopService(Intent(context, QixNotificationService::class.java))
            } catch (e: Exception) {
                Log.e(TAG, "Failed to stop notification service: ${e.message}")
            }
        }

        /** Clears the stored session so a reboot does not resurrect the service. */
        private fun disable(context: Context) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putBoolean(KEY_ENABLED, false)
                .remove(KEY_TOKEN)
                .apply()
        }

        /** Used by [BootReceiver] to decide whether to come back after a reboot. */
        @JvmStatic
        fun restartIfEnabled(context: Context) {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            if (!prefs.getBoolean(KEY_ENABLED, false)) return
            val server = prefs.getString(KEY_SERVER, "").orEmpty()
            val token = prefs.getString(KEY_TOKEN, "").orEmpty()
            if (server.isEmpty() || token.isEmpty()) return
            start(context, server, token)
        }
    }
}
