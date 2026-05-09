import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, X } from "lucide-react";

interface ComboboxProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  allowCustom?: boolean;
}

export function Combobox({ value, onChange, options, placeholder, required, allowCustom = true }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const q = query.toLowerCase().trim();
  const filtered = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;

  const select = (v: string) => {
    onChange(v);
    setQuery(v);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          value={query}
          required={required}
          onChange={(e) => { setQuery(e.target.value); if (allowCustom) onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full pl-4 pr-16 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm focus:border-primary focus:outline-none transition-colors"
        />
        {value && (
          <button type="button" onClick={() => { onChange(""); setQuery(""); }} className="absolute right-8 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground" aria-label="Limpar">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <button type="button" onClick={() => setOpen((o) => !o)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground" aria-label="Abrir lista">
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-xl bg-popover border border-border shadow-2xl glass-strong">
          {filtered.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => select(o)}
              className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-primary/10 hover:text-primary flex items-center justify-between transition-colors"
            >
              <span className="truncate">{o}</span>
              {value === o && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
