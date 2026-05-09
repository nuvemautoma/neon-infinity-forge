import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ============================================================
// Tipos compartilhados
// ============================================================
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

// ============================================================
// 1) GEOCODE — bbox da cidade via Nominatim
// ============================================================
const GeocodeSchema = z.object({
  country: z.string().min(2).max(60),
  state: z.string().min(1).max(80).optional().default(""),
  city: z.string().min(1).max(120),
});

export const geocodeCity = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => GeocodeSchema.parse(d))
  .handler(async ({ data }) => {
    const params = new URLSearchParams({
      format: "jsonv2",
      limit: "1",
      country: data.country,
      city: data.city,
      addressdetails: "0",
    });
    if (data.state) params.set("state", data.state);

    const r = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        "User-Agent": "InfinityIA-Leads/1.0 (contato@infinity.ia)",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
    });
    if (!r.ok) throw new Error(`Falha ao geocodificar (${r.status})`);
    const arr = (await r.json()) as Array<{
      lat: string;
      lon: string;
      boundingbox: [string, string, string, string];
      display_name: string;
    }>;
    if (!arr.length) throw new Error("Cidade não encontrada");
    const it = arr[0];
    const [s, n, w, e] = it.boundingbox.map(Number);
    return {
      south: s,
      north: n,
      west: w,
      east: e,
      lat: Number(it.lat),
      lng: Number(it.lon),
      label: it.display_name,
    };
  });

// ============================================================
// 2) BUSCA OSM (Overpass)
// ============================================================
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
  oficina: ['shop~"car_repair|motorcycle_repair"', 'craft~"car_repair"'],
  posto: ['amenity="fuel"'],
  loja: ['shop'],
  roupas: ['shop~"clothes|fashion|boutique"'],
  calcados: ['shop="shoes"'],
  moveis: ['shop="furniture"'],
  eletronicos: ['shop~"electronics|mobile_phone|computer"'],
  contabilidade: ['office="accountant"'],
  advogado: ['office="lawyer"'],
  imobiliaria: ['office="estate_agent"'],
  arquiteto: ['office="architect"'],
  designer: ['office~"graphic_designer|architect"'],
};

function nicheFilters(niche: string): string[] {
  const k = niche.trim().toLowerCase();
  if (!k) return ['shop', 'amenity', 'office', 'craft', 'tourism'];
  const direct = OSM_NICHE_MAP[k];
  if (direct) return direct;
  // fallback: tenta no name e no shop/amenity por substring
  return [`shop~"${k}",i`, `amenity~"${k}",i`, `office~"${k}",i`, `craft~"${k}",i`];
}

const OsmSchema = z.object({
  bbox: z.object({ south: z.number(), west: z.number(), north: z.number(), east: z.number() }),
  niche: z.string().max(80).default(""),
  name: z.string().max(120).optional().default(""),
  limit: z.number().min(1).max(300).default(150),
});

function buildOverpassQuery(bbox: { south: number; west: number; north: number; east: number }, niche: string, name: string, limit: number) {
  const filters = nicheFilters(niche);
  const nameFilter = name ? `[name~"${name.replace(/[\\"]/g, "")}",i]` : "";
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  // Para cada filtro, geramos node/way
  const blocks = filters.flatMap((f) => [
    `node[${f}]${nameFilter}(${bboxStr});`,
    `way[${f}]${nameFilter}(${bboxStr});`,
  ]).join("\n");
  return `[out:json][timeout:30];(\n${blocks}\n);out center ${limit};`;
}

export const searchLeadsOSM = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => OsmSchema.parse(d))
  .handler(async ({ data }): Promise<LeadResult[]> => {
    const query = buildOverpassQuery(data.bbox, data.niche, data.name, data.limit);
    const endpoints = [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
    ];
    let lastErr: any;
    for (const url of endpoints) {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "InfinityIA-Leads/1.0" },
          body: `data=${encodeURIComponent(query)}`,
        });
        if (!r.ok) { lastErr = new Error(`Overpass ${r.status}`); continue; }
        const json = (await r.json()) as { elements?: Array<any> };
        const els = json.elements || [];
        const seen = new Set<string>();
        const results: LeadResult[] = [];
        for (const el of els) {
          const tags = el.tags || {};
          const name = tags.name || tags["name:pt"] || tags["brand"];
          if (!name) continue;
          const key = `${name}|${tags["addr:street"] || ""}|${tags["addr:housenumber"] || ""}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const lat = el.lat ?? el.center?.lat ?? null;
          const lng = el.lon ?? el.center?.lon ?? null;
          const addrParts = [tags["addr:street"], tags["addr:housenumber"], tags["addr:suburb"], tags["addr:city"]].filter(Boolean);
          results.push({
            external_id: `osm:${el.type}/${el.id}`,
            source: "osm",
            name,
            phone: tags.phone || tags["contact:phone"] || tags["contact:mobile"] || null,
            email: tags.email || tags["contact:email"] || null,
            website: tags.website || tags["contact:website"] || tags.url || null,
            address: addrParts.length ? addrParts.join(", ") : null,
            lat,
            lng,
            rating: null,
            reviews_count: null,
            photo_url: tags.image || null,
            description: tags.description || tags.cuisine || tags.shop || tags.amenity || null,
            category: tags.shop || tags.amenity || tags.office || tags.craft || tags.tourism || null,
          });
        }
        return results.slice(0, data.limit);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Falha em todos os endpoints Overpass");
  });

// ============================================================
// 3) BUSCA Google Places (opcional)
// ============================================================
const GoogleSchema = z.object({
  query: z.string().min(1).max(200),
  lat: z.number(),
  lng: z.number(),
  radius: z.number().min(500).max(50000).default(15000),
  apiKey: z.string().min(10).max(120),
  limit: z.number().min(1).max(60).default(40),
});

export const searchLeadsGoogle = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => GoogleSchema.parse(d))
  .handler(async ({ data }): Promise<LeadResult[]> => {
    // Text Search
    const ts = new URLSearchParams({
      query: data.query,
      location: `${data.lat},${data.lng}`,
      radius: String(data.radius),
      key: data.apiKey,
    });
    const r = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${ts.toString()}`);
    if (!r.ok) throw new Error(`Google Places ${r.status}`);
    const j = (await r.json()) as { results?: Array<any>; status?: string; error_message?: string };
    if (j.status && !["OK", "ZERO_RESULTS"].includes(j.status)) {
      throw new Error(`Google: ${j.status} ${j.error_message || ""}`);
    }
    const top = (j.results || []).slice(0, data.limit);

    const detailed = await Promise.all(
      top.map(async (p) => {
        try {
          const dp = new URLSearchParams({
            place_id: p.place_id,
            fields: "name,formatted_phone_number,international_phone_number,website,formatted_address,geometry,rating,user_ratings_total,photos,types,editorial_summary",
            key: data.apiKey,
          });
          const dr = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${dp.toString()}`);
          const dj = (await dr.json()) as { result?: any };
          return { p, d: dj.result || {} };
        } catch {
          return { p, d: {} };
        }
      })
    );

    return detailed.map(({ p, d }): LeadResult => {
      const photoRef = d.photos?.[0]?.photo_reference || p.photos?.[0]?.photo_reference;
      const photo_url = photoRef
        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoRef}&key=${data.apiKey}`
        : null;
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
        photo_url,
        description: d.editorial_summary?.overview || (Array.isArray(p.types) ? p.types.slice(0, 3).join(", ") : null),
        category: Array.isArray(p.types) ? p.types[0] : null,
      };
    });
  });

// ============================================================
// 4) ENRIQUECIMENTO DE EMAIL via Firecrawl
// ============================================================
const EmailSchema = z.object({
  websites: z.array(z.string().url()).max(60),
});

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const BAD_EMAIL_PARTS = /(\.png|\.jpg|\.jpeg|\.svg|\.gif|\.webp|sentry|wixpress|example\.com|@2x|@3x)/i;

function pickBestEmail(text: string): string | null {
  const matches = text.match(EMAIL_RE) || [];
  const cleaned = matches
    .map((m) => m.toLowerCase())
    .filter((m) => !BAD_EMAIL_PARTS.test(m))
    .filter((m) => !m.startsWith("noreply") && !m.startsWith("no-reply"));
  if (!cleaned.length) return null;
  // Preferir contato/comercial/atendimento
  const pref = cleaned.find((m) => /^(contato|contact|comercial|vendas|atendimento|sac|info)/.test(m));
  return pref || cleaned[0];
}

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

export const enrichEmails = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => EmailSchema.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      // Sem Firecrawl: retorna vazio, não é erro fatal
      return { results: data.websites.map((w) => ({ website: w, email: null as string | null })) };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!;

    // Cache lookup via REST
    const domains = Array.from(new Set(data.websites.map(domainOf)));
    const cacheMap = new Map<string, string | null>();
    if (domains.length) {
      try {
        const inList = domains.map((d) => `"${d}"`).join(",");
        const cacheRes = await fetch(
          `${SUPABASE_URL}/rest/v1/email_scrape_cache?domain=in.(${encodeURIComponent(inList)})&select=domain,email,scraped_at`,
          { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
        );
        if (cacheRes.ok) {
          const rows = (await cacheRes.json()) as Array<{ domain: string; email: string | null; scraped_at: string }>;
          const now = Date.now();
          for (const r of rows) {
            const age = now - new Date(r.scraped_at).getTime();
            if (age < 30 * 24 * 60 * 60 * 1000) cacheMap.set(r.domain, r.email);
          }
        }
      } catch {}
    }

    const upserts: Array<{ domain: string; email: string | null }> = [];
    const results = await Promise.all(
      data.websites.map(async (website) => {
        const dom = domainOf(website);
        if (cacheMap.has(dom)) return { website, email: cacheMap.get(dom)! };

        let email: string | null = null;
        // Tenta home + /contato + /contact
        const urls = [website, website.replace(/\/$/, "") + "/contato", website.replace(/\/$/, "") + "/contact"];
        for (const u of urls) {
          if (email) break;
          try {
            const fc = await fetch("https://api.firecrawl.dev/v2/scrape", {
              method: "POST",
              headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ url: u, formats: ["markdown", "html"], onlyMainContent: false, timeout: 15000 }),
            });
            if (!fc.ok) continue;
            const fj = await fc.json();
            const text = (fj?.data?.markdown || "") + "\n" + (fj?.data?.html || "");
            email = pickBestEmail(text);
          } catch {}
        }
        upserts.push({ domain: dom, email });
        return { website, email };
      })
    );

    // Persist cache (ignora erros)
    if (upserts.length) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/email_scrape_cache`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates",
          },
          body: JSON.stringify(upserts.map((u) => ({ ...u, scraped_at: new Date().toISOString() }))),
        });
      } catch {}
    }

    return { results };
  });

// ============================================================
// 5) Buscar chave Google Places (apenas leitura segura — só admin obtém)
// ============================================================
export const getGooglePlacesKey = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    // Verifica se é admin
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/user_roles?user_id=eq.${data.userId}&role=eq.admin&select=role`,
      { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }
    );
    if (!r.ok) throw new Error("Falha ao verificar permissão");
    const rows = await r.json();
    if (!Array.isArray(rows) || !rows.length) throw new Error("Apenas admins");
    const sr = await fetch(
      `${SUPABASE_URL}/rest/v1/site_settings?select=google_places_api_key&limit=1`,
      { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }
    );
    const srows = await sr.json();
    return { apiKey: (srows?.[0]?.google_places_api_key as string) || "" };
  });
