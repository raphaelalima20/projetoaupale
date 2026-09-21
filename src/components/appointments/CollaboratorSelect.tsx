import Select from "@/components/ui/Select";
import CollaboratorAvatar from "@/components/ui/CollaboratorAvatar";
import SpecialtyText from "@/components/collaborators/SpecialtyText";
import type { Profile } from "@/lib/types/database";
import { cn } from "@/lib/utils";

interface CollaboratorSelectProps {
  collaborators: Profile[];
  value: string | null;
  onChange: (collaboratorId: string) => void;
  variant?: "dropdown" | "cards";
  label?: string;
  disabled?: boolean;
}

export default function CollaboratorSelect({
  collaborators,
  value,
  onChange,
  variant = "dropdown",
  label = "Profissional",
  disabled,
}: CollaboratorSelectProps) {
  if (variant === "dropdown") {
    return (
      <Select
        label={label}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required
      >
        <option value="" disabled>
          Selecione uma profissional
        </option>
        {collaborators.map((c) => (
          <option key={c.id} value={c.id}>
            {c.full_name}
          </option>
        ))}
      </Select>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {collaborators.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          className={cn(
            "flex flex-col items-center gap-2 rounded-btn border px-3 py-4 text-center transition duration-200",
            value === c.id
              ? "border-gold bg-gold-dim"
              : "border-border hover:border-gold/50"
          )}
        >
          <CollaboratorAvatar
            name={c.full_name}
            color={c.avatar_color}
            photoUrl={c.photo_url}
            size={48}
          />
          <div className="w-full min-w-0">
            <p className={cn("truncate text-sm", value === c.id ? "text-gold-light" : "text-text")}>
              {c.full_name}
            </p>
            <SpecialtyText
              specialty={c.specialty}
              fallback="Profissional"
              className="block text-[11px] text-textDim"
            />
          </div>
        </button>
      ))}
    </div>
  );
}
