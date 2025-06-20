import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "high-contrast";
type FontSize = "small" | "normal" | "large" | "xl";

type ThemeContextType = {
  theme: Theme;
  fontSize: FontSize;
  setTheme: (theme: Theme) => void;
  setFontSize: (fontSize: FontSize) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [fontSize, setFontSize] = useState<FontSize>("normal");

  useEffect(() => {
    // Load saved preferences from localStorage
    const savedTheme = localStorage.getItem("needcareai-theme") as Theme;
    const savedFontSize = localStorage.getItem("needcareai-font-size") as FontSize;
    
    if (savedTheme) setTheme(savedTheme);
    if (savedFontSize) setFontSize(savedFontSize);
  }, []);

  useEffect(() => {
    // Apply theme to document
    const root = document.documentElement;
    root.classList.remove("light", "dark", "high-contrast");
    root.classList.add(theme);
    
    // Save to localStorage
    localStorage.setItem("needcareai-theme", theme);
  }, [theme]);

  useEffect(() => {
    // Apply font size to document
    const root = document.documentElement;
    root.classList.remove("font-small", "font-normal", "font-large", "font-xl");
    root.classList.add(`font-${fontSize}`);
    
    // Save to localStorage
    localStorage.setItem("needcareai-font-size", fontSize);
  }, [fontSize]);

  return (
    <ThemeContext.Provider value={{ theme, fontSize, setTheme, setFontSize }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}