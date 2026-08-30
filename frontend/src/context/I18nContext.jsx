import { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import { translations } from "../i18n/translations";

const LANG_KEY = "lms_lang";

const I18nContext = createContext({
  lang: "en",
  setLanguage: () => {},
  t: () => "",
});

export const useI18n = () => useContext(I18nContext);

const readInitialLang = () => {
  const saved = localStorage.getItem(LANG_KEY);
  return saved === "bn" ? "bn" : "en";
};

export const I18nProvider = ({ children }) => {
  const [lang, setLang] = useState(() => readInitialLang());

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
  }, [lang]);

  const t = useCallback(
    (key, params) => {
      let text =
        (translations[lang] && translations[lang][key]) ?? translations.en[key];
      if (params) {
        Object.entries(params).forEach(([name, value]) => {
          text = String(text).replaceAll(`{${name}}`, String(value));
        });
      }
      return text;
    },
    [lang],
  );

  const setLanguage = useCallback((next) => {
    setLang(next === "bn" ? "bn" : "en");
  }, []);

  const value = useMemo(() => ({ lang, setLanguage, t }), [lang, setLanguage, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};