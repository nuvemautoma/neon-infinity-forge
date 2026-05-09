
# Clonador de Páginas Profissional

Vamos construir uma ferramenta completa de clonagem + edição visual + export. A boa notícia é que **GrapesJS já está instalado** no projeto (usado em outro lugar), então a maior parte do editor sai de graça. Firecrawl também já está disponível como connector para sites com JS pesado.

## O que o usuário vai conseguir fazer

1. Colar uma URL → o sistema baixa HTML, CSS, imagens e fontes
2. Abrir tudo dentro de um editor visual (drag & drop estilo Webflow/Elementor)
3. Clicar em qualquer texto para editar inline (cor, fonte, tamanho, efeito)
4. Arrastar blocos prontos: botão, imagem, vídeo (YouTube/MP4), HTML custom, divisor, container
5. Em cada botão configurar: link, HTML custom interno, ação (rolar pra âncora, topo, base, abrir modal)
6. Aplicar animações pré-prontas: fade-in/slide-up ao entrar na viewport, parallax em backgrounds, smooth scroll
7. Remover qualquer elemento (tecla Delete ou botão lixeira)
8. Salvar projetos no banco (continuar editando depois)
9. Clicar em **Publicar** → baixa um `.html` único portátil com tudo embutido (CSS inline, JS inline, imagens em base64)

## Acesso

- Configurável por plano, igual produtos/ferramentas
- Nova coluna `cloner_allowed_plans` em `site_settings` (admin escolhe quais planos veem)
- Card aparece no `/dashboard` se o plano do usuário estiver liberado
- Admin sempre tem acesso

## Etapas de implementação

### 1. Banco de dados
Nova tabela `cloned_pages`:
- `user_id`, `name`, `source_url`
- `editor_data` (JSON do GrapesJS — components + style + assets)
- `created_at`, `updated_at`
- RLS: usuário só vê/edita os próprios; admin vê todos

Campo extra em `site_settings`: `cloner_allowed_plans` (text[]).

### 2. Endpoint de clonagem `/api/public/clone-page` (server route)
- Input: `{ url }` validado com Zod
- Requer sessão autenticada (cabeçalho de auth do Supabase)
- Estratégia híbrida:
  1. **Tenta fetch nativo** primeiro: pega HTML, baixa CSS linkados, resolve URLs relativas → absolutas
  2. **Se vazio/SPA detectado** (pouco texto, muitos `<script>`, framework conhecido) → cai pro **Firecrawl** (`scrape` com `formats: ['html', 'rawHtml', 'links']`)
- Pós-processamento no servidor:
  - Inline todos os `<link rel="stylesheet">` (baixa o CSS e injeta em `<style>`)
  - Converte cada `<img src>` e `background-image` para **data URI base64** (limite 5MB por imagem para evitar timeout)
  - Remove scripts externos perigosos, `<script>` analytics, iframes de tracking
  - Reescreve URLs relativas para absolutas onde fizer sentido manter
- Retorna HTML pronto para alimentar o GrapesJS

### 3. Página `/cloner` (lista) e `/cloner/$id` (editor)
- `/cloner`: lista projetos do usuário + botão "Nova página" (abre modal pedindo URL e nome)
- `/cloner/$id`: editor em tela cheia com GrapesJS configurado:
  - Plugins: `grapesjs-preset-webpage`, `grapesjs-blocks-basic`, `grapesjs-plugin-forms`, `grapesjs-style-bg`, `grapesjs-tabs`, `grapesjs-custom-code` (HTML custom no botão), `grapesjs-tooltip`
  - Painéis: blocos (esquerda), canvas (centro), estilos/propriedades/camadas (direita)
  - Storage manager apontando pro Supabase (auto-save a cada 10s)

### 4. Blocos customizados de animação
Criamos 5 blocos próprios que adicionam HTML + atributos `data-anim`:
- **Botão Scroll para âncora** (modal pra escolher seletor/ID alvo)
- **Botão Topo / Botão Base**
- **Wrapper Fade-in on scroll**
- **Wrapper Slide-up on scroll**
- **Section Parallax** (background fixo com efeito de profundidade)

Um único `<script>` runtime (~2KB) ativa essas animações via `IntersectionObserver` + `scroll listener`. Esse script é embutido no export.

### 5. Editor de botão (trait personalizado)
Quando o usuário clica num botão, o painel direito mostra:
- Link (URL)
- Ação: nenhuma | rolar para âncora | topo | base | abrir modal
- HTML custom interno (textarea — substitui o conteúdo do `<button>`)
- Classes de efeito hover: pulse, glow, shake, shine (CSS pré-definido)
- Cor de fundo, cor texto, raio, sombra (já vem do style manager)

### 6. Botão "Publicar e baixar ZIP"
Como você escolheu **tudo em base64**, na verdade vira **um único arquivo `.html`** portátil (mais simples que ZIP). Mas se o HTML passar de 4MB, fazemos fallback automático pra ZIP com `index.html` + pasta `/images` (híbrido seguro).

Fluxo:
1. `editor.getHtml()` + `editor.getCss()` + assets do canvas
2. Garante que toda `<img>` e `background-image` está em base64 (já vem assim do clone, mas re-checa pra imagens que o usuário arrastou)
3. Injeta CSS num `<style>` no `<head>`
4. Injeta JS de animações no final do `<body>`
5. Gera o blob e dispara download via `JSZip` (se múltiplos arquivos) ou Blob direto (se único HTML)

### 7. Admin (`/acsadmin`)
Nova aba **"Clonador"**:
- Multi-select dos planos que têm acesso (basic / plus / standard)
- Listagem de todas as páginas clonadas (nome, dono, URL fonte, data) com botão deletar

### 8. Conexão Firecrawl
Antes de implementar, vou pedir pra você conectar o Firecrawl (já está disponível como connector no Lovable) — sem isso, o fallback de SPAs não funciona, mas o fetch nativo continua resolvendo a maioria dos sites.

## Detalhes técnicos

```text
Bibliotecas novas:
  jszip                       (geração do ZIP fallback)
  grapesjs-plugin-forms
  grapesjs-style-bg
  grapesjs-custom-code
  grapesjs-tabs
  (grapesjs e preset-webpage já estão no projeto)

Arquivos novos:
  src/routes/cloner.tsx                    lista de projetos
  src/routes/cloner.$id.tsx                editor visual
  src/routes/api/public/clone-page.ts      endpoint de clonagem
  src/components/PageCloner/Editor.tsx     wrapper GrapesJS configurado
  src/components/PageCloner/blocks.ts      blocos customizados de animação
  src/components/PageCloner/runtime.ts     JS de animações (~2KB) embutido no export
  src/components/PageCloner/exporter.ts    geração do HTML/ZIP final
  src/lib/clone-utils.ts                   inlineCSS, imageToBase64, sanitize

Arquivos editados:
  src/routes/dashboard.tsx                 card "Clonador" (se plano permitir)
  src/routes/acsadmin.tsx                  nova aba "Clonador"
  supabase migration                       cloned_pages + cloner_allowed_plans
```

## Limitações honestas

- Sites com proteção anti-bot pesada (Cloudflare Challenge, hCaptcha) só funcionam via Firecrawl, e mesmo assim nem sempre
- Vídeos do YouTube ficam como iframe embed (não dá pra baixar o vídeo em base64 — ficaria gigante)
- Fontes web (Google Fonts) ficam linkadas via CDN no HTML final, não são embutidas em base64 (são poucos KB e funcionam offline pouco tempo só)
- Animações JS muito complexas do site original (GSAP, Lottie) podem não vir junto — o editor reconstrói com as animações simples nossas
- Limite prático de tamanho do HTML único: 4MB. Acima disso, vira ZIP automático

## Pendência antes de codar

Vou precisar que você **conecte o Firecrawl** (botão aparece quando eu chamar a ferramenta de connector) pro fallback de SPAs funcionar. Se preferir começar só com o fetch nativo e adicionar o Firecrawl depois, também dá.
