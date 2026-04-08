import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { appThemes } from "@/lib/app-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="editorial"
      enableSystem={false}
      themes={appThemes.map((theme) => theme.value)}
      storageKey="review-platform-theme"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
