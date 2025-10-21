"use client";

import { useLanguage } from "@/i18n/context";

export function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <label className="flex items-center gap-2 text-xs font-medium text-slate-400">
      <span>{t("language.label")}</span>
      <select
        className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
        value={language}
        onChange={(event) => setLanguage(event.target.value as typeof language)}
      >
        <option value="ko">{t("language.korean")}</option>
        <option value="en">{t("language.english")}</option>
      </select>
    </label>
  );
}
