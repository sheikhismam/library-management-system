import React, { useState, useEffect } from "react";
import { api } from "../api/api";
import { useI18n } from "../context/I18nContext";

const downloadPdf = async (url, filename, onSuccess, onFailure, onDone) => {
  try {
    const res = await api.get(url, { responseType: "blob" });
    const blob = new Blob([res.data], { type: "application/pdf" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
    onSuccess();
  } catch (err) {
    console.error("Guide PDF download failed:", err);
    onFailure();
  } finally {
    onDone();
  }
};

const GuidePage = () => {
  const { lang, setLanguage, t } = useI18n();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    api
      .get("/api/v1/reports/guide/content/")
      .then((res) => {
        const all = res.data || {};
        setSections(all[lang] || []);
      })
      .catch((err) => {
        console.error("Failed to load guide content:", err);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [lang]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  const handleDownload = () => {
    setDownloading(true);
    setError(null);
    downloadPdf(
      "/api/v1/reports/guide/pdf/?lang=en",
      "admin_guide_en.pdf",
      () => setMessage(t("reports.downloaded", { filename: "admin_guide_en.pdf" })),
      () => setError(t("guide.downloadFailed")),
      () => setDownloading(false),
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t("guide.title")}</h2>
          <p className="text-sm text-gray-500 mt-1">{t("guide.subtitle")}</p>
        </div>

        {/* In-page language switch */}
        <div className="inline-flex rounded-md border border-gray-300 bg-white p-0.5 shadow-sm">
          <button
            type="button"
            onClick={() => setLanguage("en")}
            className={`rounded px-3 py-1.5 text-sm font-medium focus:outline-none ${
              lang === "en" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLanguage("bn")}
            className={`rounded px-3 py-1.5 text-sm font-medium focus:outline-none ${
              lang === "bn" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            বাংলা
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mb-4">
          <span className="font-medium">{error}</span>
        </div>
      )}
      {message && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-md mb-4">
          <span className="font-medium">{message}</span>
        </div>
      )}

      {/* English PDF download */}
      <div className="mb-8 flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          disabled={downloading}
          onClick={handleDownload}
          className="inline-flex items-center justify-center rounded-md bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {downloading ? t("guide.downloading") : t("guide.downloadEn")}
        </button>
        <p className="text-xs text-gray-500 self-center">{t("guide.readyToPrint")}</p>
      </div>

      {loading && <p className="text-gray-500">{t("common.loading")}</p>}
      {loadError && (
        <p className="text-red-600">{t("guide.downloadFailed")}</p>
      )}

      {!loading && !loadError && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Table of contents */}
          <aside className="lg:col-span-1">
            <div className="lg:sticky lg:top-4 rounded-lg border border-gray-200 bg-white shadow-sm p-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">{t("common.details")}</p>
              <nav className="space-y-1 max-h-96 overflow-auto">
                {sections.map((section) => (
                  <a
                    key={section.key}
                    href={`#guide-${section.key}`}
                    className="block text-sm text-gray-600 hover:text-indigo-600 hover:bg-gray-50 rounded px-2 py-1 focus:outline-none"
                  >
                    {section.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Sections */}
          <div className="lg:col-span-3 space-y-6">
            {sections.map((section) => (
              <section
                key={section.key}
                id={`guide-${section.key}`}
                className="rounded-lg border border-gray-200 bg-white shadow-sm p-6"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{section.title}</h3>
                <div className="space-y-2">
                  {section.paragraphs.map((paragraph, index) => (
                    <p key={index} className="text-sm text-gray-700 leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GuidePage;