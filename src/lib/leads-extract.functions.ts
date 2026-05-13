import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type LeadResult = {
  external_id: string;
  source: "osm" | "google";
  name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  reviews_count: number | null;
  photo_url: string | null;
  description: string | null;
  category: string | null;
};

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
  restaurante: ['amenity~"restaurant|fast_food|food_court"'],
  bar: ['amenity~"bar|pub|biergarten"'],
  cafe: ['amenity~"cafe|coffee_shop"'],
  lanchonete: ['amenity~"fast_food|cafe"'],
  pizzaria: ['amenity="restaurant"', 'cuisine~"pizza",i'],
  padaria: ['shop="bakery"'],
  mercado: ['shop~"supermarket|convenience|grocery|greengrocer"'],
  hortifruti: ['shop~"greengrocer|farm"'],
  acougue: ['shop="butcher"'],
  farmacia: ['amenity="pharmacy"', 'shop="chemist"'],
  "clinica medica": ['amenity~"clinic|doctors|hospital"'],
  hospital: ['amenity~"hospital|clinic"'],
  clinica: ['amenity~"clinic|doctors"'],
  dentista: ['amenity="dentist"'],
  psicologo: ['healthcare="psychotherapist"', 'amenity="doctors"'],
  fisioterapeuta: ['healthcare="physiotherapist"'],
  veterinario: ['amenity="veterinary"'],
  petshop: ['shop="pet"'],
  barbearia: ['shop~"hairdresser"', 'craft~"barbershop"'],
  "salao de beleza": ['shop~"hairdresser|beauty"'],
  estetica: ['shop~"beauty|cosmetics"', 'amenity="spa"'],
  manicure: ['shop~"beauty|nail"'],
  academia: ['leisure~"fitness_centre|sports_centre"', 'sport~"fitness"'],
  "estudio de pilates": ['leisure="fitness_centre"', 'sport~"pilates|yoga"'],
  hotel: ['tourism~"hotel|motel|apartment"'],
  pousada: ['tourism~"guest_house|hostel|chalet"'],
  airbnb: ['tourism~"apartment|guest_house|chalet"'],
  escola: ['amenity~"school|kindergarten"'],
  "curso de idiomas": ['amenity~"language_school|school"'],
  "curso tecnico": ['amenity~"college|university|school"'],
  "auto-escola": ['amenity="driving_school"'],
  igreja: ['amenity="place_of_worship"'],
  "oficina mecanica": ['shop~"car_repair|motorcycle_repair"'],
  "posto de gasolina": ['amenity="fuel"'],
  "lava-rapido": ['amenity="car_wash"'],
  "auto eletrica": ['shop~"car_repair|car_parts"'],
  "loja de roupas": ['shop~"clothes|fashion|boutique"'],
  "loja de calcados": ['shop="shoes"'],
  "loja de moveis": ['shop="furniture"'],
  "loja de eletronicos": ['shop~"electronics|mobile_phone|computer|hifi"'],
  otica: ['shop="optician"'],
  contabilidade: ['office~"accountant|tax"'],
  advogado: ['office="lawyer"'],
  imobiliaria: ['office="estate_agent"'],
  "corretor de seguros": ['office~"insurance"'],
  construtora: ['office~"company|construction"', 'craft~"builder"'],
  "material de construcao": ['shop~"doityourself|hardware|trade|building_supplies"'],
  marcenaria: ['craft~"carpenter|joiner"'],
  serralheria: ['craft~"metal_construction|blacksmith"'],
  buffet: ['amenity~"restaurant|events_venue"'],
  "festas e eventos": ['amenity~"events_venue|community_centre"'],
  fotografo: ['shop="photo"', 'craft="photographer"'],
  grafica: ['shop~"copyshop|stationery"', 'craft~"printer"'],
};

function normalizeKey(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function nicheFilters(niche: string): string[] {
  const k = normalizeKey(niche);
  if (!k) return ['shop', 'amenity~"restaurant|cafe|bar|fast_food|pharmacy|fuel|bank"', 'office', 'craft', 'tourism~"hotel|guest_house"'];
  if (OSM_NICHE_MAP[k]) return OSM_NICHE_MAP[k];
  // tenta correspondência parcial
  for (const key of Object.keys(OSM_NICHE_MAP)) {
    if (k.includes(key) || key.includes(k)) return OSM_NICHE_MAP[key];
  }
  // fallback: também busca por nome contendo o termo
  return [
    `shop~"${k}",i`, `amenity~"${k}",i`, `office~"${k}",i`, `craft~"${k}",i`,
    `name~"${k}",i`,
  ];
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const BAD_EMAIL = /(\.png|\.jpg|\.jpeg|\.svg|\.gif|\.webp|sentry|wixpress|example\.com|@2x|@3x|sentry\.io)/i;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/g;
const OG_IMAGE_RE = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i;
const TWITTER_IMAGE_RE = /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i;
const ICON_RE = /<link[^>]+rel=["'](?:apple-touch-icon|icon|shortcut icon)["'][^>]+href=["']([^"']+)["']/i;

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

function pickBestPhone(text: string): string | null {
  const matches = text.match(PHONE_RE) || [];
  for (const m of matches) {
    const digits = m.replace(/\D/g, "");
    if (digits.length >= 9 && digits.length <= 15) return m.trim();
  }
  return null;
}

function pickImage(html: string, baseUrl: string): string | null {
  const m = html.match(OG_IMAGE_RE) || html.match(TWITTER_IMAGE_RE) || html.match(ICON_RE);
  if (!m?.[1]) return null;
  try { return new URL(m[1], baseUrl).toString(); } catch { return null; }
}

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

async function geocode(country: string, state: string, city: string) {
  // Tenta busca livre (q=) — funciona melhor para cidades internacionais
  const q = [city, state, country].filter(Boolean).join(", ");
  const attempts: string[] = [
    `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ format: "jsonv2", limit: "1", q, addressdetails: "0" }).toString()}`,
    `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ format: "jsonv2", limit: "1", country, city, ...(state ? { state } : {}), addressdetails: "0" }).toString()}`,
    `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ format: "jsonv2", limit: "1", q: city, addressdetails: "0" }).toString()}`,
  ];
  let lastErr: any = null;
  for (const url of attempts) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "InfinityIA-Leads/1.0", "Accept-Language": "en;q=0.9,pt-BR;q=0.8" },
        signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) { lastErr = new Error(`Geocode ${r.status}`); continue; }
      const arr = await r.json() as Array<{ lat: string; lon: string; boundingbox: [string, string, string, string]; display_name: string }>;
      if (!arr.length) { lastErr = new Error("Sem resultados"); continue; }
      const it = arr[0];
      const [s, n, w, e] = it.boundingbox.map(Number);
      return { south: s, north: n, west: w, east: e, lat: Number(it.lat), lng: Number(it.lon), label: it.display_name };
    } catch (e) { lastErr = e; }
  }
  throw new Error(`Cidade não encontrada: ${q}${lastErr ? ` (${(lastErr as Error).message})` : ""}`);
}

async function searchOSM(bbox: any, niche: string, name: string, limit: number): Promise<LeadResult[]> {
  const filters = nicheFilters(niche);
  const nameFilter = name ? `[name~"${name.replace(/[\\"]/g, "")}",i]` : "";
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const blocks = filters.flatMap((f) => [
    `node[${f}]${nameFilter}(${bboxStr});`,
    `way[${f}]${nameFilter}(${bboxStr});`,
  ]).join("\n");
  const query = `[out:json][timeout:18];(\n${blocks}\n);out center ${limit};`;

  const endpoints = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
  let lastErr: any;
  for (const url of endpoints) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "InfinityIA-Leads/1.0" },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(20000),
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
          photo_url: tags.image
            || (tags.wikimedia_commons ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(String(tags.wikimedia_commons).replace(/^File:/i, ""))}?width=400` : null)
            || tags["image:url"] || tags.flag || null,
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

export type EnrichInfo = { email: string | null; phone: string | null; image: string | null };

export async function enrichSitesBatch(websites: string[]): Promise<Map<string, EnrichInfo>> {
  const out = new Map<string, EnrichInfo>();
  const apiKey = process.env.FIRECRAWL_API_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!apiKey || !websites.length) return out;

  // Cache lookup (apenas email — phone/image são baratos pra extrair junto)
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
  const deadline = Date.now() + 14000;
  const concurrency = 8;
  let idx = 0;
  async function worker() {
    while (idx < websites.length && Date.now() < deadline) {
      const i = idx++;
      const w = websites[i];
      const dom = domainOf(w);
      const info: EnrichInfo = { email: null, phone: null, image: null };
      const urls = [w, w.replace(/\/$/, "") + "/contato", w.replace(/\/$/, "") + "/contact"];
      for (const u of urls) {
        if ((info.email && info.phone && info.image) || Date.now() > deadline) break;
        try {
          const fc = await fetch("https://api.firecrawl.dev/v2/scrape", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ url: u, formats: ["markdown", "html"], onlyMainContent: false, timeout: 6000 }),
            signal: AbortSignal.timeout(7000),
          });
          if (!fc.ok) continue;
          const fj = await fc.json();
          const md = fj?.data?.markdown || "";
          const html = fj?.data?.html || "";
          const text = md + "\n" + html;
          if (!info.email) info.email = cacheMap.get(dom) ?? pickBestEmail(text);
          if (!info.phone) info.phone = pickBestPhone(text);
          if (!info.image) info.image = pickImage(html, u) || fj?.data?.metadata?.ogImage || null;
        } catch {}
      }
      // Se cache tinha email, prioriza
      if (cacheMap.has(dom) && !info.email) info.email = cacheMap.get(dom)!;
      out.set(w, info);
      upserts.push({ domain: dom, email: info.email, scraped_at: new Date().toISOString() });
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

async function searchFirecrawl(niche: string, name: string, city: string, state: string, country: string, limit: number): Promise<LeadResult[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return [];
  const loc = [city, state, country].filter(Boolean).join(", ");
  const term = name ? `${niche} ${name}` : (niche || "business");
  const isBR = /brasil|brazil|portugal/i.test(country);
  const queries = isBR
    ? [`${term} em ${loc} contato telefone`, `${term} ${loc} site oficial`, `melhores ${term} ${city}`]
    : [`${term} in ${loc} contact phone`, `${term} ${loc} official website`, `best ${term} ${city}`];
  const results: LeadResult[] = [];
  const seenUrls = new Set<string>();
  const deadline = Date.now() + 10000;
  for (const q of queries) {
    if (results.length >= limit || Date.now() > deadline) break;
    try {
      const r = await fetch("https://api.firecrawl.dev/v2/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, limit: 10 }),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) continue;
      const j = await r.json() as { data?: { web?: Array<{ url: string; title?: string; description?: string }> } | Array<any> };
      const items: Array<{ url: string; title?: string; description?: string }> = Array.isArray(j.data)
        ? (j.data as any[])
        : ((j.data as any)?.web || []);
      for (const it of items) {
        if (!it.url || seenUrls.has(it.url)) continue;
        const dom = domainOf(it.url);
        // ignora agregadores/diretórios
        if (/(yelp|tripadvisor|google\.|facebook\.|instagram\.|wikipedia|youtube|maps\.app|foursquare|ifood|ubereats|olx\.|mercadolivre|guiamais|telelistas|apontador|booking\.|airbnb|kekanto)/i.test(dom)) continue;
        seenUrls.add(it.url);
        const title = (it.title || dom).replace(/\s*[\|\-–—]\s*.*$/, "").trim().slice(0, 120);
        results.push({
          external_id: `fc:${dom}`,
          source: "osm",
          name: title || dom,
          phone: null,
          email: null,
          website: `https://${dom}`,
          address: null,
          lat: null,
          lng: null,
          rating: null,
          reviews_count: null,
          photo_url: null,
          description: it.description || null,
          category: niche || null,
        });
        if (results.length >= limit) break;
      }
    } catch {}
  }
  return results;
}

export const extractLeads = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ExtractSchema.parse(d))
  .handler(async ({ data }) => {
    const bbox = await geocode(data.country, data.state, data.city);

    const tasks: Array<Promise<LeadResult[]>> = [
      searchOSM(bbox, data.niche, data.name, data.limit),
      searchFirecrawl(data.niche, data.name, data.city, data.state, data.country, Math.min(30, data.limit)),
    ];
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

    // Dedup por nome + endereço (e por domínio do site quando sem endereço)
    const seen = new Set<string>();
    const dedup: LeadResult[] = [];
    for (const r of merged) {
      const addrKey = (r.address || "").toLowerCase().slice(0, 40);
      const siteKey = r.website ? domainOf(r.website) : "";
      const key = `${r.name.toLowerCase()}|${addrKey}|${siteKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dedup.push(r);
    }

    // Enriquece sites: email + telefone + imagem (og:image / favicon)
    let enrichedCount = 0;
    if (data.enrichEmail) {
      const sites = (dedup
        .filter((r) => r.website && (!r.email || !r.phone || !r.photo_url))
        .map((r) => r.website!) as string[]).slice(0, 25);
      const infoMap = await enrichSitesBatch(sites);
      for (const r of dedup) {
        if (!r.website) continue;
        const info = infoMap.get(r.website);
        if (!info) continue;
        if (!r.email && info.email) { r.email = info.email; enrichedCount++; }
        if (!r.phone && info.phone) r.phone = info.phone;
        if (!r.photo_url && info.image) r.photo_url = info.image;
      }
    }

    // Filtra: só mantém leads com pelo menos telefone, email OU site
    const filtered = dedup.filter((r) => (r.phone && r.phone.trim()) || (r.email && r.email.trim()) || (r.website && r.website.trim()));

    return {
      results: filtered,
      meta: {
        bbox,
        googleUsed,
        emailsFound: enrichedCount,
        total: filtered.length,
        filteredOut: dedup.length - filtered.length,
      },
    };
  });
