#!/usr/bin/env bash
# Installs the APK on the running emulator, launches it, walks through the intro,
# and saves logcat + screenshots to ./smoke for diagnosis.
set -u
APK="$1"
PKG=com.theunknown.app
mkdir -p smoke
adb install -r "$APK"
adb logcat -c
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1
shot() { adb exec-out screencap -p > "smoke/$1.png"; }
alive() { adb shell pidof "$PKG" >/dev/null && echo "ALIVE" || echo "DEAD"; }

sleep 15; shot 01-launch; echo "after launch: $(alive)"
# Welcome → "Get Started", then Choose Your Vibe → pick one interest → "Continue"
SIZE=$(adb shell wm size | tail -1 | awk '{print $NF}'); W=${SIZE%x*}; H=${SIZE#*x}
echo "screen ${W}x${H}"
adb shell input tap $((W/2)) $((H*84/100)); sleep 4; shot 02-vibe; echo "vibe: $(alive)"
adb shell input tap $((W*20/100)) $((H*32/100)); sleep 1
adb shell input tap $((W/2)) $((H*93/100)); sleep 8; shot 02-after-enter; echo "after enter: $(alive)"
sleep 10; shot 03-home; echo "at home: $(alive)"
TY=$((H*96/100))
tab() { adb shell input tap $((W*$1/100)) $TY; sleep 6; shot "$2"; echo "$2: $(alive)"; }
adb shell input tap $((W*72/100)) $((H*15/100)); sleep 6; shot 03b-mystery-match; echo "mystery match: $(alive)"
tab 30 04-challenges
tab 70 05-messages
tab 90 06-profile
adb shell input tap $((W/2)) $((H*89/100)); sleep 6; shot 07-create; echo "07-create: $(alive)"
adb shell input keyevent 4; sleep 4
tab 10 08-discover

adb logcat -d > smoke/logcat-full.txt
grep -E "ReactNativeJS|AndroidRuntime|FATAL|ReactNative|unknown|Supabase|SoLoader|libc " smoke/logcat-full.txt > smoke/logcat-app.txt || true
echo "===== APP LOG (filtered) ====="
tail -n 200 smoke/logcat-app.txt
echo "===== FATAL ====="
grep -A 40 "FATAL EXCEPTION" smoke/logcat-full.txt | head -n 120 || true
exit 0
