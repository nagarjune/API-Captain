import { useEffect, useState } from "react";

const readIsDarkTheme = (): boolean => {
  if (typeof document === "undefined") {
    return true;
  }
  return document.documentElement.classList.contains("dark");
};

export function useIsDarkTheme() {
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => readIsDarkTheme());

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDarkTheme(root.classList.contains("dark"));
    });

    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  return isDarkTheme;
}
