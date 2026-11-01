// Pulls the newest pins from the public Pinterest board feed into pinterest.json.
// Pins are linked, not copied: the editor loads each picture from Pinterest's CDN.
// Run: node scripts/sync-pinterest.mjs   (Node 18+, no dependencies)
import { readFile, writeFile } from "node:fs/promises";

const BOARD = process.env.PINTEREST_BOARD || "tripathiadityap/talditalk-image-repo";
const FEED = `https://www.pinterest.com/${BOARD}.rss`;
const OUT = new URL("../pinterest.json", import.meta.url);
const EXCLUDE = new URL("../pinterest-exclude.txt", import.meta.url);

const decode = s => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
const pick = (block, tag) => { const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)); return m ? decode(m[1]) : ""; };

const res = await fetch(FEED, { headers: { "user-agent": "Mozilla/5.0 reel-studio-sync" } });
if (!res.ok) { console.error(`Feed request failed: ${res.status}`); process.exit(1); }
const xml = await res.text();

let existing = [];
try { existing = JSON.parse(await readFile(OUT, "utf8")); } catch {}
let exclude = [];
try { exclude = (await readFile(EXCLUDE, "utf8")).split("\n").map(l => l.replace(/#.*/, "").trim()).filter(Boolean); } catch {}

const known = new Set(existing.map(p => p.id));
let next = existing.reduce((m, p) => Math.max(m, p.n || 0), 0) + 1;
const fresh = [];
for (const block of xml.split("<item>").slice(1)) {
  const link = pick(block, "link");
  const id = (link.match(/\/pin\/(\d+)/) || [])[1];
  const desc = pick(block, "description");
  const img = (desc.match(/src="([^"]+i\.pinimg\.com[^"]+)"/) || [])[1];
  if (!id || !img || known.has(id)) continue;
  fresh.push({ id, title: pick(block, "title") || "", link, thumb: img.replace(/\/\d+x\//, "/236x/"), url: img.replace(/\/\d+x\//, "/736x/") });
}
// The feed lists newest first; number them oldest first so numbers stay stable.
for (const p of fresh.reverse()) existing.push({ n: next++, ...p });

const list = existing.filter(p => !exclude.includes(p.id) && !exclude.includes(String(p.n)));
await writeFile(OUT, JSON.stringify(list, null, 2) + "\n");
console.log(`${fresh.length} new pin(s), ${list.length} in pinterest.json`);
