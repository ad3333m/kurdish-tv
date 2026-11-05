"""Downloads every channel logo into the APK (assets/logos/) and writes assets/logos.js, so logos load instantly and
also where a logo host is blocked (imgur is blocked in the UK). Run it after changing channels.js and commit the
result; a logo that fails to download just falls back to the channel's initials.

    python tools/fetch_logos.py      (needs Pillow)
"""
import io, json, re, urllib.parse, urllib.request, concurrent.futures as cf
from pathlib import Path
from PIL import Image

ASSETS = Path(__file__).resolve().parent.parent / "app" / "src" / "main" / "assets"
src = (ASSETS / "channels.js").read_text(encoding="utf-8")
channels = json.loads(src[src.index("["):src.rindex("]") + 1])
(ASSETS / "logos").mkdir(exist_ok=True)


def fetch(c):
    url = c.get("logo") or ""
    if not url.startswith("http"):
        return None
    name = re.sub(r"[^\w.-]", "_", c["id"]) + ".png"
    if (ASSETS / "logos" / name).exists():
        return c["id"], "logos/" + name
    if "imgur.com" in url:          # imgur answers the UK with a "not viewable in your region" picture
        url = "https://external-content.duckduckgo.com/iu/?f=1&u=" + urllib.parse.quote(url, safe="")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (KurdishTV logo fetch)"})
        data = urllib.request.urlopen(req, timeout=20).read()
        im = Image.open(io.BytesIO(data)).convert("RGBA")
        bbox = im.getchannel("A").getbbox()               # trim transparent margins so logos fill their box alike
        if bbox:
            im = im.crop(bbox)
        im.thumbnail((360, 200), Image.LANCZOS)
        im.save(ASSETS / "logos" / name, optimize=True)
        return c["id"], "logos/" + name
    except Exception as e:                                # SVG, dead link, rate limit: initials instead
        print("no logo:", c["name"], type(e).__name__, str(e)[:60])
        return None


with cf.ThreadPoolExecutor(3) as ex:                    # wikimedia rate-limits anything faster
    found = dict(r for r in ex.map(fetch, channels) if r)
(ASSETS / "logos.js").write_text("window.LOGOS = " + json.dumps(found, indent=0) + ";\n", encoding="utf-8")
print(len(found), "of", sum(1 for c in channels if c.get("logo")), "logos bundled")
