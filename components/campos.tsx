const base = "mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-3 text-base";

export function Campo({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
  required = true,
  inputMode,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string | number;
  required?: boolean;
  inputMode?: "numeric" | "text";
}) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        inputMode={inputMode}
        autoComplete="off"
        className={base}
      />
    </div>
  );
}

export function Selecao({
  label,
  name,
  opcoes,
  vazio = "Selecione…",
}: {
  label: string;
  name: string;
  opcoes: { valor: string | number; texto: string }[];
  vazio?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-semibold">
        {label}
      </label>
      <select id={name} name={name} required defaultValue="" className={base}>
        <option value="" disabled>
          {vazio}
        </option>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Selo({ ativo }: { ativo: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        ativo ? "bg-ok-bg text-ok" : "bg-border text-ink-muted"
      }`}
    >
      {ativo ? "Ativo" : "Inativo"}
    </span>
  );
}
