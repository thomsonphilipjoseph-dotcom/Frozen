#!/usr/bin/env python3
import json, urllib.request, xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

# Official RFI "Journal en français facile" podcast feed.
# French Zero uses it only to discover factual episode metadata and the official RFI page.
# It does NOT copy/rehost audio, descriptions, transcripts, images, or lesson content.
FEED = "https://apis.fle.rfi.fr/products/get_product/fle_getpodcast_by_nid_author_rfi?token_application=applepodcast_fle&program.entrepriseId=WBMZ39-FLE-FR-20220627"
OUT = Path(__file__).resolve().parents[1] / "data" / "rfi.json"
UA = "FrenchZero-MetadataReader/1.1 (+independent personal language-learning PWA)"

def text(node, name, default=""):
    x = node.find(name)
    return (x.text or "").strip() if x is not None and x.text else default

req = urllib.request.Request(
    FEED,
    headers={
        "User-Agent": UA,
        "Accept": "application/rss+xml, application/xml, text/xml;q=0.9,*/*;q=0.8",
    },
)
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
    duration = ""
    for child in item:
        if child.tag.endswith("duration") and child.text:
            duration = child.text.strip()
            break

    # Only factual metadata and the official page URL are saved.
    items.append({
        "id": guid,
        "title": title,
        "pubDate": pub,
        "duration": duration,
        "officialUrl": link,
    })

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(
    json.dumps(
        {
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            "source": "RFI — Journal en français facile",
            "notice": "Metadata only. Audio, transcript, descriptions and images remain on RFI.",
            "episodes": items,
        },
        ensure_ascii=False,
        indent=2,
    ),
    encoding="utf-8",
)
print(f"Wrote metadata for {len(items)} episodes to {OUT}")
