import React, { useState, useEffect, useRef } from "react";
import { api } from "../api/api";
import { Button } from "../components";
import { useI18n } from "../context/I18nContext";

const downloadPdf = async (url, filename, onSuccess, onFailure) => {
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
    console.error("PDF download failed:", err);
    onFailure();
  }
};

const MemberPicker = ({ onSelect, value }) => {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  const search = async (q) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get("/api/v1/members/", { params: { search: q.trim() } });
      setResults(res.data.results || []);
      setOpen(true);
    } catch (err) {
      console.error("Member search failed:", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={boxRef}>
      {value ? (
        <div className="flex items-center justify-between rounded-md border border-gray-300 bg-gray-50 px-3 py-2">
          <span className="text-sm text-gray-900 truncate">{value.label}</span>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              onSelect(null);
            }}
            className="ml-2 text-gray-400 hover:text-gray-600 text-sm"
          >
            ✕
          </button>
        </div>
      ) : (
        <input
          type="text"
          value={query}
          placeholder={t("reports.searchMember")}
          onChange={(e) => {
            setQuery(e.target.value);
            search(e.target.value);
          }}
          className="w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2 px-3 bg-white"
        />
      )}
      {open && results.length > 0 && !value && (
        <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {loading && <li className="px-3 py-2 text-sm text-gray-500">{t("common.loading")}</li>}
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect({ id: m.id, label: `${m.full_name} (${m.member_code})` });
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 focus:outline-none"
              >
                <span className="font-medium text-gray-900">{m.full_name}</span>
                <span className="text-gray-500"> • {m.member_code}</span>
              </button>
            </li>
          ))}
          {!loading && results.length === 0 && query.trim() && (
            <li className="px-3 py-2 text-sm text-gray-500">{t("common.noResults")}</li>
          )}
        </ul>
      )}
    </div>
  );
};

const ReportsPage = () => {
  const { t } = useI18n();
  const [member, setMember] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  const handleDownload = async (url, filename, key) => {
    setDownloading(key);
    setError(null);
    await downloadPdf(
      url,
      filename,
      () => setMessage(t("reports.downloaded", { filename })),
      () => setError(t("reports.downloadFailed"))
    );
    setDownloading(null);
  };

  const reports = [
    {
      key: "inventory",
      title: t("reports.inventory"),
      description: t("reports.inventoryDesc"),
      cta: t("reports.download"),
      filename: "library_inventory.pdf",
      url: "/api/v1/reports/inventory/",
    },
    {
      key: "overdue",
      title: t("reports.overdue"),
      description: t("reports.overdueDesc"),
      cta: t("reports.download"),
      filename: "library_overdue.pdf",
      url: "/api/v1/reports/overdue/",
    },
    {
      key: "member",
      title: t("reports.member"),
      description: t("reports.memberDesc"),
      cta: t("reports.download"),
      needsMember: true,
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t("reports.title")}</h2>
        <p className="text-sm text-gray-500 mt-1">
          {t("reports.subtitle")}
        </p>
      </div>

      {error && (
        <div className="bg-red-100 border-red-400 text-red-700 px-4 py-3 rounded-md mb-4">
          <span className="font-medium">{error}</span>
        </div>
      )}
      {message && (
        <div className="bg-green-100 border-green-400 text-green-700 px-4 py-3 rounded-md mb-4">
          <span className="font-medium">{message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {reports.map((report) => (
          <div
            key={report.key}
            className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 flex flex-col"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{report.title}</h3>
            <p className="text-sm text-gray-500 mb-4 flex-1">{report.description}</p>

            {report.needsMember && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("reports.selectMember")}
                </label>
                <MemberPicker onSelect={setMember} value={member} />
              </div>
            )}

            <Button
              disabled={
                downloading !== null ||
                (report.needsMember && !member)
              }
              onClick={() =>
                handleDownload(
                  report.needsMember
                    ? `/api/v1/reports/member/${member.id}/`
                    : report.url,
                  report.needsMember
                    ? `member_${member.id}_report.pdf`
                    : report.filename,
                  report.key
                )
              }
              className="bg-indigo-600 hover:bg-indigo-700 text-white w-full"
            >
              {downloading === report.key
                ? t("reports.downloading")
                : report.needsMember && !member
                ? t("reports.selectMemberFirst")
                : report.cta}
            </Button>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500 mt-4">{t("reports.generateNow")}</p>
    </div>
  );
};

export default ReportsPage;