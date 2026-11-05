package com.ad3333m.kurdishtv

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.hls.HlsMediaSource
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.net.CookieHandler
import java.net.CookieManager
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Kurdish TV for Google TV (built for a BRAVIA 8). The guide, channel list and on-screen banner are one web page
 * (assets/index.html) in a transparent WebView; the picture is a native ExoPlayer underneath it, so live HLS runs
 * on the TV's hardware decoder. The page asks for a channel with Native.play(); this tries the channel's sources in
 * order and answers with app.onState(). A `page` source is the channel's own live page: it is read for the stream
 * its website player uses, because some channels (KurdMax) rename their streams.
 */
class MainActivity : Activity() {

    private lateinit var web: WebView
    private lateinit var player: ExoPlayer
    private val main = Handler(Looper.getMainLooper())
    private val io = Executors.newSingleThreadExecutor()
    private var sources = emptyList<JSONObject>()
    private var next = 0
    private var channel = ""
    private var tune = 0            // bumps on every play/stop, so a late answer for an old channel is dropped
    private var visible = true

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        CookieHandler.setDefault(CookieManager())   // some live pages set a cookie, then redirect to themselves

        player = ExoPlayer.Builder(this).build()
        player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_BUFFERING) report("buffering")
                if (state == Player.STATE_READY) report("playing")
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (isPlaying) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }

            override fun onPlayerError(error: PlaybackException) {
                if (error.errorCode == PlaybackException.ERROR_CODE_BEHIND_LIVE_WINDOW) {
                    player.seekToDefaultPosition()
                    player.prepare()
                } else {
                    tryNext(tune)
                }
            }
        })

        val video = PlayerView(this).apply {
            useController = false
            resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
            isFocusable = false
            descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS
            player = this@MainActivity.player
        }

        val pages = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        web = WebView(this).apply {
            setBackgroundColor(Color.TRANSPARENT)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    pages.shouldInterceptRequest(request.url)
            }
            addJavascriptInterface(Bridge(), "Native")
            loadUrl("https://appassets.androidplatform.net/assets/index.html")
        }

        val fill = ViewGroup.LayoutParams.MATCH_PARENT
        setContentView(FrameLayout(this).apply {
            setBackgroundColor(Color.BLACK)
            addView(video, FrameLayout.LayoutParams(fill, fill))
            addView(web, FrameLayout.LayoutParams(fill, fill))
        })
        web.requestFocus()
    }

    /** What the page (assets/app.js) calls. It runs on a WebView thread, so everything hops to the main one. */
    inner class Bridge {
        @JavascriptInterface fun play(json: String) { main.post { start(JSONObject(json)) } }
        @JavascriptInterface fun stop() { main.post { halt() } }
        @JavascriptInterface fun openApp(json: String) { main.post { launch(JSONObject(json)) } }
        @JavascriptInterface fun exit() { main.post { finish() } }
    }

    // -- playback -----------------------------------------------------------------------------------------

    private fun start(ch: JSONObject) {
        tune++
        channel = ch.optString("id")
        val list = ch.getJSONArray("src")
        sources = (0 until list.length()).map { list.getJSONObject(it) }
        next = 0
        player.stop()
        player.clearMediaItems()
        report("loading")
        tryNext(tune)
    }

    private fun halt() {
        tune++
        player.stop()
        player.clearMediaItems()
    }

    private fun tryNext(t: Int) {
        if (t != tune) return
        if (next >= sources.size) {
            player.stop()
            report("failed")
            return
        }
        val s = sources[next++]
        val page = s.optString("page")
        if (page.isEmpty()) {
            open(s.getString("u"), s.optString("r"), s.optString("a"))
            return
        }
        io.execute {
            val found = runCatching { streamOn(page) }.getOrNull()
            main.post {
                if (t != tune) return@post
                if (found == null) tryNext(t) else open(found, origin(page), "")
            }
        }
    }

    private fun open(url: String, referer: String, agent: String) {
        val http = DefaultHttpDataSource.Factory()
            .setUserAgent(agent.ifEmpty { AGENT })
            .setAllowCrossProtocolRedirects(true)
            .setConnectTimeoutMs(8_000)
            .setReadTimeoutMs(12_000)
        if (referer.isNotEmpty()) http.setDefaultRequestProperties(mapOf("Referer" to referer))
        val item = MediaItem.Builder().setUri(url).setMimeType(MimeTypes.APPLICATION_M3U8).build()
        player.setMediaSource(HlsMediaSource.Factory(http).createMediaSource(item))
        player.prepare()
        player.playWhenReady = visible
    }

    /** The first .m3u8 a channel's live page carries (its own player's source), or null. */
    private fun streamOn(page: String): String? {
        val c = URL(page).openConnection() as HttpURLConnection
        c.setRequestProperty("User-Agent", AGENT)
        c.connectTimeout = 8_000
        c.readTimeout = 10_000
        val html = try { c.inputStream.bufferedReader().use { it.readText() } } finally { c.disconnect() }
        return STREAM.find(html)?.value?.replace("\\/", "/")
    }

    private fun origin(url: String): String = Uri.parse(url).let { "${it.scheme}://${it.authority}/" }

    private fun report(state: String) {
        web.evaluateJavascript("window.app&&app.onState(${JSONObject.quote(channel)},'$state')", null)
    }

    // -- tiles for other apps ---------------------------------------------------------------------------

    /** Shahid, beIN's TOD: open the app if the TV has it (its own sign-in and subscription), else search the Play Store. */
    private fun launch(app: JSONObject) {
        val labels = app.getJSONArray("labels").let { a -> (0 until a.length()).map { a.getString(it).lowercase() } }
        val pm = packageManager
        val pkg = listOf(Intent.CATEGORY_LEANBACK_LAUNCHER, Intent.CATEGORY_LAUNCHER).asSequence()
            .flatMap { pm.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(it), 0).asSequence() }
            .firstOrNull { it.loadLabel(pm).toString().trim().lowercase() in labels }
            ?.activityInfo?.packageName
        val intent = pkg?.let { pm.getLeanbackLaunchIntentForPackage(it) ?: pm.getLaunchIntentForPackage(it) }
            ?: Intent(Intent.ACTION_VIEW, Uri.parse("market://search?q=" + Uri.encode(app.optString("search")) + "&c=apps"))
        try {
            startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: Exception) {
            val msg = JSONObject.quote("Install " + app.optString("search") + " from the Play Store")
            web.evaluateJavascript("window.app&&app.toast($msg)", null)
        }
    }

    // -- the remote: every key goes to the page, the WebView never moves focus on its own ----------------

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val name = KEYS[event.keyCode] ?: return super.dispatchKeyEvent(event)
        if (event.action == KeyEvent.ACTION_DOWN && !(name == "back" && event.repeatCount > 0)) {
            web.evaluateJavascript("window.app?app.key('$name'):false") { handled ->
                if (name == "back" && handled != "true") finish()
            }
        }
        return true
    }

    override fun onStop() {
        super.onStop()
        visible = false
        player.stop()
    }

    override fun onStart() {
        super.onStart()
        visible = true
        if (player.mediaItemCount > 0) {     // back to live, not to where it was left
            player.seekToDefaultPosition()
            player.prepare()
            player.play()
        }
    }

    override fun onDestroy() {
        tune++
        io.shutdownNow()
        player.release()
        web.destroy()
        super.onDestroy()
    }

    companion object {
        const val AGENT = "Mozilla/5.0 (Linux; Android 12; BRAVIA 4K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
        val STREAM = Regex("""https?:(?:\\?/){2}[^"'\s<>()]+?\.m3u8[^"'\s<>()]*""")
        val KEYS = mapOf(
            KeyEvent.KEYCODE_DPAD_UP to "up", KeyEvent.KEYCODE_DPAD_DOWN to "down",
            KeyEvent.KEYCODE_DPAD_LEFT to "left", KeyEvent.KEYCODE_DPAD_RIGHT to "right",
            KeyEvent.KEYCODE_DPAD_CENTER to "ok", KeyEvent.KEYCODE_ENTER to "ok", KeyEvent.KEYCODE_NUMPAD_ENTER to "ok",
            KeyEvent.KEYCODE_BUTTON_A to "ok",
            KeyEvent.KEYCODE_BACK to "back", KeyEvent.KEYCODE_ESCAPE to "back", KeyEvent.KEYCODE_BUTTON_B to "back",
            KeyEvent.KEYCODE_CHANNEL_UP to "chnext", KeyEvent.KEYCODE_PAGE_DOWN to "chnext", KeyEvent.KEYCODE_MEDIA_NEXT to "chnext",
            KeyEvent.KEYCODE_CHANNEL_DOWN to "chprev", KeyEvent.KEYCODE_PAGE_UP to "chprev", KeyEvent.KEYCODE_MEDIA_PREVIOUS to "chprev",
            KeyEvent.KEYCODE_MENU to "menu", KeyEvent.KEYCODE_GUIDE to "menu", KeyEvent.KEYCODE_INFO to "info",
        )
    }
}
