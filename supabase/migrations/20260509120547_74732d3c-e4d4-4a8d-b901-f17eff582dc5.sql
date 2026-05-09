-- 1) Troca a data fixa por um span dinâmico
UPDATE public.site_settings
SET landing_html = REPLACE(
  landing_html,
  'HOJE, 6 de maio de 2026',
  'HOJE, <span id="oferta-data-hoje">hoje</span>'
)
WHERE landing_html LIKE '%HOJE, 6 de maio de 2026%';

-- 2) Reforça centralização e injeta script da data antes do </body>
UPDATE public.site_settings
SET landing_html = REPLACE(
  landing_html,
  '</body>',
  E'<style>\n#planos-section, #planos-section .planos-wrapper, #planos-section .e-con-inner { text-align: center !important; }\n#planos-section .elementor-widget-container { text-align: center !important; }\n#planos-section .elementor-heading-title, #planos-section .elementor-widget-text-editor p { text-align: center !important; margin-left: auto !important; margin-right: auto !important; }\n#planos-section .elementor-widget-heading, #planos-section .elementor-widget-text-editor { width: 100% !important; }\n</style>\n<script>(function(){try{var meses=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];function upd(){var el=document.getElementById("oferta-data-hoje");if(!el)return;var d=new Date();el.textContent=d.getDate()+" de "+meses[d.getMonth()]+" de "+d.getFullYear();}upd();setInterval(upd,60000);}catch(e){}})();</script>\n</body>'
)
WHERE landing_html LIKE '%</body>%';