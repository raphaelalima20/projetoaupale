import Link from "next/link";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import CartButton from "@/components/cart/CartButton";

export default function ClientTopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/cliente">
          <Logo showName size={40} />
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <CartButton />
        </div>
      </div>
    </header>
  );
}
