import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import RequestBuilder from "./pages/RequestBuilder";
import NotFound from "./pages/NotFound";
import { applyBuilderTheme, BUILDER_THEME_STORAGE_KEY, getStoredBuilderSettings } from "@/lib/builderTheme";

const queryClient = new QueryClient();

const BuilderThemeBootstrap = () => {
  useEffect(() => {
    const applyStoredTheme = () => {
      applyBuilderTheme(getStoredBuilderSettings());
    };

    applyStoredTheme();

    const storageListener = (event: StorageEvent) => {
      if (!event.key || event.key === BUILDER_THEME_STORAGE_KEY) {
        applyStoredTheme();
      }
    };

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const mediaListener = () => {
      const settings = getStoredBuilderSettings();
      if (settings.mode === "system") {
        applyBuilderTheme(settings);
      }
    };

    window.addEventListener("storage", storageListener);
    media.addEventListener("change", mediaListener);
    return () => {
      window.removeEventListener("storage", storageListener);
      media.removeEventListener("change", mediaListener);
    };
  }, []);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BuilderThemeBootstrap />
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/builder" element={<RequestBuilder />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
