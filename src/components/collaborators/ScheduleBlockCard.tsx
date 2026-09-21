"use client";

import { Trash2 } from "lucide-react";
import Card from "@/components/ui/Card";
import CollaboratorAvatar from "@/components/ui/CollaboratorAvatar";
import { formatBlockPeriod } from "@/lib/scheduleBlocks";
import type { Profile, ScheduleBlock } from "@/lib/types/database";

interface ScheduleBlockCardProps {
  block: ScheduleBlock;
  collaborator?: Profile;
  onRemove: () => void;
  removing: boolean;
}

export default function ScheduleBlockCard({
  block,
  collaborator,
  onRemove,
  removing,
}: ScheduleBlockCardProps) {
  return (
    <Card className="flex items-center gap-3">
      <CollaboratorAvatar
        name={collaborator?.full_name ?? "?"}
        color={collaborator?.avatar_color}
        photoUrl={collaborator?.photo_url}
        size={40}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">
          {collaborator?.full_name ?? "Colaboradora removida"}
        </p>
        <p className="text-xs text-textDim">{formatBlockPeriod(block)}</p>
        {block.reason && <p className="text-xs text-textDim">{block.reason}</p>}
      </div>
      <button
        onClick={onRemove}
        disabled={removing}
        aria-label="Remover bloqueio"
        className="shrink-0 rounded-btn p-2 text-textDim transition duration-200 hover:bg-danger/10 hover:text-danger disabled:opacity-50"
      >
        <Trash2 size={16} />
      </button>
    </Card>
  );
}
