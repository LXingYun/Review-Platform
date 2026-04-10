import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { appThemes, type AppTheme } from "@/lib/app-themes";

const defaultTheme: AppTheme = "editorial";

function ThemeSanitizer() {
  const { theme, setTheme } = useTheme();

  React.useEffect(() => {
    if (!theme) return;

    const isKnownTheme = appThemes.some((item) => item.value === theme);
    if (!isKnownTheme) {
      setTheme(defaultTheme);
    }
  }, [theme, setTheme]);

  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme={defaultTheme}
      enableSystem={false}
      themes={appThemes.map((theme) => theme.value)}
      storageKey="review-platform-theme"
      disableTransitionOnChange
    >
      <ThemeSanitizer />
      {children}
    </NextThemesProvider>
  );
}
