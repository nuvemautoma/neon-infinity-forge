export interface LeadColumn {
  id: string;
  user_id: string;
  name: string;
  color: string;
  position: number;
}

export interface LeadTag {
  id: string;
  user_id: string;
  name: string;
  color: string;
}

export interface Lead {
  id: string;
  user_id: string;
  column_id: string | null;
  position: number;
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
  source: "osm" | "google" | "manual" | string;
  external_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const TAG_COLORS = [
  "#00B4FF", "#7A00FF", "#FF3D9A", "#FF7A00",
  "#FFD60A", "#34D399", "#22D3EE", "#A78BFA",
  "#F87171", "#94A3B8",
];

export const COLUMN_COLORS = TAG_COLORS;

export const NICHE_SUGGESTIONS = [
  "Restaurante", "Bar", "Café", "Lanchonete", "Pizzaria", "Padaria", "Mercado", "Hortifruti",
  "Farmácia", "Clínica médica", "Dentista", "Psicólogo", "Fisioterapeuta",
  "Barbearia", "Salão de beleza", "Estética", "Manicure", "Academia", "Estúdio de pilates",
  "Petshop", "Veterinário", "Hotel", "Pousada", "Airbnb",
  "Oficina mecânica", "Posto de gasolina", "Lava-rápido", "Auto elétrica",
  "Loja de roupas", "Loja de calçados", "Loja de móveis", "Loja de eletrônicos", "Ótica",
  "Contabilidade", "Advogado", "Imobiliária", "Corretor de seguros",
  "Construtora", "Material de construção", "Marcenaria", "Serralheria",
  "Escola", "Curso de idiomas", "Curso técnico", "Auto-escola",
  "Buffet", "Festas e eventos", "Fotógrafo", "Gráfica",
];

export const COUNTRIES = [
  "Brasil", "Portugal", "Estados Unidos", "Argentina", "Uruguai", "Paraguai", "Chile",
  "Colômbia", "México", "Espanha", "França", "Itália", "Alemanha", "Reino Unido",
  "Canadá", "Japão", "Austrália",
];

export const BR_STATES = [
  { uf: "AC", name: "Acre" }, { uf: "AL", name: "Alagoas" }, { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" }, { uf: "BA", name: "Bahia" }, { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" }, { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" }, { uf: "MA", name: "Maranhão" }, { uf: "MT", name: "Mato Grosso" },
  { uf: "MS", name: "Mato Grosso do Sul" }, { uf: "MG", name: "Minas Gerais" },
  { uf: "PA", name: "Pará" }, { uf: "PB", name: "Paraíba" }, { uf: "PR", name: "Paraná" },
  { uf: "PE", name: "Pernambuco" }, { uf: "PI", name: "Piauí" }, { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" }, { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondônia" }, { uf: "RR", name: "Roraima" }, { uf: "SC", name: "Santa Catarina" },
  { uf: "SP", name: "São Paulo" }, { uf: "SE", name: "Sergipe" }, { uf: "TO", name: "Tocantins" },
];
