#!/usr/bin/env bash
# Runs the APK on an Android TV emulator (1080p), drives it with remote keys and saves a screenshot after each
# step to tv-shots/. Fresh install, so the guide opens on Kurdish > News > Rudaw.
set -uo pipefail
OUT=tv-shots
mkdir -p "$OUT"
adb install -r out/KurdishTV.apk || { echo "install failed"; exit 0; }
shot() { sleep "$2"; adb exec-out screencap -p > "$OUT/$1.png"; }
key() { adb shell input keyevent "$1"; sleep 1.2; }

adb shell am start -n com.ad3333m.kurdishtv/.MainActivity
shot 01-guide 20
key KEYCODE_DPAD_CENTER;                           shot 02-rudaw 25
key KEYCODE_DPAD_UP;                               shot 03-kurdistan24 20
key KEYCODE_DPAD_CENTER;                           shot 04-channel-list 3
key KEYCODE_BACK; key KEYCODE_BACK;                shot 05-back-to-guide 3
# Recently watched is now row 0 and the focus is on Kurdistan 24 in News; down to Entertainment, right to KurdMax
key KEYCODE_DPAD_DOWN; key KEYCODE_DPAD_RIGHT;     shot 06-kurdmax-focused 2
key KEYCODE_DPAD_CENTER;                           shot 07-kurdmax-sorani 30
key KEYCODE_BACK
key KEYCODE_DPAD_UP; key KEYCODE_DPAD_UP; key KEYCODE_DPAD_UP; key KEYCODE_DPAD_RIGHT
                                                   shot 08-arabic 5
key KEYCODE_DPAD_DOWN; key KEYCODE_DPAD_DOWN;      shot 09-mbc-row 2
key KEYCODE_DPAD_CENTER;                           shot 10-mbc1 25
key KEYCODE_BACK
key KEYCODE_DPAD_UP; key KEYCODE_DPAD_UP; key KEYCODE_DPAD_UP; key KEYCODE_DPAD_RIGHT
                                                   shot 11-english 5
key KEYCODE_DPAD_DOWN; key KEYCODE_DPAD_DOWN;      shot 12-sports-row 2
key KEYCODE_DPAD_CENTER;                           shot 13-bein-xtra 25
adb logcat -d | grep -iE "chromium|kurdishtv|ExoPlayer|MediaCodec|AndroidRuntime|FATAL" | tail -400 > "$OUT/logcat.txt"
ls -la "$OUT"
