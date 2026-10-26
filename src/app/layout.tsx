import type { Metadata, Viewport } from "next";
import "@fontsource-variable/onest";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "GapFinder AI — find the gaps that matter",
    template: "%s · GapFinder AI",
  },
  description:
    "Evidence-grounded learning-gap diagnosis and adaptive revision planning built on your own study material.",
  applicationName: "GapFinder AI",
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
};

const themeScript = `(function(){try{var stored=localStorage.getItem("gapfinder-theme");var prefersDark=window.matchMedia("(prefers-color-scheme: dark)").matches;var theme=stored==="dark"||stored==="light"?stored:(prefersDark?"dark":"light");var root=document.documentElement;root.dataset.theme=theme;root.style.colorScheme=theme;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
