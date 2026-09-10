#!/usr/bin/env python3
import json, re, html, urllib.request, xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

FEED = "https://apis.fle.rfi.fr/products/get_product/fle_getpodcast_by_nid_author_rfi?token_application=applepodcast_fle&program.entrepriseId=WBMZ39-FLE-FR-20220627"
OUT = Path(__file__).resolve().parents[1] / "data" / "rfi.json"
UA = "FrenchZero-RFI-Reader/1.0 (+personal language-learning PWA)"


def text(node, name, default=""):
    x = node.find(name)
    return (x.text or "").strip() if x is not None and x.text else default


def clean_description(s):
    s = html.unescape(s or "")
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"\n{3,}", "\n\n", s).strip()

req = urllib.request.Request(FEED, headers={"User-Agent": UA, "Accept": "application/rss+xml, application/xml, text/xml;q=0.9,*/*;q=0.8"})
with urllib.request.urlopen(req, timeout=30) as resp:
    raw = resp.read()

root = ET.fromstring(raw)
channel = root.find("channel") if root.tag == "rss" else root.find(".//channel")
if channel is None:
    raise RuntimeError("RFI feed did not contain an RSS channel")

items = []
for item in channel.findall("item")[:30]:
    title = text(item, "title")
    link = text(item, "link")
    guid = text(item, "guid", link or title)
    pub = text(item, "pubDate")
    desc_raw = text(item, "description")
    desc = clean_description(desc_raw)
    enclosure = item.find("enclosure")
    audio = enclosure.get("url", "") if enclosure is not None else ""
    duration = ""
    for child in item:
        if child.tag.endswith("duration") and child.text:
            duration = child.text.strip(); break
    urls = re.findall(r"https?://[^\s<>'\"]+", html.unescape(desc_raw or ""))
    transcript = next((u.rstrip(').,') for u in urls if "rfi.my/" in u or "francaisfacile.rfi.fr" in u), link)
    items.append({
        "id": guid,
        "guid": guid,
        "title": title,
        "pubDate": pub,
        "description": desc,
        "audioUrl": audio,
        "duration": duration,
        "link": link,
        "transcriptUrl": transcript,
    })

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps({
    "updatedAt": datetime.now(timezone.utc).isoformat(),
    "source": "RFI Journal en français facile",
    "feed": FEED,
    "episodes": items,
}, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Wrote {len(items)} episodes to {OUT}")
