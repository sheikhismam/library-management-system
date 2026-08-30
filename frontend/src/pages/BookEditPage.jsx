import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/api";
import { Button } from "../components";
import { useI18n } from "../context/I18nContext";
import BookForm from "../components/BookForm";

const BookEditPage = () => {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get(`/api/v1/books/${id}/`)
      .then(({ data }) => setBook(data))
      .catch((err) => {
        setError(
          err?.response?.status === 404
            ? t("bookDetail.notFound")
            : t("bookDetail.loadError")
        );
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const back = () => navigate(`/books/${id}`);

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{t("bookDetail.edit")}</h2>
        <p className="text-gray-500">{t("bookDetail.loading")}</p>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{t("bookDetail.edit")}</h2>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mb-4">
          <span className="font-medium">{error}</span>
        </div>
        <Button
          onClick={() => navigate("/books")}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {t("bookDetail.back")}
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {t("bookDetail.edit")} <span className="text-gray-500 font-medium">#{book.id}</span>
        </h2>
        <Button
          onClick={back}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700"
        >
          {t("common.cancel")}
        </Button>
      </div>

      <BookForm initial={book} mode="edit" />
    </div>
  );
};

export default BookEditPage;