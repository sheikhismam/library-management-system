import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/api";
import { Button } from "../components";
import { useI18n } from "../context/I18nContext";
import MemberForm from "../components/MemberForm";

const MemberEditPage = () => {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get(`/api/v1/members/${id}/`)
      .then(({ data }) => setMember(data))
      .catch((err) => {
        setError(
          err?.response?.status === 404
            ? t("memberDetail.notFound")
            : t("memberDetail.loadError")
        );
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const back = () => navigate(`/members/${id}`);

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{t("memberDetail.edit")}</h2>
        <p className="text-gray-500">{t("memberDetail.loading")}</p>
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{t("memberDetail.edit")}</h2>
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {t("memberDetail.edit")}{" "}
          <span className="text-gray-500 font-medium">({member.member_code})</span>
        </h2>
        <Button
          onClick={back}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700"
        >
          {t("common.cancel")}
        </Button>
      </div>

      <MemberForm initial={member} mode="edit" />
    </div>
  );
};

export default MemberEditPage;