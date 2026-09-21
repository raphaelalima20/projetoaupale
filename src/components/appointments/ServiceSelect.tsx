import { Clock } from "lucide-react";
import Select from "@/components/ui/Select";
import ServicePriceLabel from "@/components/services/ServicePriceLabel";
import { formatServicePriceText } from "@/lib/services";
import type { Service } from "@/lib/types/database";
import { cn } from "@/lib/utils";

interface ServiceSelectProps {
  services: Service[];
  value: string | null;
  onChange: (serviceId: string) => void;
  variant?: "dropdown" | "cards";
  label?: string;
}

export default function ServiceSelect({
  services,
  value,
  onChange,
  variant = "dropdown",
  label = "Serviço",
}: ServiceSelectProps) {
  if (variant === "dropdown") {
    return (
      <Select
        label={label}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        required
      >
        <option value="" disabled>
          Selecione um serviço
        </option>
        {services.map((service) => (
          <option key={service.id} value={service.id}>
            {service.name} — {formatServicePriceText(service.price, service.is_variable_price)}
          </option>
        ))}
      </Select>
    );
  }

  const packages = services.filter((s) => s.type === "pacote");
  const individual = services.filter((s) => s.type === "individual");

  return (
    <div className="flex flex-col gap-6">
      {packages.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-textDim">
            Pacotes
          </h3>
          <div className="flex flex-col gap-2">
            {packages.map((service) => (
              <ServiceOptionCard
                key={service.id}
                service={service}
                selected={value === service.id}
                onClick={() => onChange(service.id)}
              />
            ))}
          </div>
        </div>
      )}

      {individual.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-textDim">
            Serviços
          </h3>
          <div className="flex flex-col gap-2">
            {individual.map((service) => (
              <ServiceOptionCard
                key={service.id}
                service={service}
                selected={value === service.id}
                onClick={() => onChange(service.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceOptionCard({
  service,
  selected,
  onClick,
}: {
  service: Service;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-between rounded-btn border px-4 py-3 text-left transition duration-200",
        selected
          ? "border-gold bg-gold-dim"
          : "border-border hover:border-gold/50"
      )}
    >
      <div>
        <p className={cn("text-sm font-medium", selected ? "text-gold-light" : "text-text")}>
          {service.name}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-textDim">
          <Clock size={12} />
          {service.duration_minutes} min
        </p>
      </div>
      <ServicePriceLabel
        price={service.price}
        isVariablePrice={service.is_variable_price}
        prominent
        className={cn("text-sm font-medium", selected ? "text-gold-light" : "text-text")}
      />
    </button>
  );
}
