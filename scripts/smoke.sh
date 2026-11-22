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
# tap the centre of the first element whose text or accessibility label matches $1
tapText() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb pull /sdcard/ui.xml /tmp/ui.xml >/dev/null 2>&1
  XY=$(python3 - "$1" <<'PY'
import re, sys
t = sys.argv[1]; x = open('/tmp/ui.xml', encoding='utf-8').read()
for m in re.finditer(r'<node [^>]*>', x):
    n = m.group(0)
    if f'text="{t}"' in n or f'content-desc="{t}"' in n:
        a, b, c, d = map(int, re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n).groups())
        print((a + c) // 2, (b + d) // 2); break
PY
)
  if [ -z "$XY" ] && [ -n "${2:-}" ]; then XY="$2"; fi
  if [ -n "$XY" ]; then adb shell input tap $XY; echo "tapped '$1' at $XY"; else echo "not found: '$1'"; fi
}

sleep 15; shot 01-launch; echo "after launch: $(alive)"
# Welcome → "Get Started", then Choose Your Vibe → pick one interest → "Continue"
SIZE=$(adb shell wm size | tail -1 | awk '{print $NF}'); W=${SIZE%x*}; H=${SIZE#*x}
echo "screen ${W}x${H}"
tapText "Get Started"; sleep 4; shot 02-vibe; echo "vibe: $(alive)"
tapText "Travel"; sleep 1
tapText "Continue" ; sleep 8; shot 02-after-enter; echo "after enter: $(alive)"
sleep 10; shot 03-home; echo "at home: $(alive)"
TY=$((H*96/100))
tab() { adb shell input tap $((W*$1/100)) $TY; sleep 6; shot "$2"; echo "$2: $(alive)"; }
tapText "Mystery Match" "$((W*72/100)) $((H*17/100))"; sleep 6; shot 03b-mystery-match; echo "mystery match: $(alive)"
# deep links into the new screens (no Back key: it could leave the app)
link() { adb shell am start -W -a android.intent.action.VIEW -d "theunknown://$1" "$PKG" >/dev/null 2>&1; sleep 7; shot "$2"; echo "$2: $(alive)"; }
link ai 03c-ai-characters
link ai/luna 03e-ai-profile
link ai/chat/luna 03f-ai-chat
link nearby 03d-nearby
link safety 03g-safety
link premium 03h-premium
link challenges 03i-challenges
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
