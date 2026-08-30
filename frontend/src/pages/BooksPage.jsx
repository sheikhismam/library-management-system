import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Input, Button, Table, TableRow, TableCell, TableHead, Modal } from "../components";
import { api, apiErrorMessage } from "../api/api";
import { useI18n } from "../context/I18nContext";

const BooksPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Fetch books from API
  useEffect(() => {
    fetchBooks();
  }, [search, categoryFilter, authorFilter, statusFilter]);

  const fetchBooks = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      if (authorFilter) params.author = authorFilter;
      if (statusFilter === "available") params.in_stock = "true";
      if (statusFilter === "unavailable") params.in_stock = "false";

      const { data } = await api.get("/api/v1/books/", { params });
      setBooks(data.results || data);
    } catch (err) {
      setError(t("books.loadError"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Delete book (opens confirmation modal)
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/api/v1/books/${deleteTarget.id}/`);
      setDeleteTarget(null);
      fetchBooks();
    } catch (err) {
      setDeleteError(apiErrorMessage(err, t("books.deleteFailed")));
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        {t("books.title")}
      </h2>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Input
          placeholder={t("books.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={loading}
          className="flex-1"
        />
        <Input
          placeholder={t("books.genre")}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          disabled={loading}
          className="flex-1"
        />
        <Input
          placeholder={t("books.author")}
          value={authorFilter}
          onChange={(e) => setAuthorFilter(e.target.value)}
          disabled={loading}
          className="flex-1"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          disabled={loading}
          className="rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2 px-3 bg-white"
        >
          <option value="all">{t("books.statusAll")}</option>
          <option value="available">{t("books.availableOnly")}</option>
          <option value="unavailable">{t("books.unavailableOnly")}</option>
        </select>
        <Button
          onClick={() => navigate("/books/create")}
          className="ml-2 bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap"
        >
          {t("books.create")}
        </Button>
        <Button
          onClick={fetchBooks}
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
      {loading && !books.length && (
        <p className="text-gray-500">{t("books.loading")}</p>
      )}

      {/* No books state */}
      {!loading && !books.length && !search && !categoryFilter && !authorFilter && statusFilter === "all" && (
        <p className="text-gray-500 text-center py-8">{t("books.empty")}</p>
      )}

      {/* Books table */}
      {loading || books.length > 0 && (
        <div className="overflow-x-auto rounded-lg">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell className="w-64">{t("books.titleCol")}</TableCell>
                <TableCell>{t("books.bookId")}</TableCell>
                <TableCell>{t("books.isbn")}</TableCell>
                <TableCell className="w-56">{t("books.authors")}</TableCell>
                <TableCell className="w-56">{t("books.genres")}</TableCell>
                <TableCell className="text-right">{t("books.copies")}</TableCell>
                <TableCell className="text-center">{t("books.actions")}</TableCell>
              </TableRow>
            </TableHead>
            {books.map((book) => (
              <TableRow key={book.id} className="border-b hover:bg-gray-50">
                <TableCell>
                  <div className="flex items-center gap-3">
                    {book.cover_image || book.cover_image_url ? (
                      <img
                        src={book.cover_image || book.cover_image_url}
                        alt=""
                        className="w-9 h-12 rounded-sm object-cover border border-gray-200"
                      />
                    ) : (
                      <span className="w-9 h-12 rounded-sm bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 text-xs">
                        📖
                      </span>
                    )}
                    <Link
                      to={`/books/${book.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {book.title}
                    </Link>
                  </div>
                </TableCell>
                <TableCell>{book.id}</TableCell>
                <TableCell>{book.isbn || "-"}</TableCell>
                <TableCell>
                  {book.authors.map((a) => a.name).join(", ") || "-"}
                </TableCell>
                <TableCell>
                  {book.categories.map((c) => c.name).join(", ") || "-"}
                </TableCell>
                <TableCell className="text-right">
                  {book.available_copies || 0}/{book.total_copies || 0}
                </TableCell>
                <TableCell className="text-center whitespace-nowrap">
                  <Button
                    size="sm"
                    className="text-sm"
                    onClick={() => navigate(`/books/${book.id}`)}
                  >
                    {t("common.details")}
                  </Button>
                  <Button
                    size="sm"
                    className="ml-1 bg-red-100 hover:bg-red-200 text-red-600"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteTarget(book);
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
              {t("books.deleteModalTitle")}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {t("books.deleteModalDescription", { title: deleteTarget.title })}
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
                {deleting ? t("books.deleteModalDeleting") : t("common.delete")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default BooksPage;