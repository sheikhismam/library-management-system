import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Input, Button, Table, TableRow, TableCell, TableHead, Modal } from "../components";
import { api, apiErrorMessage } from "../api/api";
import { useI18n } from "../context/I18nContext";

const MembersPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Fetch members
  useEffect(() => {
    fetchMembers();
  }, [search, statusFilter]);

  const fetchMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter !== "all") params.status = statusFilter;

      const { data } = await api.get("/api/v1/members/", { params });
      setMembers(data.results || data);
    } catch (err) {
      setError(t("members.loadError"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Delete member (opens confirmation modal)
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/api/v1/members/${deleteTarget.id}/`);
      setDeleteTarget(null);
      fetchMembers();
    } catch (err) {
      setDeleteError(apiErrorMessage(err, t("members.deleteFailed")));
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  // Toggle member status
  const handleToggleStatus = async (id) => {
    try {
      const status = members.find((m) => m.id === id)?.membership_status;
      await api.patch(`/api/v1/members/${id}/`, {
        membership_status: status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
      });
      fetchMembers();
    } catch (err) {
      alert(t("members.statusFailed"));
      console.error(err);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        {t("members.title")}
      </h2>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Input
          placeholder={t("members.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={loading}
          className="flex-1"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          disabled={loading}
          className="rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2 px-3 bg-white"
        >
          <option value="all">{t("members.statusAll")}</option>
          <option value="ACTIVE">{t("members.active")}</option>
          <option value="SUSPENDED">{t("members.suspended")}</option>
          <option value="INACTIVE">{t("members.inactive")}</option>
        </select>
        <Button
          onClick={() => navigate("/members/create")}
          className="ml-2 bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap"
        >
          {t("members.create")}
        </Button>
        <Button
          onClick={fetchMembers}
          disabled={loading}
          className="ml-2 bg-gray-100 hover:bg-gray-200 text-gray-700"
        >
          {t("common.refresh")}
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-100 border-red-400 text-red-700 px-4 py-3 rounded-md mb-4">
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && !members.length && (
        <p className="text-gray-500">{t("members.loading")}</p>
      )}

      {/* No members state */}
      {!loading && !members.length && !search && statusFilter === "all" && (
        <p className="text-gray-500 text-center py-8">{t("members.empty")}</p>
      )}

      {/* Members table */}
      {loading || members.length > 0 && (
        <div className="overflow-x-auto rounded-lg">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t("members.name")}</TableCell>
                <TableCell>{t("members.memberId")}</TableCell>
                <TableCell>{t("members.email")}</TableCell>
                <TableCell className="text-center">{t("members.status")}</TableCell>
                <TableCell className="text-center">{t("books.actions")}</TableCell>
              </TableRow>
            </TableHead>
          {members.map((member) => (
            <TableRow key={member.id} className="border-b hover:bg-gray-50">
              <TableCell>
                <Link
                  to={`/members/${member.id}`}
                  className="text-blue-600 hover:underline"
                >
                  {member.full_name}
                </Link>
              </TableCell>
              <TableCell>{member.member_code}</TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell className="text-center">
                  <span
                    className={
                      member.membership_status === "ACTIVE"
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  >
                    {member.membership_status}
                  </span>
                </TableCell>
                <TableCell className="text-center whitespace-nowrap">
                <Button
                  size="sm"
                  className="text-sm text-gray-600 hover:text-gray-800"
                  onClick={() => navigate(`/members/${member.id}`)}
                >
                  {t("common.details")}
                </Button>
                <Button
                  size="sm"
                  className="ml-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-700"
                  onClick={() => handleToggleStatus(member.id)}
                >
                  {member.membership_status === "ACTIVE" ? t("members.suspend") : t("members.activate")}
                </Button>
                <Button
                  size="sm"
                  className="ml-1 bg-red-100 hover:bg-red-200 text-red-600"
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteTarget(member);
                  }}
                >
                  {t("common.delete")}
                </Button>
              </TableCell>
</TableRow>
            ))}
          </Table>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <Modal onClose={() => !deleting && setDeleteTarget(null)} maxWidth="max-w-sm">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t("members.deleteModalTitle")}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {t("members.deleteModalDescription", { name: deleteTarget.full_name })}
            </p>
            {deleteError && (
              <p className="text-sm text-red-700 mb-4 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {deleteError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={confirmDelete}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleting ? t("members.deleteModalDeleting") : t("common.delete")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default MembersPage;