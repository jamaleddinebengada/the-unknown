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
  if [ -n "$XY" ]; then adb shell input tap $XY; echo "tapped '$1' at $XY"; else echo "not found: '$1'"; return 1; fi
}

sleep 15; shot 01-launch; echo "after launch: $(alive)"
# Welcome → "Get started" → profile setup (date of birth is required, 18+) → interests → Nearby
SIZE=$(adb shell wm size | tail -1 | awk '{print $NF}'); W=${SIZE%x*}; H=${SIZE#*x}
echo "screen ${W}x${H}"
tapText "Get started"; sleep 4; shot 02-setup; echo "setup: $(alive)"
tapText "Name" "$((W/2)) $((H*85/100))"; adb shell input text Sara; adb shell input keyevent 66; sleep 1
adb shell input swipe $((W/2)) $((H*70/100)) $((W/2)) $((H*35/100)) 400; sleep 2; shot 02b-setup-scrolled
tapText "Day" "$((W*20/100)) $((H*45/100))"; adb shell input text 15; tapText "Month"; adb shell input text 06; tapText "Year"; adb shell input text 1994
sleep 2; shot 02c-setup-filled; adb shell input keyevent 111; sleep 1
tapText "Woman"; sleep 1; shot 02d-setup-gender
tapText "Continue"; sleep 6; shot 02-vibe; echo "vibe: $(alive)"
tapText "Travel"; sleep 1
tapText "Continue"; sleep 8; shot 03-nearby-home; echo "nearby home: $(alive)"
# Nearby without location permission: use the manual city picker
adb shell input swipe $((W/2)) $((H*70/100)) $((W/2)) $((H*40/100)) 400; sleep 2
tapText "Choose a city instead"; sleep 3; shot 03-city-sheet; tapText "Casablanca"; sleep 8; shot 03a-nearby-city; echo "nearby city: $(alive)"
TY=$((H*96/100))
tab() { adb shell input tap $((W*$1/100)) $TY; sleep 6; shot "$2"; echo "$2: $(alive)"; }
# deep links into stack screens (no Back key: it could leave the app)
link() { adb shell am start -W -a android.intent.action.VIEW -d "theunknown://$1" "$PKG" >/dev/null 2>&1; sleep 7; shot "$2"; echo "$2: $(alive)"; }
tab 30 04-discover
tab 50 05-matches
tab 70 06-messages
tab 90 07-profile
tab 10 08-nearby
# photo upload: put a test picture in the gallery, then add it from My photos (gallery → crop → upload)
adb push scripts/test-photo.jpg /sdcard/Pictures/test-photo.jpg >/dev/null 2>&1
adb shell content call --method scan_volume --uri content://media --arg external_primary >/dev/null 2>&1 || true
adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Pictures/test-photo.jpg >/dev/null 2>&1 || true
sleep 3
link photos 21-photos-empty
tapText "Add a photo" "$((W/2)) $((H*35/100))"; sleep 3; shot 22-photo-source
tapText "Choose from gallery" "$((W/2)) $((H*88/100))"; sleep 6; shot 23-photo-picker
PICK=$(adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb pull /sdcard/ui.xml /tmp/ui.xml >/dev/null 2>&1; python3 - <<'PY'
import re
x = open('/tmp/ui.xml', encoding='utf-8').read()
for m in re.finditer(r'<node [^>]*>', x):
    n = m.group(0)
    if re.search(r'content-desc="(Photo taken|Photo|Image)[^"]*"', n) or 'test-photo' in n:
        a, b, c, d = map(int, re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n).groups())
        print((a + c) // 2, (b + d) // 2); break
PY
)
echo "picker item: ${PICK:-fallback}"
if [ -n "$PICK" ]; then adb shell input tap $PICK; else adb shell input tap $((W*17/100)) $((H*25/100)); fi
sleep 5; shot 24-photo-crop
tapText "Crop" || tapText "CROP" || tapText "Done" || adb shell input tap $((W*92/100)) $((H*6/100))
sleep 12; shot 25-photos-after-upload; echo "photo upload screen: $(alive)"
# clean up the test account so it never shows up for real members: delete its photo, turn Nearby off
tapText "Main photo" "$((W/2)) $((H*30/100))"; sleep 2; tapText "Delete photo"; sleep 5; shot 26-photo-deleted
link mystery 09-mystery-match
link ai 10-virtual-characters
link ai/karim 11-ai-profile-karim
link wallet 12-wallet
link account 13-account
link verify 14-verify
link language 15-language
link premium 16-premium
link favorites 17-favorites
link visitors 18-visitors
link safety 19-safety
link admin 20-admin-locked
tab 10 27-nearby-before-off
adb shell input tap $((W*22/100)) $((H*9/100)); sleep 3; shot 28-area-sheet
tapText "Turn off Nearby & erase my area"; sleep 2; tapText "TURN OFF" || tapText "Turn off"; sleep 5; shot 29-nearby-off; echo "nearby off: $(alive)"

adb logcat -d > smoke/logcat-full.txt
grep -E "ReactNativeJS|AndroidRuntime|FATAL|ReactNative|unknown|Supabase|SoLoader|libc " smoke/logcat-full.txt > smoke/logcat-app.txt || true
echo "===== APP LOG (filtered) ====="
tail -n 200 smoke/logcat-app.txt
echo "===== FATAL ====="
grep -A 40 "FATAL EXCEPTION" smoke/logcat-full.txt | head -n 120 || true
exit 0
