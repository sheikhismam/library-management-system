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

const STATUS_STYLES = {
  PENDING: "bg-amber-100 text-amber-700",
  PAID: "bg-green-100 text-green-700",
  WAIVED: "bg-gray-100 text-gray-600",
};

const extractPage = (url) => {
  if (!url) return null;
  const parsed = new URL(url);
  return Number(parsed.searchParams.get("page")) || null;
};

const FinesPage = () => {
  const { t } = useI18n();
  const [fines, setFines] = useState([]);
  const [count, setCount] = useState(0);
  const [prevPage, setPrevPage] = useState(null);
  const [nextPage, setNextPage] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchFines = async (pageNum = 1, overrides = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page: pageNum };
      const statusVal = overrides.status !== undefined ? overrides.status : status;
      const searchVal = overrides.search !== undefined ? overrides.search : search;
      if (statusVal) params.status = statusVal;
      if (searchVal.trim()) params.search = searchVal.trim();
      const res = await api.get("/api/v1/fines/", { params });
      setFines(res.data.results || []);
      setCount(res.data.count || 0);
      setPrevPage(extractPage(res.data.previous));
      setNextPage(extractPage(res.data.next));
      setPage(pageNum);
    } catch (err) {
      console.error("Failed to load fines:", err);
      setError(t("fines.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFines(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  const formatMoney = (value) => {
    const num = parseFloat(value);
    return isNaN(num) ? "-" : `$${num.toFixed(2)}`;
  };

  const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    return isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
  };

  const runAction = async () => {
    if (!confirm) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/api/v1/fines/${confirm.fine.id}/${confirm.action}/`);
      const resMsg =
        (res.data && res.data.message) ||
        (confirm.action === "pay"
          ? t("fines.paySuccess")
          : t("fines.waiveSuccess"));
      setMessage(resMsg);
      setConfirm(null);
      fetchFines(page);
    } catch (err) {
      console.error("Fine action failed:", err);
      const detail = err.response?.data?.detail || err.response?.data?.error;
      setMessage(
        detail
          ? t("fines.errorPrefix", { detail })
          : t("fines.actionFailed")
      );
      setConfirm(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchFines(1);
  };

  const changeStatus = (val) => {
    setStatus(val);
    setPage(1);
    fetchFines(1, { status: val });
  };

  const resetFilters = () => {
    setStatus("");
    setSearch("");
    setPage(1);
    fetchFines(1, { status: "", search: "" });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t("fines.title")}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {loading ? t("common.loading") : t("fines.count", { n: count })}
          </p>
        </div>
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-wrap">
          <select
            value={status}
            onChange={(e) => changeStatus(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2 px-3 bg-white"
          >
            <option value="">{t("fines.statusAll")}</option>
            <option value="PENDING">{t("fines.pending")}</option>
            <option value="PAID">{t("fines.paid")}</option>
            <option value="WAIVED">{t("fines.waived")}</option>
          </select>
          <Input
            type="text"
            placeholder={t("fines.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {t("common.search")}
          </Button>
          {(status || search) && (
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
      {message && (
        <div className="bg-green-100 border-green-400 text-green-700 px-4 py-3 rounded-md mb-4">
          <span className="font-medium">{message}</span>
        </div>
      )}

      <div className="bg-white rounded-lg overflow-hidden shadow-sm">
        {loading ? (
          <p className="p-6 text-gray-500">{t("fines.loading")}</p>
        ) : fines.length === 0 ? (
          <p className="p-6 text-gray-500">{t("fines.empty")}</p>
        ) : (
          <Table>
            <TableHead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">{t("fines.member")}</th>
                <th className="px-4 py-3">{t("fines.book")}</th>
                <th className="px-4 py-3">{t("fines.dueDate")}</th>
                <th className="px-4 py-3 text-right">{t("fines.amount")}</th>
                <th className="px-4 py-3">{t("fines.status")}</th>
                <th className="px-4 py-3 text-right">{t("fines.actions")}</th>
              </tr>
            </TableHead>
            <tbody>
              {fines.map((fine) => (
                <TableRow key={fine.id}>
                  <TableCell>
                    <p className="font-medium text-gray-900">
                      {fine.member?.full_name || "Unknown"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {fine.member?.member_code}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="text-gray-900">{fine.book_title}</p>
                    <p className="text-xs text-gray-500">{fine.book_isbn}</p>
                  </TableCell>
                  <TableCell>
                    <p>{formatDate(fine.due_date)}</p>
                    {fine.reason && (
                      <p className="text-xs text-gray-500">{fine.reason}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(fine.amount)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_STYLES[fine.status] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {fine.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {fine.status === "PENDING" ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => setConfirm({ fine, action: "pay" })}
                          className="bg-green-600 hover:bg-green-700 text-white mr-2"
                        >
                          {t("fines.pay")}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setConfirm({ fine, action: "waive" })}
                          className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        >
                          {t("fines.waive")}
                        </Button>
                      </>
                    ) : fine.status === "PAID" && fine.paid_date ? (
                      <span className="text-xs text-gray-500">
                        {t("fines.paidOn", { date: formatDate(fine.paid_date) })}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      {!loading && fines.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <Button
            size="sm"
            disabled={!prevPage}
            onClick={() => fetchFines(prevPage)}
            className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            {t("common.previous")}
          </Button>
          <span className="text-sm text-gray-500">{t("common.page")} {page}</span>
          <Button
            size="sm"
            disabled={!nextPage}
            onClick={() => fetchFines(nextPage)}
            className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            {t("common.next")}
          </Button>
        </div>
      )}

      {confirm && (
        <Modal onClose={() => setConfirm(null)}>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {confirm.action === "pay"
                ? t("fines.payModal.title")
                : t("fines.waiveModal.title")}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {confirm.action === "pay"
                ? t("fines.payModal.description", {
                    amount: formatMoney(confirm.fine.amount),
                    book: confirm.fine.book_title,
                    member: confirm.fine.member?.full_name || "Unknown",
                  })
                : t("fines.waiveModal.description", {
                    amount: formatMoney(confirm.fine.amount),
                    book: confirm.fine.book_title,
                    member: confirm.fine.member?.full_name || "Unknown",
                  })}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setConfirm(null)}
                className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={runAction}
                disabled={submitting}
                className={`${
                  confirm.action === "pay"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                } text-white`}
              >
                {submitting
                  ? t("fines.processing")
                  : confirm.action === "pay"
                  ? t("fines.confirmPayment")
                  : t("fines.confirmWaive")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default FinesPage;