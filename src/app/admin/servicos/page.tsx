"use client";

import { useEffect, useState } from "react";
import { Plus, Scissors, Package, Pencil } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import ServiceFormModal from "@/components/services/ServiceFormModal";
import ServicePriceLabel from "@/components/services/ServicePriceLabel";
import { createClient } from "@/lib/supabase/client";
import type { Service } from "@/lib/types/database";

export default function ServicosPage() {
  const [supabase] = useState(() => createClient());
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);

  async function fetchServices() {
    setLoading(true);
    const { data } = await supabase
      .from("services")
      .select("*")
      .order("sort_order", { ascending: true });
    setServices((data as Service[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const packages = services.filter((s) => s.type === "pacote");
  const individual = services.filter((s) => s.type === "individual");

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(service: Service) {
    setEditing(service);
    setModalOpen(true);
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Serviços"
        subtitle="Gerencie serviços e pacotes"
        actions={
          <Button onClick={openNew}>
            <Plus size={16} />
            Novo Serviço
          </Button>
        }
      />

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="mb-3 font-display text-lg text-text">Pacotes</h2>
            {packages.length === 0 ? (
              <Card className="py-8 text-center text-sm text-textDim">
                Nenhum pacote cadastrado
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {packages.map((service) => (
                  <Card key={service.id} className="border-gold/40">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-dim">
                        <Package size={16} className="text-gold" />
                      </div>
                      <button
                        onClick={() => openEdit(service)}
                        className="rounded-btn p-1.5 text-textDim transition duration-200 hover:bg-surface2 hover:text-text"
                      >
                        <Pencil size={15} />
                      </button>
                    </div>
                    <p className="font-display text-base text-text">{service.name}</p>
                    {service.package_period && (
                      <p className="mt-0.5 text-xs capitalize text-textDim">
                        {service.package_period}
                      </p>
                    )}
                    <ServicePriceLabel
                      price={service.price}
                      isVariablePrice={service.is_variable_price}
                      className="mt-2 block text-lg text-gold-light"
                    />
                    {!service.is_active && (
                      <Badge tone="danger" className="mt-2">
                        Inativo
                      </Badge>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 font-display text-lg text-text">Serviços Individuais</h2>
            {individual.length === 0 ? (
              <Card className="py-8 text-center text-sm text-textDim">
                Nenhum serviço cadastrado
              </Card>
            ) : (
              <div className="flex flex-col gap-2">
                {individual.map((service) => (
                  <Card key={service.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-dim">
                        <Scissors size={16} className="text-gold" />
                      </div>
                      <div>
                        <p className="text-sm text-text">{service.name}</p>
                        <p className="text-xs text-textDim">{service.duration_minutes} min</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <ServicePriceLabel
                        price={service.price}
                        isVariablePrice={service.is_variable_price}
                        className="text-sm font-medium text-text"
                      />
                      {service.is_chemical && <Badge tone="info">Químico</Badge>}
                      {!service.is_active && <Badge tone="danger">Inativo</Badge>}
                      <button
                        onClick={() => openEdit(service)}
                        className="rounded-btn p-1.5 text-textDim transition duration-200 hover:bg-surface2 hover:text-text"
                      >
                        <Pencil size={15} />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <ServiceFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={fetchServices}
        service={editing}
      />
    </div>
  );
}
