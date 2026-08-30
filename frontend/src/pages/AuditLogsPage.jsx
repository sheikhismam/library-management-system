import React, { useState, useEffect } from "react";
import { api } from "../api/api";
import {
  Button,
  Input,
  Table,
  TableHead,
  TableRow,
  TableCell,
  Modal,
} from "../components";
import { useI18n } from "../context/I18nContext";

const ACTION_OPTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "CHECKOUT",
  "CHECKIN",
  "RENEW",
  "PAY_FINE",
  "WAIVE_FINE",
  "RESERVATION",
];

const ACTION_STYLES = {
  CREATE: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  CHECKOUT: "bg-indigo-100 text-indigo-700",
  CHECKIN: "bg-teal-100 text-teal-700",
  RENEW: "bg-violet-100 text-violet-700",
  PAY_FINE: "bg-emerald-100 text-emerald-700",
  WAIVE_FINE: "bg-amber-100 text-amber-700",
  RESERVATION: "bg-fuchsia-100 text-fuchsia-700",
};

const extractPage = (url) => {
  if (!url) return null;
  const parsed = new URL(url);
  return Number(parsed.searchParams.get("page")) || null;
};

const formatTimestamp = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const AuditLogsPage = () => {
  const { t } = useI18n();
  const [logs, setLogs] = useState([]);
  const [count, setCount] = useState(0);
  const [prevPage, setPrevPage] = useState(null);
  const [nextPage, setNextPage] = useState(null);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  const fetchLogs = async (pageNum = 1, overrides = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page: pageNum };
      const actionVal = overrides.action !== undefined ? overrides.action : action;
      const searchVal = overrides.search !== undefined ? overrides.search : search;
      const startVal = overrides.startDate !== undefined ? overrides.startDate : startDate;
      const endVal = overrides.endDate !== undefined ? overrides.endDate : endDate;
      if (actionVal) params.action = actionVal;
      if (searchVal.trim()) params.search = searchVal.trim();
      if (startVal) params.start = startVal;
      if (endVal) params.end = endVal;
      const res = await api.get("/api/v1/audit-logs/audit-logs/", { params });
      setLogs(res.data.results || []);
      setCount(res.data.count || 0);
      setPrevPage(extractPage(res.data.previous));
      setNextPage(extractPage(res.data.next));
      setPage(pageNum);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
      setError(t("audit.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs(1);
  };

  const resetFilters = () => {
    setAction("");
    setSearch("");
    setStartDate("");
    setEndDate("");
    setPage(1);
    fetchLogs(1, { action: "", search: "", startDate: "", endDate: "" });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t("audit.title")}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {loading
              ? t("common.loading")
              : count === 1
                ? t("audit.countOne", { n: count })
                : t("audit.count", { n: count })}
          </p>
        </div>
        <form onSubmit={applyFilters} className="flex items-center gap-2 flex-wrap">
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2 px-3 bg-white"
          >
            <option value="">{t("audit.allActions")}</option>
            {ACTION_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {a.replace("_", " ")}
              </option>
            ))}
          </select>
          <Input
            type="text"
            placeholder={t("audit.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-40"
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-40"
          />
          <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {t("audit.apply")}
          </Button>
          {(action || search || startDate || endDate) && (
            <Button
              type="button"
              onClick={resetFilters}
              className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            >
              {t("common.reset")}
            </Button>
          )}
        </form>
      </div>

      {error && (
        <div className="bg-red-100 border-red-400 text-red-700 px-4 py-3 rounded-md mb-4">
          <span className="font-medium">{error}</span>
        </div>
      )}

      <div className="bg-white rounded-lg overflow-hidden shadow-sm">
        {loading ? (
          <p className="p-6 text-gray-500">{t("audit.loading")}</p>
        ) : logs.length === 0 ? (
          <p className="p-6 text-gray-500">{t("audit.empty")}</p>
        ) : (
          <Table>
            <TableHead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">{t("audit.timestamp")}</th>
                <th className="px-4 py-3">{t("audit.action")}</th>
                <th className="px-4 py-3">{t("audit.entity")}</th>
                <th className="px-4 py-3">{t("audit.user")}</th>
                <th className="px-4 py-3">{t("audit.ip")}</th>
                <th className="px-4 py-3">{t("audit.details")}</th>
              </tr>
            </TableHead>
            <tbody>
              {logs.map((log) => (
                <TableRow
                  key={log.id}
                  className="cursor-pointer hover:bg-indigo-50/50"
                >
                  <TableCell onClick={() => setSelected(log)}>
                    {formatTimestamp(log.timestamp)}
                  </TableCell>
                  <TableCell onClick={() => setSelected(log)}>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        ACTION_STYLES[log.action] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {log.action}
                    </span>
                  </TableCell>
                  <TableCell onClick={() => setSelected(log)}>
                    <p className="font-medium text-gray-900">{log.entity_type}</p>
                    <p className="text-xs text-gray-500">#{log.entity_id}</p>
                  </TableCell>
                  <TableCell onClick={() => setSelected(log)}>
                    {log.user ? t("audit.userSys", { n: log.user }) : t("audit.system")}
                  </TableCell>
                  <TableCell onClick={() => setSelected(log)}>
                    {log.ip_address || "-"}
                  </TableCell>
                  <TableCell onClick={() => setSelected(log)}>
                    <p className="max-w-xs truncate text-gray-600">
                      {log.summary ||
                        (typeof log.details === "object"
                          ? JSON.stringify(log.details)
                          : String(log.details))}
                    </p>
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      {!loading && logs.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <Button
            size="sm"
            disabled={!prevPage}
            onClick={() => fetchLogs(prevPage)}
            className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            {t("common.previous")}
          </Button>
          <span className="text-sm text-gray-500">{t("common.page")} {page}</span>
          <Button
            size="sm"
            disabled={!nextPage}
            onClick={() => fetchLogs(nextPage)}
            className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            {t("common.next")}
          </Button>
        </div>
      )}

      {selected && (
        <Modal onClose={() => setSelected(null)} maxWidth="max-w-xl">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{t("audit.logDetails")}</h3>
            <p className="text-sm text-gray-500 mb-4">
              {selected.entity_type} #{selected.entity_id} •{" "}
              {formatTimestamp(selected.timestamp)}
            </p>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                <dt className="text-gray-500 font-medium">{t("audit.action")}</dt>
                <dd className="text-gray-900 font-medium">{selected.action}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                <dt className="text-gray-500 font-medium">{t("audit.entity")}</dt>
                <dd className="text-gray-900">
                  {selected.entity_type}
                  {selected.entity_id ? ` #${selected.entity_id}` : ""}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                <dt className="text-gray-500 font-medium">{t("audit.user")}</dt>
                <dd className="text-gray-900">
                  {selected.user ? t("audit.userSys", { n: selected.user }) : t("audit.system")}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                <dt className="text-gray-500 font-medium">{t("audit.ip")}</dt>
                <dd className="text-gray-900">{selected.ip_address || "-"}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                <dt className="text-gray-500 font-medium">{t("audit.timestamp")}</dt>
                <dd className="text-gray-900">
                  {formatTimestamp(selected.timestamp)}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 font-medium mb-1">{t("audit.details")}</dt>
                <dd className="bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-700 font-mono text-xs">
                  <pre className="whitespace-pre-wrap break-words">
                    {typeof selected.details === "object"
                      ? JSON.stringify(selected.details, null, 2)
                      : String(selected.details)}
                  </pre>
                </dd>
              </div>
            </dl>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AuditLogsPage;