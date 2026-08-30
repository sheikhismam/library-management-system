import React, { useState, useEffect, useRef } from "react";
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
  FULFILLED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-600",
  EXPIRED: "bg-red-100 text-red-700",
};

const extraction = (url) => {
  if (!url) return null;
  const parsed = new URL(url);
  return Number(parsed.searchParams.get("page")) || null;
};

const SearchSelect = ({ placeholder, searchUrl, onSelect, value, onClear }) => {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  const doSearch = async (q) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(searchUrl, { params: { search: q.trim() } });
      setResults(res.data.results || []);
      setOpen(true);
    } catch (err) {
      console.error("Search failed:", err);
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
              onClear();
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
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            doSearch(e.target.value);
          }}
          className="w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2 px-3 bg-white"
        />
      )}
      {open && results.length > 0 && !value && (
        <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {loading && <li className="px-3 py-2 text-sm text-gray-500">{t("common.loading")}</li>}
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(item);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 focus:outline-none"
              >
                {item.full_name ? (
                  <>
                    <span className="font-medium text-gray-900">{item.full_name}</span>
                    <span className="text-gray-500"> • {item.member_code}</span>
                  </>
                ) : (
                  <>
                    <span className="font-medium text-gray-900">{item.title}</span>
                    <span className="text-gray-500"> • {item.isbn}</span>
                  </>
                )}
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

const ReservationsPage = () => {
  const { t } = useI18n();
  const [reservations, setReservations] = useState([]);
  const [count, setCount] = useState(0);
  const [prevPage, setPrevPage] = useState(null);
  const [nextPage, setNextPage] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [bookValue, setBookValue] = useState(null);
  const [memberValue, setMemberValue] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchReservations = async (pageNum = 1, overrides = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page: pageNum };
      const statusVal = overrides.status !== undefined ? overrides.status : status;
      const searchVal = overrides.search !== undefined ? overrides.search : search;
      if (statusVal) params.status = statusVal;
      if (searchVal.trim()) params.search = searchVal.trim();
      const res = await api.get("/api/v1/reservations/", { params });
      setReservations(res.data.results || []);
      setCount(res.data.count || 0);
      setPrevPage(extraction(res.data.previous));
      setNextPage(extraction(res.data.next));
      setPage(pageNum);
    } catch (err) {
      console.error("Failed to load reservations:", err);
      setError(t("reservations.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    return isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchReservations(1);
  };

  const changeStatus = (val) => {
    setStatus(val);
    setPage(1);
    fetchReservations(1, { status: val });
  };

  const resetFilters = () => {
    setStatus("");
    setSearch("");
    setPage(1);
    fetchReservations(1, { status: "", search: "" });
  };

  const createReservation = async () => {
    setCreateError(null);
    if (!bookValue || !memberValue) {
      setCreateError(t("reservations.selectBoth"));
      return;
    }
    setCreating(true);
    try {
      const res = await api.post("/api/v1/reservations/", {
        book_id: bookValue.id,
        member_id: memberValue.id,
      });
      setMessage(
        t("reservations.created", {
          member: memberValue.label,
          p: res.data.priority || "?",
        })
      );
      setShowCreate(false);
      setBookValue(null);
      setMemberValue(null);
      setPage(1);
      fetchReservations(1);
    } catch (err) {
      console.error("Failed to create reservation:", err);
      const detail =
        err.response?.data?.reservation ||
        err.response?.data?.detail ||
        err.response?.data?.error;
      setCreateError(
        Array.isArray(detail) ? detail[0] : detail || t("reservations.createFailed")
      );
    } finally {
      setCreating(false);
    }
  };

  const runAction = async () => {
    if (!confirm) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/api/v1/reservations/${confirm.id}/${confirm.action}/`);
      setMessage((res.data && res.data.message) || t("reservations.updated"));
      setConfirm(null);
      fetchReservations(page);
    } catch (err) {
      console.error("Reservation action failed:", err);
      setMessage(
        err.response?.data?.detail ||
          err.response?.data?.error ||
          t("reservations.actionFailed")
      );
      setConfirm(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t("reservations.title")}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {loading ? t("common.loading") : t("reservations.count", { n: count })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={status}
            onChange={(e) => changeStatus(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2 px-3 bg-white"
          >
            <option value="">{t("reservations.statusAll")}</option>
            <option value="PENDING">{t("reservations.pending")}</option>
            <option value="FULFILLED">{t("reservations.fulfilled")}</option>
            <option value="CANCELLED">{t("reservations.cancelled")}</option>
          </select>
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <Input
              type="text"
              placeholder={t("reservations.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56"
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
          <Button
            onClick={() => {
              setCreateError(null);
              setShowCreate(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {t("reservations.new")}
          </Button>
        </div>
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
          <p className="p-6 text-gray-500">{t("reservations.loading")}</p>
        ) : reservations.length === 0 ? (
          <p className="p-6 text-gray-500">{t("reservations.empty")}</p>
        ) : (
          <Table>
            <TableHead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">{t("reservations.priority")}</th>
                <th className="px-4 py-3">{t("reservations.book")}</th>
                <th className="px-4 py-3">{t("reservations.member")}</th>
                <th className="px-4 py-3">{t("reservations.reserved")}</th>
                <th className="px-4 py-3">{t("reservations.expires")}</th>
                <th className="px-4 py-3">{t("circulation.status")}</th>
                <th className="px-4 py-3 text-right">{t("books.actions")}</th>
              </tr>
            </TableHead>
            <tbody>
              {reservations.map((res) => (
                <TableRow key={res.id}>
                  <TableCell>
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-sm font-semibold">
                      {res.priority}
                    </span>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-gray-900">{res.book?.title}</p>
                    <p className="text-xs text-gray-500">{res.book?.isbn}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-gray-900">{res.member?.full_name || "Unknown"}</p>
                    <p className="text-xs text-gray-500">{res.member?.member_code}</p>
                  </TableCell>
                  <TableCell>{formatDate(res.reservation_date)}</TableCell>
                  <TableCell>{formatDate(res.expiry_date)}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_STYLES[res.status] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {res.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {res.status === "PENDING" ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => setConfirm({ id: res.id, action: "fulfill", title: res.book?.title, member: res.member?.full_name })}
                          className="bg-green-600 hover:bg-green-700 text-white mr-2"
                        >
                          {t("reservations.fulfill")}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setConfirm({ id: res.id, action: "cancel", title: res.book?.title, member: res.member?.full_name })}
                          className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        >
                          {t("reservations.cancel")}
                        </Button>
                      </>
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

      {!loading && reservations.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <Button
            size="sm"
            disabled={!prevPage}
            onClick={() => fetchReservations(prevPage)}
            className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            {t("common.previous")}
          </Button>
          <span className="text-sm text-gray-500">{t("common.page")} {page}</span>
          <Button
            size="sm"
            disabled={!nextPage}
            onClick={() => fetchReservations(nextPage)}
            className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            {t("common.next")}
          </Button>
        </div>
      )}

      {showCreate && (
        <Modal onClose={() => setShowCreate(false)} maxWidth="max-w-lg">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("reservations.newModal.title")}</h3>
            {createError && (
              <div className="bg-red-100 border-red-400 text-red-700 px-4 py-3 rounded-md mb-4">
                <span className="font-medium">{createError}</span>
              </div>
            )}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("reservations.book")}</label>
              <SearchSelect
                placeholder={t("reservations.searchBook")}
                searchUrl="/api/v1/books/"
                value={bookValue}
                onSelect={(item) => setBookValue({ id: item.id, label: `${item.title} (${item.isbn})` })}
                onClear={() => setBookValue(null)}
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("reservations.member")}</label>
              <SearchSelect
                placeholder={t("reservations.searchMember")}
                searchUrl="/api/v1/members/"
                value={memberValue}
                onSelect={(item) => setMemberValue({ id: item.id, label: `${item.full_name} (${item.member_code})` })}
                onClear={() => setMemberValue(null)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setShowCreate(false)}
                className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={createReservation}
                disabled={creating}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {creating ? t("reservations.creating") : t("reservations.createBtn")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {confirm && (
        <Modal onClose={() => setConfirm(null)}>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {confirm.action === "fulfill"
                ? t("reservations.confirm.fulfillTitle")
                : t("reservations.confirm.cancelTitle")}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {confirm.action === "fulfill"
                ? t("reservations.confirm.fulfillDesc", {
                    book: confirm.title,
                    member: confirm.member,
                  })
                : t("reservations.confirm.cancelDesc", {
                    book: confirm.title,
                    member: confirm.member,
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
                  confirm.action === "fulfill"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                } text-white`}
              >
                {submitting
                  ? t("common.processing")
                  : confirm.action === "fulfill"
                  ? t("reservations.confirmFulfill")
                  : t("reservations.confirmCancel")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ReservationsPage;