import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { api } from "../api/api";
import { Button, Table, TableRow, TableCell, TableHead } from "../components";
import { useI18n } from "../context/I18nContext";

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString() : "-";

const formatMoney = (value) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(value || 0)
  );

const InfoItem = ({ label, children }) => (
  <div>
    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
      {label}
    </dt>
    <dd className="mt-1 text-sm text-gray-900">{children || "-"}</dd>
  </div>
);

const statusBadgeClass = (status) => {
  switch (status) {
    case "ACTIVE":
      return "bg-green-100 text-green-700";
    case "SUSPENDED":
      return "bg-yellow-100 text-yellow-700";
    case "INACTIVE":
      return "bg-gray-100 text-gray-600";
    case "EXPIRED":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
};

const MemberDetailPage = () => {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const savedFlash = location.state?.saved;
  const wasCreated = Boolean(location.state?.created);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get(`/api/v1/members/${id}/`)
      .then(({ data }) => setMember(data))
      .catch((err) => {
        if (err?.response?.status === 404) {
          setError(t("memberDetail.notFound"));
        } else {
          setError(t("memberDetail.loadError"));
        }
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Consume the flash message after first render so a refresh doesn't repeat it.
  useEffect(() => {
    if (savedFlash) {
      window.history.replaceState({}, document.title);
    }
  }, [savedFlash]);

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{t("memberDetail.title")}</h2>
        <p className="text-gray-500">{t("memberDetail.loading")}</p>
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{t("memberDetail.title")}</h2>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mb-4">
          <span className="font-medium">{error}</span>
        </div>
        <Button
          onClick={() => navigate("/members")}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {t("memberDetail.back")}
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t("memberDetail.title")}</h2>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => navigate(`/members/${member.id}/edit`)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {t("memberDetail.edit")}
          </Button>
          <Button
            onClick={() => navigate("/members")}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            {t("memberDetail.back")}
          </Button>
        </div>
      </div>

      {savedFlash && (
        <div
          role="status"
          className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-md mb-4"
        >
          <span className="font-medium">
            {wasCreated
              ? t("memberDetail.created")
              : t("memberDetail.updated")}
          </span>
        </div>
      )}

      {/* Profile header */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="w-28 h-28 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
            {member.photo ? (
              <img
                src={member.photo}
                alt={`${member.full_name} profile`}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-gray-400 text-4xl">👤</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-gray-900 break-words">
                  {member.full_name}
                </h3>
                <p className="text-sm text-gray-500 mt-1 break-words">{member.email}</p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadgeClass(
                  member.membership_status
                )}`}
              >
                {member.membership_status}
              </span>
            </div>

            <dl className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <InfoItem label={t("memberDetail.memberId")}>{member.member_code}</InfoItem>
              <InfoItem label={t("memberDetail.systemId")}>{member.id}</InfoItem>
              <InfoItem label={t("memberDetail.phone")}>{member.phone}</InfoItem>
              <InfoItem label={t("memberDetail.address")}>{member.address}</InfoItem>
              <InfoItem label={t("memberDetail.maxBorrow")}>{member.max_borrow_limit}</InfoItem>
              <InfoItem label={t("memberDetail.activeLoans")}>{member.active_loans_count}</InfoItem>
              <InfoItem label={t("memberDetail.canBorrow")}>
                {member.can_borrow ? t("common.yes") : t("common.no")}
              </InfoItem>
              <InfoItem label={t("memberDetail.unpaidFines")}>
                {formatMoney(member.unpaid_fines_total)}
              </InfoItem>
              <InfoItem label={t("memberDetail.joined")}>{formatDate(member.joined_date)}</InfoItem>
              <InfoItem label={t("memberDetail.expiry")}>{formatDate(member.expiry_date)}</InfoItem>
              <InfoItem label={t("memberDetail.created")}>{formatDate(member.created_at)}</InfoItem>
            </dl>

            {member.notes && (
              <div className="mt-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {t("memberDetail.notes")}
                </p>
                <p className="mt-1 text-sm text-gray-700 whitespace-pre-line break-words">
                  {member.notes}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active loans */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
        <h4 className="text-base font-semibold text-gray-900 mb-2">
          {t("memberDetail.activeLoans")}
        </h4>
        {member.active_loans.length === 0 ? (
          <p className="text-sm text-gray-500">{t("memberDetail.noActiveLoans")}</p>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t("memberDetail.book")}</TableCell>
                <TableCell>{t("memberDetail.borrowed")}</TableCell>
                <TableCell>{t("memberDetail.due")}</TableCell>
                <TableCell className="text-center">{t("circulation.status")}</TableCell>
                <TableCell className="text-right">{t("memberDetail.renewals")}</TableCell>
              </TableRow>
            </TableHead>
            {member.active_loans.map((loan) => (
              <TableRow key={loan.id} className="border-b hover:bg-gray-50">
                <TableCell>
                  <span className="text-blue-600">
                    {loan.book_title}
                  </span>
                  <span className="text-xs text-gray-400 ml-1">
                    ({loan.book_isbn})
                  </span>
                </TableCell>
                <TableCell>{formatDate(loan.borrow_date)}</TableCell>
                <TableCell>{formatDate(loan.due_date)}</TableCell>
                <TableCell className="text-center">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      loan.status === "OVERDUE"
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {loan.status}
                  </span>
                </TableCell>
                <TableCell className="text-right text-gray-600">
                  {loan.renewal_count}
                </TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </div>

      {member.qr_code_image && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h4 className="text-base font-semibold text-gray-900 mb-2">{t("memberDetail.qrCode")}</h4>
          <img
            src={member.qr_code_image}
            alt="Member QR Code"
            className="w-32 h-32 object-contain"
          />
          <p className="text-xs text-gray-500 mt-2">{member.qr_payload}</p>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <Button
          onClick={() => navigate("/circulation")}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {t("memberDetail.manageCirculation")}
        </Button>
      </div>
    </div>
  );
};

export default MemberDetailPage;