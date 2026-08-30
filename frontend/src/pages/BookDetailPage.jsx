import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { api } from "../api/api";
import { Button } from "../components";
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

const BookDetailPage = () => {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const savedFlash = location.state?.saved;
  const wasCreated = Boolean(location.state?.created);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get(`/api/v1/books/${id}/`)
      .then(({ data }) => setBook(data))
      .catch((err) => {
        if (err?.response?.status === 404) {
          setError(t("bookDetail.notFound"));
        } else {
          setError(t("bookDetail.loadError"));
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
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{t("bookDetail.title")}</h2>
        <p className="text-gray-500">{t("bookDetail.loading")}</p>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{t("bookDetail.title")}</h2>
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

  const genres = book.categories.filter((c) => !c.parent);
  const subgenres = book.categories.filter((c) => c.parent);
  const cover = book.cover_image || book.cover_image_url || null;

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t("bookDetail.title")}</h2>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => navigate(`/books/${book.id}/edit`)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {t("bookDetail.edit")}
          </Button>
          <Button
            onClick={() => navigate("/books")}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            {t("bookDetail.back")}
          </Button>
        </div>
      </div>

      {savedFlash && (
        <div
          role="status"
          className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-md mb-4"
        >
          <span className="font-medium">
            {wasCreated ? t("bookDetail.created") : t("bookDetail.updated")}
          </span>
        </div>
      )}

      {/* Header with cover */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="w-36 h-48 rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0 self-start">
            {cover ? (
              <img
                src={cover}
                alt={`Cover of ${book.title}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-gray-400 text-sm px-2 text-center">
                {t("bookDetail.noCover")}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-gray-900 break-words">
                  {book.title}
                </h3>
                {book.subtitle && (
                  <p className="text-sm text-gray-500 mt-1 break-words">
                    {book.subtitle}
                  </p>
                )}
                {book.authors.length > 0 && (
                  <p className="text-sm text-gray-600 mt-2">
                    {t("bookDetail.byAuthors", {
                      names: book.authors.map((a) => a.name).join(", "),
                    })}
                  </p>
                )}
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  book.is_available
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {book.is_available ? t("bookDetail.available") : t("bookDetail.unavailable")}
              </span>
            </div>

            <dl className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <InfoItem label={t("books.bookId")}>{book.id}</InfoItem>
              <InfoItem label={t("books.isbn")}>{book.isbn}</InfoItem>
              <InfoItem label={t("bookDetail.publisher")}>{book.publisher}</InfoItem>
              <InfoItem label={t("bookDetail.pubYear")}>{book.publication_year}</InfoItem>
              <InfoItem label={t("bookDetail.pubDate")}>
                {formatDate(book.publication_date)}
              </InfoItem>
              <InfoItem label={t("bookDetail.edition")}>{book.edition}</InfoItem>
              <InfoItem label={t("bookDetail.pages")}>{book.pages}</InfoItem>
              <InfoItem label={t("bookDetail.language")}>{book.language}</InfoItem>
              <InfoItem label={t("bookDetail.price")}>{formatMoney(book.price)}</InfoItem>
              <InfoItem label={t("bookDetail.totalCopies")}>{book.total_copies}</InfoItem>
              <InfoItem label={t("bookDetail.availableCopies")}>{book.available_copies}</InfoItem>
              <InfoItem label={t("bookDetail.shelf")}>{book.shelf_location}</InfoItem>
              <InfoItem label={t("bookDetail.genre")}>
                {genres.map((g) => g.name).join(", ")}
              </InfoItem>
              <InfoItem label={t("bookDetail.subgenre")}>
                {subgenres.map((s) => s.name).join(", ")}
              </InfoItem>
              <InfoItem label={t("bookDetail.avgRating")}>
                {book.average_rating != null
                  ? `${book.average_rating} / 5`
                  : t("bookDetail.noRatings")}
              </InfoItem>
              <InfoItem label={t("bookDetail.reviews")}>{book.reviews_count}</InfoItem>
              <InfoItem label={t("bookDetail.created")}>{formatDate(book.created_at)}</InfoItem>
            </dl>
          </div>
        </div>
      </div>

      {book.description && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
          <h4 className="text-base font-semibold text-gray-900 mb-2">{t("bookDetail.description")}</h4>
          <p className="text-sm text-gray-700 whitespace-pre-line break-words">
            {book.description}
          </p>
        </div>
      )}

      {/* Recent reviews */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
        <h4 className="text-base font-semibold text-gray-900 mb-2">
          {t("bookDetail.recentReviews")}
        </h4>
        {book.recent_reviews.length === 0 ? (
          <p className="text-sm text-gray-500">{t("bookDetail.noReviews")}</p>
        ) : (
          <ul className="space-y-3">
            {book.recent_reviews.map((r) => (
              <li
                key={r.id}
                className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">
                    {r.reviewer_name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {`${r.rating} / 5`} · {formatDate(r.created_at)}
                  </p>
                </div>
                {r.comment && (
                  <p className="text-sm text-gray-600 mt-1 break-words">{r.comment}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {book.qr_code_image && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h4 className="text-base font-semibold text-gray-900 mb-2">{t("bookDetail.qrCode")}</h4>
          <img
            src={book.qr_code_image}
            alt="Book QR Code"
            className="w-32 h-32 object-contain"
          />
          <p className="text-xs text-gray-500 mt-2">{book.qr_payload}</p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          onClick={() => navigate("/circulation")}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {t("bookDetail.manageCirculation")}
        </Button>
      </div>
    </div>
  );
};

export default BookDetailPage;