UPDATE public.site_settings
SET landing_html = REPLACE(
  landing_html,
  '</style>',
  E'\n/* === Centralização forçada do checkout R$ 37,90 e textos do bloco de Planos === */\n#planos-section .planos-wrapper { text-align: center !important; }\n#planos-section .planos-wrapper .elementor-widget-text-editor,\n#planos-section .planos-wrapper .elementor-widget-heading { text-align: center !important; }\n#planos-section .planos-wrapper .elementor-widget-text-editor p,\n#planos-section .planos-wrapper .elementor-heading-title { text-align: center !important; margin-left: auto !important; margin-right: auto !important; }\n#planos-section .elementor-element-07016ab { display: flex !important; justify-content: center !important; align-items: stretch !important; grid-template-columns: none !important; width: 100% !important; }\n#planos-section .elementor-element-cd6a2c5 { margin-left: auto !important; margin-right: auto !important; max-width: 520px; width: 100%; }\n</style>'
)
WHERE landing_html IS NOT NULL AND landing_html LIKE '%planos-section%';