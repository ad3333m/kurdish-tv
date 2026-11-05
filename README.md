# Kurdish TV

Live TV for Google TV, built for a Sony BRAVIA 8: Kurdish channels (KurdMax, Rudaw, Kurdistan 24, Kurdsat, NRT, Waar,
Zarok and more), plus Arabic (MBC, Shahid's free channels, Rotana, news, sports) and English (news, free movie channels,
beIN SPORTS XTRA). Remote only.

- **Install:** `KurdishTV.apk` from the [latest release](../../releases/latest), with Downloader, a USB stick or `adb install`.
- **Remote:** in the guide, ◀ ▶ ▲ ▼ and OK; ▲ from the top row reaches the Kurdish / Arabic / English tabs. While watching,
  ▲ ▼ (or CH +/-) change channel, OK opens the channel list, Back returns to the guide.

## How it works

- `app/src/main/assets/` is the whole interface: `index.html`, `app.js`, and `channels.js` (the built-in channel list).
  Open `index.html` in a desktop browser to try it with the arrow keys.
- `MainActivity.kt` puts the page in a transparent WebView over a native ExoPlayer (Media3), so streams use the TV's
  hardware decoder. Keys go to the page (`app.key`), and the page asks for a channel with `Native.play`.
- A channel has sources in order. A `u` source is a stream (with an optional `r` Referer). A `page` source is the
  channel's own live page: the app reads it for the stream its website player uses (KurdMax renames its streams, so
  its page is read first).
- At start the page fetches [iptv-org](https://github.com/iptv-org/iptv)'s Kurdish playlist, which adds fresh links
  and any new Kurdish channel.
- Shahid and beIN (TOD) tiles open those apps on the TV, with your own account. beIN's paid channels are not in the list.

`tools/make_icons.py` draws the icons and banner. CI (`.github/workflows/apk.yml`) builds the debug-signed APK into the
`latest` release and runs `tools/emulator_test.sh` on an Android TV emulator. The screenshots go to the `preview` release.
