import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components";
import { useI18n } from "../context/I18nContext";
import BookForm from "../components/BookForm";

const BookCreatePage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t("books.create")}</h2>
        <Button
          onClick={() => navigate("/books")}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700"
        >
          {t("common.cancel")}
        </Button>
      </div>

      <BookForm mode="create" />
    </div>
  );
};

export default BookCreatePage;