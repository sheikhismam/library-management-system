import React, { useState, useEffect, useCallback } from "react";
import { api } from "../api/api";
import QrScannerModal from "../components/QrScannerModal";
import { Modal } from "../components";
import { useI18n } from "../context/I18nContext";

const inputClass =
  "w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2 px-3 bg-white";
const primaryBtnClass =
  "inline-flex items-center justify-center rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed";
const smBtnClass =
  "inline-flex items-center justify-center rounded-md text-sm font-medium px-3 py-1 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
const thClass =
  "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider";

const CirculationPage = () => {
  const { t } = useI18n();
  const [tab, setTab] = useState("active");
  const [activeLoans, setActiveLoans] = useState([]);
  const [overdueLoans, setOverdueLoans] = useState([]);
  const [members, setMembers] = useState([]);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [actionLoanId, setActionLoanId] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnError, setReturnError] = useState(null);

  const [form, setForm] = useState({ bookId: "", memberId: "", loanDays: 14, notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState(null);

  const extractList = (data) => (data && data.results ? data.results : data || []);

  const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    return isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
  };

  const formatMoney = (value) => {
    const num = parseFloat(value);
    return isNaN(num) ? "-" : `$${num.toFixed(2)}`;
  };

  const readError = (err) => {
    const data = err && err.response && err.response.data;
    if (!data) return (err && err.message) || "Request failed.";
    if (typeof data === "string") return data;
    if (data.message) return data.message;
    if (data.detail) return data.detail;
    if (data.error) return data.error;
    const firstKey = Object.keys(data)[0];
    if (firstKey) {
      const val = data[firstKey];
      if (Array.isArray(val)) return `${firstKey}: ${val[0]}`;
      return `${firstKey}: ${val}`;
    }
    return "Request failed.";
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [borrowedRes, overdueStatusRes, overdueRes, membersRes, booksRes] = await Promise.all([
        api.get("/api/v1/circulation/loans/", { params: { status: "BORROWED" } }),
        api.get("/api/v1/circulation/loans/", { params: { status: "OVERDUE" } }),
        api.get("/api/v1/circulation/overdue/"),
        api.get("/api/v1/members/"),
        api.get("/api/v1/books/"),
      ]);

      const active = [
        ...extractList(borrowedRes.data),
        ...extractList(overdueStatusRes.data),
      ]
        .filter((loan) => loan.status !== "RETURNED")
        .sort((a, b) => new Date(b.borrow_date || 0) - new Date(a.borrow_date || 0));

      const overdue = extractList(overdueRes.data).sort(
        (a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0)
      );

      setActiveLoans(active);
      setOverdueLoans(overdue);
      setMembers(extractList(membersRes.data));
      setBooks(extractList(booksRes.data));
    } catch (err) {
      setError(t("circulation.loadError"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(null), 6000);
    return () => clearTimeout(timer);
  }, [message]);

  const isBusy = (loan, type) => actionLoanId === loan.id && actionType === type;

  const canRenew = (loan) =>
    loan.status !== "RETURNED" &&
    !loan.is_overdue &&
    (loan.renewal_count || 0) < (loan.max_renewals || 2);

  const handleIssue = async (e) => {
    e.preventDefault();
    if (!form.bookId || !form.memberId) {
      setFormError(t("circulation.selectBoth"));
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setError(null);
    try {
      const res = await api.post("/api/v1/circulation/checkout/", {
        book_identifier: String(form.bookId),
        member_identifier: String(form.memberId),
        loan_days: Number(form.loanDays) || 14,
        notes: form.notes,
      });
      setMessage(res.data.message || t("circulation.issued"));
      setForm({ bookId: "", memberId: "", loanDays: 14, notes: "" });
      await fetchData();
    } catch (err) {
      setFormError(readError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const openScanner = () => {
    setScanStatus(null);
    setScannerOpen(true);
  };

  const handleScan = async (decodedText) => {
    const raw = (decodedText || "").trim();
    if (!raw) {
      // A detection with no usable text still needs visible feedback so the
      // user is not left wondering why nothing happened.
      setScanStatus(t("circulation.invalidQr", { raw: decodedText || "" }));
      return;
    }

    const bookMatch = raw.match(/^(?:LMS:)?BOOK:(.+)$/i);
    const memberMatch = raw.match(/^(?:LMS:)?MEMBER:(.+)$/i);

    if (bookMatch) {
      const isbn = bookMatch[1].trim();
      const found = books.find(
        (b) => b.isbn && b.isbn.toLowerCase() === isbn.toLowerCase()
      );
      if (found) {
        if ((found.available_copies || 0) < 1) {
          setScanStatus(t("circulation.noCopies", { title: found.title }));
          return;
        }
        setForm((prev) => ({ ...prev, bookId: String(found.id) }));
        setScanStatus(null);
        setScannerOpen(false);
        setMessage(t("circulation.scanSelected", { name: found.title }));
        return;
      }
      try {
        const res = await api.post("/api/v1/circulation/qr-scan-action/", {
          qr_payload: raw,
        });
        const book = res.data && res.data.book;
        if (res.data && res.data.entity_type === "BOOK" && book) {
          if ((book.available_copies || 0) < 1) {
            setScanStatus(t("circulation.noCopies", { title: book.title }));
            return;
          }
          setBooks((prev) =>
            prev.some((b) => b.id === book.id) ? prev : [book, ...prev]
          );
          setForm((prev) => ({ ...prev, bookId: String(book.id) }));
          setScanStatus(null);
          setScannerOpen(false);
          setMessage(t("circulation.scanSelected", { name: book.title }));
          return;
        }
      } catch (err) {
        setScanStatus(readError(err));
        return;
      }
      setScanStatus(t("circulation.bookNotFound", { isbn }));
      return;
    }

    if (memberMatch) {
      const code = memberMatch[1].trim();
      const found = members.find(
        (m) => m.member_code && m.member_code.toLowerCase() === code.toLowerCase()
      );
      if (found) {
        if (found.membership_status !== "ACTIVE") {
          setScanStatus(
            t("circulation.memberNotActive", {
              name: found.full_name,
              status: found.membership_status,
            })
          );
          return;
        }
        setForm((prev) => ({ ...prev, memberId: String(found.id) }));
        setScanStatus(null);
        setScannerOpen(false);
        setMessage(t("circulation.scanSelected", { name: found.full_name }));
        return;
      }
      try {
        const res = await api.post("/api/v1/circulation/qr-scan-action/", {
          qr_payload: raw,
        });
        const member = res.data && res.data.member;
        if (res.data && res.data.entity_type === "MEMBER" && member) {
          if (member.membership_status !== "ACTIVE") {
            setScanStatus(
              t("circulation.memberNotActive", {
                name: member.full_name,
                status: member.membership_status,
              })
            );
            return;
          }
          setMembers((prev) =>
            prev.some((m) => m.id === member.id) ? prev : [member, ...prev]
          );
          setForm((prev) => ({ ...prev, memberId: String(member.id) }));
          setScanStatus(null);
          setScannerOpen(false);
          setMessage(t("circulation.scanSelected", { name: member.full_name }));
          return;
        }
      } catch (err) {
        setScanStatus(readError(err));
        return;
      }
      setScanStatus(t("circulation.memberNotFound", { code }));
      return;
    }

    setScanStatus(t("circulation.invalidQr", { raw }));
  };

  const handleReturn = async () => {
    if (!returnTarget) return;
    const loan = returnTarget;
    setActionLoanId(loan.id);
    setActionType("return");
    setError(null);
    setReturnError(null);
    try {
      const res = await api.post("/api/v1/circulation/checkin/", {
        borrowing_id: loan.id,
        notes: "",
      });
      let msg = res.data.message || t("circulation.returned");
      if (res.data.fine_assessed && res.data.fine) {
        msg += t("circulation.fineAssessed", {
          amount: formatMoney(res.data.fine.amount),
        });
      }
      setMessage(msg);
      setReturnTarget(null);
      await fetchData();
    } catch (err) {
      setReturnError(readError(err));
    } finally {
      setActionLoanId(null);
      setActionType(null);
    }
  };

  const handleRenew = async (loan) => {
    setActionLoanId(loan.id);
    setActionType("renew");
    setError(null);
    try {
      const res = await api.post(`/api/v1/circulation/renew/${loan.id}/`, {
        additional_days: 14,
        notes: "",
      });
      setMessage(res.data.message || t("circulation.renewed"));
      await fetchData();
    } catch (err) {
      setError(readError(err));
    } finally {
      setActionLoanId(null);
      setActionType(null);
    }
  };

  const tabBase =
    "px-4 py-2 text-sm font-medium rounded-t-md border-b-2 focus:outline-none focus:ring-2 focus:ring-offset-2";

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        {t("circulation.title")}
      </h2>

      {/* Issue / Check-out form */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {t("circulation.issue")}
          </h3>
          <button
            onClick={openScanner}
            className="inline-flex items-center justify-center rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-medium px-3 py-1.5 border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {t("circulation.scanQr")}
          </button>
        </div>
        <form onSubmit={handleIssue} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("circulation.member")}
            </label>
            <select
              value={form.memberId}
              onChange={(e) => setForm({ ...form, memberId: e.target.value })}
              disabled={submitting}
              className={inputClass}
            >
              <option value="">{t("circulation.selectMember")}</option>
              {members.map((m) => (
                <option
                  key={m.id}
                  value={m.id}
                  disabled={m.membership_status !== "ACTIVE"}
                >
                  {m.full_name} ({m.member_code})
                  {m.membership_status !== "ACTIVE" ? t("circulation.notActive") : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("circulation.book")}
            </label>
            <select
              value={form.bookId}
              onChange={(e) => setForm({ ...form, bookId: e.target.value })}
              disabled={submitting}
              className={inputClass}
            >
              <option value="">{t("circulation.selectBook")}</option>
              {books.map((b) => (
                <option
                  key={b.id}
                  value={b.id}
                  disabled={(b.available_copies || 0) < 1}
                >
                  {b.title}
                  {b.isbn ? ` (${b.isbn})` : ""} — {t("circulation.available", { n: b.available_copies || 0 })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("circulation.loanDays")}
            </label>
            <input
              type="number"
              min="1"
              max="90"
              value={form.loanDays}
              onChange={(e) => setForm({ ...form, loanDays: e.target.value })}
              disabled={submitting}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("circulation.notes")}
            </label>
            <input
              type="text"
              value={form.notes}
              placeholder={t("circulation.notesPlaceholder")}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              disabled={submitting}
              className={inputClass}
            />
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <button type="submit" disabled={submitting} className={primaryBtnClass}>
              {submitting ? t("circulation.issuing") : t("circulation.issueBtn")}
            </button>
            {formError && (
              <span className="text-sm text-red-600">{formError}</span>
            )}
          </div>
        </form>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-100 border-red-400 text-red-700 px-4 py-3 rounded-md mb-4">
          <span className="font-medium">{error}</span>
          <button
            className="float-right text-red-500 hover:text-red-700 text-lg leading-none"
            onClick={() => setError(null)}
            title={t("circulation.dismiss")}
          >
            ×
          </button>
        </div>
      )}

      {/* Success message */}
      {message && (
        <div className="bg-green-100 border-green-400 text-green-700 px-4 py-3 rounded-md mb-4">
          <span className="font-medium">{message}</span>
          <button
            className="float-right text-green-500 hover:text-green-700 text-lg leading-none"
            onClick={() => setMessage(null)}
            title={t("circulation.dismiss")}
          >
            ×
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-4 mb-4 border-b border-gray-200">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("active")}
            className={`${tabBase} ${
              tab === "active"
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t("circulation.activeLoans", { n: activeLoans.length })}
          </button>
          <button
            onClick={() => setTab("overdue")}
            className={`${tabBase} ${
              tab === "overdue"
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t("circulation.overdueLoans", { n: overdueLoans.length })}
          </button>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="ml-auto inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 px-4 py-2 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {t("common.refresh")}
        </button>
      </div>

      {/* Loading state */}
      {loading ? (
        <p className="text-gray-500">{t("circulation.loading")}</p>
      ) : tab === "active" ? (
        activeLoans.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            {t("circulation.noActive")}
          </p>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={thClass}>{t("circulation.bookCol")}</th>
                    <th className={thClass}>{t("circulation.memberCol")}</th>
                    <th className={thClass}>{t("circulation.borrowed")}</th>
                    <th className={thClass}>{t("circulation.due")}</th>
                    <th className={thClass}>{t("circulation.status")}</th>
                    <th className={`${thClass} text-right`}>{t("circulation.fine")}</th>
                    <th className={`${thClass} text-center`}>{t("circulation.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {activeLoans.map((loan) => (
                    <tr key={loan.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="font-medium">{loan.book.title}</div>
                        <div className="text-xs text-gray-500">
                          {loan.book.isbn || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div>{loan.member.full_name}</div>
                        <div className="text-xs text-gray-500">
                          {loan.member.member_code}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(loan.borrow_date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(loan.due_date)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={
                            loan.is_overdue
                              ? "text-red-600 font-medium"
                              : "text-green-600"
                          }
                        >
                          {loan.is_overdue ? "OVERDUE" : loan.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {loan.is_overdue ? (
                          <span className="text-red-600 font-medium">
                            {formatMoney(loan.calculated_fine)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-center whitespace-nowrap">
                        <button
                          onClick={() => handleRenew(loan)}
                          disabled={!canRenew(loan) || isBusy(loan, "renew")}
                          title={
                            !canRenew(loan)
                              ? loan.is_overdue
                                ? t("circulation.notRenewableOverdue")
                                : t("circulation.notRenewableLimit")
                              : ""
                          }
                          className={`${smBtnClass} bg-blue-100 hover:bg-blue-200 text-blue-700`}
                        >
                          {isBusy(loan, "renew") ? t("circulation.renewing") : t("circulation.renew")}
                        </button>
                        <button
                          onClick={() => {
                            setReturnError(null);
                            setReturnTarget(loan);
                          }}
                          disabled={isBusy(loan, "return")}
                          className={`${smBtnClass} ml-1 bg-green-100 hover:bg-green-200 text-green-700`}
                        >
                          {isBusy(loan, "return") ? t("circulation.returning") : t("circulation.return")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : overdueLoans.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          {t("circulation.noOverdue")}
        </p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className={thClass}>{t("circulation.bookCol")}</th>
                  <th className={thClass}>{t("circulation.memberCol")}</th>
                  <th className={thClass}>{t("circulation.due")}</th>
                  <th className={thClass}>{t("circulation.overdueDays")}</th>
                  <th className={`${thClass} text-right`}>{t("circulation.fine")}</th>
                  <th className={`${thClass} text-center`}>{t("circulation.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {overdueLoans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="font-medium">{loan.book.title}</div>
                      <div className="text-xs text-gray-500">
                        {loan.book.isbn || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div>{loan.member.full_name}</div>
                      <div className="text-xs text-gray-500">
                        {loan.member.member_code}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(loan.due_date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-red-600 font-medium">
                      {loan.overdue_days || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">
                      {formatMoney(loan.calculated_fine)}
                    </td>
                    <td className="px-4 py-3 text-sm text-center whitespace-nowrap">
                      <button
                        onClick={() => {
                          setReturnError(null);
                          setReturnTarget(loan);
                        }}
                        disabled={isBusy(loan, "return")}
                        className={`${smBtnClass} bg-green-100 hover:bg-green-200 text-green-700`}
                      >
                        {isBusy(loan, "return") ? t("circulation.returning") : t("circulation.return")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Return confirmation modal */}
      {returnTarget && (
        <Modal onClose={() => setReturnTarget(null)} maxWidth="max-w-sm">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-1">
              {t("circulation.returnModal.title")}
            </h3>
            <p className="text-sm mb-4">
              {t("circulation.returnModal.description", {
                book: returnTarget.book.title,
                member: returnTarget.member.full_name,
              })}
            </p>

            <dl className="border border-gray-200 rounded-md divide-y divide-gray-200 text-sm mb-4">
              <div className="flex justify-between px-3 py-2">
                <dt className="text-gray-500">{t("circulation.returnModal.book")}</dt>
                <dd className="text-gray-900 font-medium text-right">
                  {returnTarget.book.title}
                  {returnTarget.book.isbn ? (
                    <span className="block text-xs text-gray-500 font-normal">
                      {t("circulation.returnModal.isbn")}: {returnTarget.book.isbn}
                    </span>
                  ) : null}
                </dd>
              </div>
              <div className="flex justify-between px-3 py-2">
                <dt className="text-gray-500">{t("circulation.returnModal.member")}</dt>
                <dd className="text-gray-900 font-medium text-right">
                  {returnTarget.member.full_name}
                  <span className="block text-xs text-gray-500 font-normal">
                    {t("circulation.returnModal.memberCode")}: {returnTarget.member.member_code}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between px-3 py-2">
                <dt className="text-gray-500">{t("circulation.returnModal.borrowDate")}</dt>
                <dd className="text-gray-900">{formatDate(returnTarget.borrow_date)}</dd>
              </div>
              <div className="flex justify-between px-3 py-2">
                <dt className="text-gray-500">{t("circulation.returnModal.dueDate")}</dt>
                <dd className="text-gray-900">{formatDate(returnTarget.due_date)}</dd>
              </div>
              <div className="flex justify-between px-3 py-2">
                <dt className="text-gray-500">{t("circulation.returnModal.status")}</dt>
                <dd
                  className={
                    returnTarget.is_overdue
                      ? "text-red-600 font-medium"
                      : "text-green-600 font-medium"
                  }
                >
                  {returnTarget.is_overdue ? "OVERDUE" : returnTarget.status}
                </dd>
              </div>
            </dl>

            {returnTarget.is_overdue && (
              <p className="text-sm text-red-600 mb-4">
                {t("circulation.returnModal.overdueNotice", {
                  amount: formatMoney(returnTarget.calculated_fine),
                })}
              </p>
            )}
            {returnError && (
              <p className="text-sm text-red-600 mb-4">
                {returnError || t("circulation.returnModal.error")}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReturnTarget(null)}
                disabled={isBusy(returnTarget, "return")}
                className="rounded-md bg-gray-100 hover:bg-gray-200 px-4 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleReturn}
                disabled={isBusy(returnTarget, "return")}
                className="rounded-md bg-green-600 hover:bg-green-700 px-4 py-2 text-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {isBusy(returnTarget, "return")
                  ? t("circulation.returnModal.loading")
                  : t("circulation.returnModal.confirm")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {scannerOpen && (
        <QrScannerModal
          title={t("scanner.title")}
          statusText={scanStatus}
          onScan={handleScan}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
};

export default CirculationPage;