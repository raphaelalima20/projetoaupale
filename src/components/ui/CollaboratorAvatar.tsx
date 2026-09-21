import { getInitials } from "@/lib/utils";

interface CollaboratorAvatarProps {
  name: string;
  color?: string | null;
  photoUrl?: string | null;
  size?: number;
}

export default function CollaboratorAvatar({
  name,
  color,
  photoUrl,
  size = 36,
}: CollaboratorAvatarProps) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className="shrink-0 rounded-full border border-border object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-medium text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: color || "#C7A593",
        fontSize: size * 0.38,
      }}
    >
      {getInitials(name)}
    </div>
  );
}
