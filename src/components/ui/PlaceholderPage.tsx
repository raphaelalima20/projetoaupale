import { LucideIcon } from "lucide-react";
import Card from "./Card";

interface PlaceholderPageProps {
  icon: LucideIcon;
  title: string;
}

export default function PlaceholderPage({ icon: Icon, title }: PlaceholderPageProps) {
  return (
    <Card className="flex flex-col items-center justify-center gap-4 py-20 text-center animate-fadeIn">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-dim">
        <Icon size={30} className="text-gold" strokeWidth={1.5} />
      </div>
      <div>
        <h2 className="font-display text-xl text-text">{title}</h2>
        <p className="mt-1 text-sm text-textDim">Em breve</p>
      </div>
    </Card>
  );
}
