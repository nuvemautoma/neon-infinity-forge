import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { LeadResult } from "./leads.functions";

const ExtractSchema = z.object({
  country: z.string().min(2).max(60),
  state: z.string().max(80).optional().default(""),
  city: z.string().min(1).max(120),
  niche: z.string().max(80).default(""),
  name: z.string().max(120).optional().default(""),
  useGoogle: z.boolean().default(false),
  enrichEmail: z.boolean().default(true),
  limit: z.number().min(10).max(200).default(80),
});

const OSM_NICHE_MAP: Record<string, string[]> = {
  restaurante: ['amenity~"restaurant|fast_food|cafe|food_court|bar|pub"'],
  bar: ['amenity~"bar|pub"'],
  cafe: ['amenity="cafe"'],
  lanchonete: ['amenity~"fast_food|cafe"'],
  padaria: ['shop="bakery"'],
  mercado: ['shop~"supermarket|convenience|grocery"'],
  acougue: ['shop="butcher"'],
  farmacia: ['amenity="pharmacy"'],
  hospital: ['amenity~"hospital|clinic"'],
  clinica: ['amenity~"clinic|doctors"'],
  dentista: ['amenity="dentist"'],
  veterinario: ['amenity="veterinary"'],
  petshop: ['shop="pet"'],
  barbearia: ['shop~"hairdresser|beauty"', 'craft~"barbershop"'],
  cabeleireiro: ['shop~"hairdresser|beauty"'],
  salao: ['shop~"hairdresser|beauty"'],
  academia: ['leisure="fitness_centre"', 'sport="fitness"'],
  hotel: ['tourism~"hotel|hostel|guest_house|motel|apartment"'],
  pousada: ['tourism~"guest_house|hostel"'],
  escola: ['amenity~"school|kindergarten|college|university"'],
  igreja: ['amenity="place_of_worship"'],
  oficina: ['shop~"car_repair|motorcycle_repair"'],
  posto: ['amenity="fuel"'],
  loja: ['shop'],
  roupas: ['shop~"clothes|fashion|boutique"'],
  calcados: ['shop="shoes"'],
  moveis: ['shop="furniture"'],
  eletronicos: ['shop~"electronics|mobile_phone|computer"'],
  contabilidade: ['office="accountant"'],
  advogado: ['office="lawyer"'],
  imobiliaria: ['office="estate_agent"'],
};

function nicheFilters(niche: string): string[] {
  const k = niche.trim().toLowerCase();
  if (!k) return ["shop", "amenity", "office", "craft", "tourism"];
  return OSM_NICHE_MAP[k] || [`shop~"${k}",i`, `amenity~"${k}",i`, `office~"${k}",i`, `craft~"${k}",i`];
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const BAD_EMAIL = /(\.png|\.jpg|\.jpeg|\.svg|\.gif|\.webp|sentry|wixpress|example\.com|@2x|@3x|sentry\.io)/i;

function pickBestEmail(text: string): string | null {
  const matches = text.match(EMAIL_RE) || [];
  const cleaned = matches
    .map((m) => m.toLowerCase())
    .filter((m) => !BAD_EMAIL.test(m))
    .filter((m) => !m.startsWith("noreply") && !m.startsWith("no-reply"));
  if (!cleaned.length) return null;
  const pref = cleaned.find((m) => /^(contato|contact|comercial|vendas|atendimento|sac|info|hello|ola)/.test(m));
  return pref || cleaned[0];
}

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

async function geocode(country: string, state: string, city: string) {
  const params = new URLSearchParams({ format: "jsonv2", limit: "1", country, city, addressdetails: "0" });
  if (state) params.set("state", state);
  const r = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: { "User-Agent": "InfinityIA-Leads/1.0", "Accept-Language": "pt-BR,pt;q=0.9" },
  });
  if (!r.ok) throw new Error(`Geocode falhou (${r.status})`);
  const arr = await r.json() as Array<{ lat: string; lon: string; boundingbox: [string, string, string, string]; display_name: string }>;
  if (!arr.length) throw new Error("Cidade não encontrada");
  const it = arr[0];
  const [s, n, w, e] = it.boundingbox.map(Number);
  return { south: s, north: n, west: w, east: e, lat: Number(it.lat), lng: Number(it.lon), label: it.display_name };
}

async function searchOSM(bbox: any, niche: string, name: string, limit: number): Promise<LeadResult[]> {
  const filters = nicheFilters(niche);
  const nameFilter = name ? `[name~"${name.replace(/[\\"]/g, "")}",i]` : "";
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const blocks = filters.flatMap((f) => [
    `node[${f}]${nameFilter}(${bboxStr});`,
    `way[${f}]${nameFilter}(${bboxStr});`,
  ]).join("\n");
  const query = `[out:json][timeout:30];(\n${blocks}\n);out center ${limit};`;

  const endpoints = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
  let lastErr: any;
  for (const url of endpoints) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "InfinityIA-Leads/1.0" },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!r.ok) { lastErr = new Error(`Overpass ${r.status}`); continue; }
      const json = await r.json() as { elements?: Array<any> };
      const els = json.elements || [];
      const seen = new Set<string>();
      const results: LeadResult[] = [];
      for (const el of els) {
        const tags = el.tags || {};
        const nm = tags.name || tags["name:pt"] || tags["brand"];
        if (!nm) continue;
        const key = `${nm}|${tags["addr:street"] || ""}|${tags["addr:housenumber"] || ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const addrParts = [tags["addr:street"], tags["addr:housenumber"], tags["addr:suburb"], tags["addr:city"]].filter(Boolean);
        results.push({
          external_id: `osm:${el.type}/${el.id}`,
          source: "osm",
          name: nm,
          phone: tags.phone || tags["contact:phone"] || tags["contact:mobile"] || null,
          email: tags.email || tags["contact:email"] || null,
          website: tags.website || tags["contact:website"] || tags.url || null,
          address: addrParts.length ? addrParts.join(", ") : null,
          lat: el.lat ?? el.center?.lat ?? null,
          lng: el.lon ?? el.center?.lon ?? null,
          rating: null,
          reviews_count: null,
          photo_url: tags.image || null,
          description: tags.description || tags.cuisine || null,
          category: tags.shop || tags.amenity || tags.office || tags.craft || tags.tourism || null,
        });
      }
      return results.slice(0, limit);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("Overpass indisponível");
}

async function searchGoogle(apiKey: string, query: string, lat: number, lng: number, limit: number): Promise<LeadResult[]> {
  const ts = new URLSearchParams({ query, location: `${lat},${lng}`, radius: "15000", key: apiKey });
  const r = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${ts.toString()}`);
  if (!r.ok) return [];
  const j = await r.json() as { results?: Array<any>; status?: string };
  if (j.status && !["OK", "ZERO_RESULTS"].includes(j.status)) return [];
  const top = (j.results || []).slice(0, limit);

  const detailed = await Promise.all(top.map(async (p) => {
    try {
      const dp = new URLSearchParams({
        place_id: p.place_id,
        fields: "name,formatted_phone_number,international_phone_number,website,formatted_address,geometry,rating,user_ratings_total,photos,types,editorial_summary",
        key: apiKey,
      });
      const dr = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${dp.toString()}`);
      const dj = await dr.json() as { result?: any };
      return { p, d: dj.result || {} };
    } catch { return { p, d: {} }; }
  }));

  return detailed.map(({ p, d }): LeadResult => {
    const photoRef = d.photos?.[0]?.photo_reference || p.photos?.[0]?.photo_reference;
    return {
      external_id: `google:${p.place_id}`,
      source: "google",
      name: d.name || p.name,
      phone: d.international_phone_number || d.formatted_phone_number || null,
      email: null,
      website: d.website || null,
      address: d.formatted_address || p.formatted_address || null,
      lat: d.geometry?.location?.lat ?? p.geometry?.location?.lat ?? null,
      lng: d.geometry?.location?.lng ?? p.geometry?.location?.lng ?? null,
      rating: typeof d.rating === "number" ? d.rating : (typeof p.rating === "number" ? p.rating : null),
      reviews_count: d.user_ratings_total ?? p.user_ratings_total ?? null,
      photo_url: photoRef ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoRef}&key=${apiKey}` : null,
      description: d.editorial_summary?.overview || (Array.isArray(p.types) ? p.types.slice(0, 3).join(", ") : null),
      category: Array.isArray(p.types) ? p.types[0] : null,
    };
  });
}

async function getServerGoogleKey(): Promise<string | null> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !KEY) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?select=google_places_api_key&limit=1`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    });
    const rows = await r.json();
    const k = rows?.[0]?.google_places_api_key;
    return typeof k === "string" && k.length > 10 ? k : null;
  } catch { return null; }
}

async function enrichEmailsBatch(websites: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const apiKey = process.env.FIRECRAWL_API_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!apiKey || !websites.length) return out;

  // Cache lookup
  const cacheMap = new Map<string, string | null>();
  if (SUPABASE_URL && KEY) {
    try {
      const domains = Array.from(new Set(websites.map(domainOf)));
      const inList = domains.map((d) => `"${d}"`).join(",");
      const cr = await fetch(
        `${SUPABASE_URL}/rest/v1/email_scrape_cache?domain=in.(${encodeURIComponent(inList)})&select=domain,email,scraped_at`,
        { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }
      );
      if (cr.ok) {
        const rows = await cr.json() as Array<{ domain: string; email: string | null; scraped_at: string }>;
        const now = Date.now();
        for (const r of rows) {
          if (now - new Date(r.scraped_at).getTime() < 30 * 24 * 60 * 60 * 1000) {
            cacheMap.set(r.domain, r.email);
          }
        }
      }
    } catch {}
  }

  const upserts: Array<{ domain: string; email: string | null; scraped_at: string }> = [];
  // limita concorrência
  const concurrency = 6;
  let idx = 0;
  async function worker() {
    while (idx < websites.length) {
      const i = idx++;
      const w = websites[i];
      const dom = domainOf(w);
      if (cacheMap.has(dom)) { out.set(w, cacheMap.get(dom)!); continue; }
      let email: string | null = null;
      const urls = [w, w.replace(/\/$/, "") + "/contato", w.replace(/\/$/, "") + "/contact"];
      for (const u of urls) {
        if (email) break;
        try {
          const fc = await fetch("https://api.firecrawl.dev/v2/scrape", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ url: u, formats: ["markdown", "html"], onlyMainContent: false, timeout: 12000 }),
          });
          if (!fc.ok) continue;
          const fj = await fc.json();
          const text = (fj?.data?.markdown || "") + "\n" + (fj?.data?.html || "");
          email = pickBestEmail(text);
        } catch {}
      }
      out.set(w, email);
      upserts.push({ domain: dom, email, scraped_at: new Date().toISOString() });
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  if (upserts.length && SUPABASE_URL && KEY) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/email_scrape_cache`, {
        method: "POST",
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(upserts),
      });
    } catch {}
  }
  return out;
}

export const extractLeads = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ExtractSchema.parse(d))
  .handler(async ({ data }) => {
    const bbox = await geocode(data.country, data.state, data.city);

    const tasks: Array<Promise<LeadResult[]>> = [searchOSM(bbox, data.niche, data.name, data.limit)];
    let googleUsed = false;
    if (data.useGoogle) {
      const gKey = await getServerGoogleKey();
      if (gKey) {
        googleUsed = true;
        const q = data.name ? `${data.niche} ${data.name}` : (data.niche || "comércios");
        tasks.push(searchGoogle(gKey, `${q} em ${data.city}`, bbox.lat, bbox.lng, 40));
      }
    }
    const settled = await Promise.allSettled(tasks);
    let merged: LeadResult[] = [];
    for (const s of settled) if (s.status === "fulfilled") merged.push(...s.value);

    // Dedup por nome + endereço
    const seen = new Set<string>();
    const dedup: LeadResult[] = [];
    for (const r of merged) {
      const key = `${r.name.toLowerCase()}|${(r.address || "").toLowerCase().slice(0, 40)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dedup.push(r);
    }

    // Enriquece email
    let enrichedCount = 0;
    if (data.enrichEmail) {
      const sites = dedup.filter((r) => r.website && !r.email).map((r) => r.website!) as string[];
      const emailMap = await enrichEmailsBatch(sites);
      for (const r of dedup) {
        if (!r.email && r.website && emailMap.has(r.website)) {
          r.email = emailMap.get(r.website)!;
          if (r.email) enrichedCount++;
        }
      }
    }

    return {
      results: dedup,
      meta: {
        bbox,
        googleUsed,
        emailsFound: enrichedCount,
        total: dedup.length,
      },
    };
  });
