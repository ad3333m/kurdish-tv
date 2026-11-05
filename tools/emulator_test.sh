#!/usr/bin/env bash
# Runs the APK on an Android TV emulator (1080p), drives it with remote keys and saves a screenshot after each
# step to tv-shots/. Fresh install, so home opens with the Kurdish tile focused.
set -uo pipefail
OUT=tv-shots
mkdir -p "$OUT"
adb install -r out/KurdishTV.apk || { echo "install failed"; exit 0; }
shot() { sleep "$2"; adb exec-out screencap -p > "$OUT/$1.png"; }
key() { adb shell input keyevent "$1"; sleep 1.2; }

adb shell am start -n com.ad3333m.kurdishtv/.MainActivity
shot 01-home 20
key KEYCODE_DPAD_CENTER;                           shot 02-kurdish 3
key KEYCODE_DPAD_CENTER;                           shot 03-rudaw 25
key KEYCODE_DPAD_UP;                               shot 04-kurdistan24 20
key KEYCODE_DPAD_CENTER;                           shot 05-channel-list 3
key KEYCODE_BACK; key KEYCODE_BACK;                shot 06-back-to-kurdish 3
# focus is on Kurdistan 24 (News, first line, 2nd); two lines down is KurdMax Sorani (Entertainment, 2nd)
key KEYCODE_DPAD_DOWN; key KEYCODE_DPAD_DOWN;      shot 07-kurdmax-focused 2
key KEYCODE_DPAD_CENTER;                           shot 08-kurdmax-sorani 30
key KEYCODE_BACK; key KEYCODE_BACK
key KEYCODE_DPAD_RIGHT; key KEYCODE_DPAD_CENTER;   shot 09-arabic 4
key KEYCODE_BACK
# Arabic tile (2nd of 3) -> down lands on MBC (3rd of 6)
key KEYCODE_DPAD_DOWN; key KEYCODE_DPAD_CENTER;    shot 10-mbc 4
key KEYCODE_DPAD_CENTER;                           shot 11-mbc1 25
key KEYCODE_BACK; key KEYCODE_BACK
key KEYCODE_DPAD_LEFT; key KEYCODE_DPAD_LEFT; key KEYCODE_DPAD_CENTER
                                                   shot 12-sports 4
adb logcat -d | grep -iE "kurdishtv|ExoPlayer|MediaCodec|AndroidRuntime|FATAL" | grep -v mediashell | tail -400 > "$OUT/logcat.txt"
ls -la "$OUT"
