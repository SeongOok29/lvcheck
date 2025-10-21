"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { translations, type Language, type MessageKey } from "./messages";

type TranslationMap = (typeof translations)[Language];

type LanguageContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  messages: TranslationMap;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const STORAGE_KEY = "lvcheck.language";

const interpolate = (
  template: string,
  vars?: Record<string, string | number>,
): string => {
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
    template,
  );
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("ko");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY) as Language | null;
    if (stored && stored in translations) {
      setLanguageState(stored);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, lang);
    }
  };

  const messages = useMemo(() => translations[language], [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    messages,
    t: (key: MessageKey, vars?: Record<string, string | number>) =>
      interpolate(messages[key], vars),
  }), [language, messages]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

export function useTranslations() {
  const { t } = useLanguage();
  return t;
}
