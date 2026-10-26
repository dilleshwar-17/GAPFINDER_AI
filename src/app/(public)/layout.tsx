import { PublicFooter, PublicHeader } from "@/components/site-chrome";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#f9fafb]">
      <PublicHeader />
      <main id="main-content" className="relative flex-1 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(122,90,248,0.10),transparent_70%)]"
          aria-hidden
        />
        <div className="relative">{children}</div>
      </main>
      <PublicFooter />
    </div>
  );
}
