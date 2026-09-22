import type { MegaTecnica, MegaTipo } from "./types/database";
import { MEGA_COMBINACOES } from "./types/database";

export const MEGA_TECNICA_OPTIONS: { value: MegaTecnica; label: string }[] = [
  { value: "fita", label: "Fita" },
  { value: "tela", label: "Tela" },
  { value: "queratina", label: "Queratina" },
];

export const MEGA_TIPO_OPTIONS: { value: MegaTipo; label: string }[] = [
  { value: "aplicacao", label: "Aplicação" },
  { value: "manutencao", label: "Manutenção" },
];

export const MEGA_COMBINACAO_OPTIONS = MEGA_COMBINACOES;

export function megaTipoLabel(value: MegaTipo | null | undefined): string {
  return MEGA_TIPO_OPTIONS.find((o) => o.value === value)?.label ?? "—";
}

export function megaTecnicaLabel(value: MegaTecnica | string | null | undefined): string {
  return MEGA_TECNICA_OPTIONS.find((o) => o.value === value)?.label ?? String(value ?? "—");
}
