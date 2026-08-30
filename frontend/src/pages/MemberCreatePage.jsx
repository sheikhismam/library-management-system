import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components";
import { useI18n } from "../context/I18nContext";
import MemberForm from "../components/MemberForm";

const MemberCreatePage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t("members.create")}</h2>
        <Button
          onClick={() => navigate("/members")}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700"
        >
          {t("common.cancel")}
        </Button>
      </div>

      <MemberForm mode="create" />
    </div>
  );
};

export default MemberCreatePage;