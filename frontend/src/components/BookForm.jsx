import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/api";
import { Input, Button } from "../components";
import { useI18n } from "../context/I18nContext";

const labelClass = "block text-sm font-medium text-gray-700 mb-1";
const fieldClass =
  "w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2 px-3 bg-white";
const hintClass = "block text-xs text-gray-500 mt-1";

const BookForm = ({ initial, mode = "create" }) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const isEdit = mode === "edit";

  const [form, setForm] = useState({
    title: initial?.title || "",
    subtitle: initial?.subtitle || "",
    isbn: initial?.isbn || "",
    publisher: initial?.publisher || "",
    publication_date: initial?.publication_date || "",
    publication_year: initial?.publication_year || "",
    edition: initial?.edition || "",
    pages: initial?.pages || "",
    language: initial?.language || "English",
    price: initial?.price != null ? String(initial.price) : "",
    description: initial?.description || "",
    total_copies: initial?.total_copies != null ? String(initial.total_copies) : "1",
    available_copies:
      initial?.available_copies != null ? String(initial.available_copies) : "1",
    shelf_location: initial?.shelf_location || "",
    is_active: initial ? Boolean(initial.is_active) : true,
  });

  const [authors, setAuthors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [publishers, setPublishers] = useState([]);

  const [selectedAuthors, setSelectedAuthors] = useState(
    (initial?.authors || []).map((a) => ({ id: a.id, name: a.name }))
  );
  const [authorInput, setAuthorInput] = useState("");

  const [genreInput, setGenreInput] = useState("");
  const [subgenreInput, setSubgenreInput] = useState("");

  // Cover image handling (upload vs URL; uploaded image preferred for display)
  const [coverFile, setCoverFile] = useState(null);
  const [coverUrl, setCoverUrl] = useState(initial?.cover_image_url || "");
  const [removeCover, setRemoveCover] = useState(false);
  const [coverPreview, setCoverPreview] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState(null);

  useEffect(() => {
    api
      .get("/api/v1/authors/")
      .then(({ data }) => setAuthors(data.results || data))
      .catch((err) => console.error("Failed to load authors:", err));
    api
      .get("/api/v1/categories/")
      .then(({ data }) => setCategories(data.results || data))
      .catch((err) => console.error("Failed to load genres:", err));
    api
      .get("/api/v1/books/publishers/")
      .then(({ data }) => setPublishers(data.publishers || []))
      .catch((err) => console.error("Failed to load publishers:", err));
  }, []);

  useEffect(() => {
    if (coverFile) {
      const url = URL.createObjectURL(coverFile);
      setCoverPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setCoverPreview(null);
  }, [coverFile]);

  const genres = categories.filter((c) => !c.parent);
  const subgenres = categories.filter((c) => c.parent);

  const matchedGenre = genres.find(
    (g) => g.name.toLowerCase() === genreInput.trim().toLowerCase()
  );

  const availableSubgenres = matchedGenre
    ? subgenres.filter((s) => s.parent.id === matchedGenre.id)
    : [];

  const currentCover = (() => {
    if (coverFile) return coverPreview;
    if (isEdit && !removeCover && initial?.cover_image) return initial.cover_image;
    if (coverUrl) return coverUrl;
    return null;
  })();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({
      ...f,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const addAuthor = () => {
    const name = authorInput.trim();
    if (!name) return;
    const existing = selectedAuthors.find(
      (a) => a.name.toLowerCase() === name.toLowerCase()
    );
    if (!existing) {
      const match = authors.find(
        (a) => a.name.toLowerCase() === name.toLowerCase()
      );
      setSelectedAuthors((prev) => [
        ...prev,
        { id: match ? match.id : null, name },
      ]);
    }
    setAuthorInput("");
  };

  const removeAuthor = (index) => {
    setSelectedAuthors((prev) => prev.filter((_, i) => i !== index));
  };

  const errorText = (field) =>
    errors && Array.isArray(errors[field]) ? errors[field].join(", ") : errors?.[field];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors(null);

    const genreName = genreInput.trim();
    const subgenreName = subgenreInput.trim();

    const category_ids = [];
    if (genreName) {
      const genre = genres.find(
        (g) => g.name.toLowerCase() === genreName.toLowerCase()
      );
      category_ids.push(genre ? genre.id : { name: genreName });
    }
    if (subgenreName) {
      const sub = availableSubgenres.find(
        (s) => s.name.toLowerCase() === subgenreName.toLowerCase()
      );
      if (sub) {
        category_ids.push(sub.id);
      } else {
        const parentRef = matchedGenre
          ? matchedGenre.id
          : { name: genreName };
        category_ids.push({ name: subgenreName, parent: parentRef });
      }
    }

    if (!category_ids.length) {
      setErrors({ category_ids: t("bookForm.genreRequired") });
      setSubmitting(false);
      return;
    }

    const payload = {
      ...form,
      author_ids: selectedAuthors.map((a) => (a.id != null ? a.id : a.name)),
      category_ids,
      cover_image_url: coverUrl.trim(),
    };

    for (const key of ["publication_date", "publication_year", "pages"]) {
      if (payload[key] === "") payload[key] = null;
    }
    for (const key of ["price", "total_copies", "available_copies"]) {
      if (payload[key] === "") delete payload[key];
    }

    try {
      let bookId = initial?.id;
      if (isEdit && initial?.id) {
        const { data } = await api.put(`/api/v1/books/${initial.id}/`, payload);
        bookId = data.id;
      } else {
        const { data } = await api.post("/api/v1/books/", payload);
        bookId = data.id;
      }

      if (coverFile) {
        const fData = new FormData();
        fData.append("cover_image", coverFile);
        await api.post(`/api/v1/books/${bookId}/cover/`, fData);
      } else if (isEdit && removeCover) {
        await api.delete(`/api/v1/books/${bookId}/cover/`);
      }

      navigate(`/books/${bookId}`, {
        state: { saved: true, created: isEdit ? false : true },
      });
    } catch (err) {
      setErrors(err?.response?.data || t("bookForm.saveError"));
      console.error(err);
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg border border-gray-200 shadow-sm p-6"
    >
      {errors?._error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mb-4">
          <span className="font-medium">{errors._error}</span>
        </div>
      )}
      {typeof errors === "string" && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mb-4">
          <span className="font-medium">{errors}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="title" className={labelClass}>
            {t("bookForm.title")}
          </label>
          <Input
            id="title"
            name="title"
            value={form.title}
            onChange={handleChange}
            required
            className="w-full flex-1"
          />
          {errorText("title") && (
            <p className="text-xs text-red-600 mt-1">{errorText("title")}</p>
          )}
        </div>

        <div>
          <label htmlFor="isbn" className={labelClass}>
            {t("bookForm.isbn")}
          </label>
          <Input
            id="isbn"
            name="isbn"
            value={form.isbn}
            onChange={handleChange}
            required
            placeholder={t("bookForm.isbnPlaceholder")}
            className="w-full flex-1"
          />
          {errorText("isbn") && (
            <p className="text-xs text-red-600 mt-1">{errorText("isbn")}</p>
          )}
        </div>

        <div>
          <label htmlFor="subtitle" className={labelClass}>
            {t("bookForm.subtitle")}
          </label>
          <Input
            id="subtitle"
            name="subtitle"
            value={form.subtitle}
            onChange={handleChange}
            className="w-full flex-1"
          />
        </div>

        <div>
          <label htmlFor="publisher" className={labelClass}>
            {t("bookForm.publisher")}
          </label>
          <Input
            id="publisher"
            name="publisher"
            list="publishers-list"
            value={form.publisher}
            onChange={handleChange}
            placeholder={t("bookForm.publisherPlaceholder")}
            className="w-full flex-1"
          />
          <datalist id="publishers-list">
            {publishers.map((p) => (
              <option key={p.toLowerCase()} value={p} />
            ))}
          </datalist>
          <span className={hintClass}>
            {t("bookForm.publisherHint")}
          </span>
        </div>

        <div className="md:col-span-2">
          <label className={labelClass}>{t("bookForm.authors")}</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <Input
                list="authors-list"
                value={authorInput}
                onChange={(e) => setAuthorInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addAuthor();
                  }
                }}
                placeholder={t("bookForm.authorsPlaceholder")}
                className="w-full flex-1"
              />
              <datalist id="authors-list">
                {authors.map((a) => (
                  <option key={a.id} value={a.name} />
                ))}
              </datalist>
            </div>
            <Button
              type="button"
              onClick={addAuthor}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {t("bookForm.add")}
            </Button>
          </div>
          <span className={hintClass}>
            {t("bookForm.authorsHint")}
          </span>
          {selectedAuthors.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedAuthors.map((a, i) => (
                <span
                  key={`${a.id ?? a.name}-${i}`}
                  className="inline-flex items-center gap-1 bg-gray-100 border border-gray-200 rounded-full px-3 py-1 text-sm text-gray-800"
                >
                  {a.name}
                  <button
                    type="button"
                    onClick={() => removeAuthor(i)}
                    className="text-gray-400 hover:text-red-600"
                    aria-label={t("bookForm.removeAuthor", { name: a.name })}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {errorText("author_ids") && (
            <p className="text-xs text-red-600 mt-1">{errorText("author_ids")}</p>
          )}
        </div>

        <div>
          <label htmlFor="genre" className={labelClass}>
            {t("bookForm.genre")}
          </label>
          <Input
            id="genre"
            name="genre"
            list="genres-list"
            value={genreInput}
            onChange={(e) => {
              setGenreInput(e.target.value);
              setSubgenreInput("");
            }}
            placeholder={t("bookForm.genrePlaceholder")}
            className="w-full flex-1"
          />
          <datalist id="genres-list">
            {genres.map((g) => (
              <option key={g.id} value={g.name} />
            ))}
          </datalist>
          {errorText("category_ids") && (
            <p className="text-xs text-red-600 mt-1">{errorText("category_ids")}</p>
          )}
        </div>

        <div>
          <label htmlFor="subgenre" className={labelClass}>
            {t("bookForm.subgenre", { optional: t("common.optional") })}
          </label>
          <Input
            id="subgenre"
            name="subgenre"
            list="subgenres-list"
            value={subgenreInput}
            onChange={(e) => setSubgenreInput(e.target.value)}
            placeholder={
              matchedGenre
                ? t("bookForm.subgenrePlaceholderPick")
                : t("bookForm.subgenrePlaceholderFirst")
            }
            disabled={!matchedGenre}
            className="w-full flex-1 disabled:bg-gray-100 disabled:text-gray-400"
          />
          <datalist id="subgenres-list">
            {availableSubgenres.map((s) => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>
          <span className={hintClass}>
            {t("bookForm.subgenreHint")}
          </span>
        </div>

        <div>
          <label htmlFor="publication_year" className={labelClass}>
            {t("bookForm.pubYear")}
          </label>
          <Input
            id="publication_year"
            name="publication_year"
            type="number"
            value={form.publication_year}
            onChange={handleChange}
            className="w-full flex-1"
          />
        </div>

        <div>
          <label htmlFor="publication_date" className={labelClass}>
            {t("bookForm.pubDate")}
          </label>
          <Input
            id="publication_date"
            name="publication_date"
            type="date"
            value={form.publication_date}
            onChange={handleChange}
            className="w-full flex-1"
          />
        </div>

        <div>
          <label htmlFor="edition" className={labelClass}>
            {t("bookForm.edition")}
          </label>
          <Input
            id="edition"
            name="edition"
            value={form.edition}
            onChange={handleChange}
            className="w-full flex-1"
          />
        </div>

        <div>
          <label htmlFor="pages" className={labelClass}>
            {t("bookForm.pages")}
          </label>
          <Input
            id="pages"
            name="pages"
            type="number"
            value={form.pages}
            onChange={handleChange}
            className="w-full flex-1"
          />
        </div>

        <div>
          <label htmlFor="language" className={labelClass}>
            {t("bookForm.language")}
          </label>
          <Input
            id="language"
            name="language"
            value={form.language}
            onChange={handleChange}
            className="w-full flex-1"
          />
        </div>

        <div>
          <label htmlFor="price" className={labelClass}>
            {t("bookForm.price")}
          </label>
          <Input
            id="price"
            name="price"
            type="number"
            step="0.01"
            min="0"
            value={form.price}
            onChange={handleChange}
            className="w-full flex-1"
          />
        </div>

        <div>
          <label htmlFor="total_copies" className={labelClass}>
            {t("bookForm.totalCopies")}
          </label>
          <Input
            id="total_copies"
            name="total_copies"
            type="number"
            min="1"
            value={form.total_copies}
            onChange={handleChange}
            className="w-full flex-1"
          />
        </div>

        <div>
          <label htmlFor="available_copies" className={labelClass}>
            {t("bookForm.availableCopies")}
          </label>
          <Input
            id="available_copies"
            name="available_copies"
            type="number"
            min="0"
            value={form.available_copies}
            onChange={handleChange}
            className="w-full flex-1"
          />
          {errorText("available_copies") && (
            <p className="text-xs text-red-600 mt-1">{errorText("available_copies")}</p>
          )}
        </div>

        <div>
          <label htmlFor="shelf_location" className={labelClass}>
            {t("bookForm.shelf")}
          </label>
          <Input
            id="shelf_location"
            name="shelf_location"
            value={form.shelf_location}
            onChange={handleChange}
            className="w-full flex-1"
          />
        </div>

        <label className="inline-flex items-center mt-6 text-sm text-gray-700">
          <input
            type="checkbox"
            name="is_active"
            checked={form.is_active}
            onChange={handleChange}
            className="mr-2 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          {t("bookForm.active")}
        </label>

        <div className="md:col-span-2">
          <label className={labelClass}>{t("bookForm.description")}</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={4}
            className={fieldClass}
          />
        </div>

        {/* Cover image */}
        <div className="md:col-span-2">
          <label className={labelClass}>{t("bookForm.cover")}</label>
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="w-28 h-36 rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
              {currentCover ? (
                <img
                  src={currentCover}
                  alt="Book cover"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-gray-400 text-sm px-2 text-center">
                  {t("bookDetail.noCover")}
                </span>
              )}
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <label
                  htmlFor="cover_file"
                  className="inline-block cursor-pointer rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {coverFile ? coverFile.name : t("bookForm.uploadCover")}
                </label>
                <input
                  id="cover_file"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setCoverFile(e.target.files[0]);
                      setRemoveCover(false);
                    }
                  }}
                  className="sr-only"
                />
              </div>
              <div>
                <Input
                  placeholder={t("bookForm.coverUrlPlaceholder")}
                  name="cover_url"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  className="w-full flex-1"
                />
              </div>
              {isEdit && initial?.cover_image && !coverFile && (
                <Button
                  type="button"
                  size="sm"
                  className="bg-red-100 hover:bg-red-200 text-red-600"
                  onClick={() => setRemoveCover((v) => !v)}
                >
                  {removeCover ? t("bookForm.keepCover") : t("bookForm.removeCover")}
                </Button>
              )}
            </div>
          </div>
          <span className={hintClass}>
            {t("bookForm.coverHint")}
          </span>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          type="submit"
          disabled={submitting}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {submitting
            ? t("common.saving")
            : isEdit
              ? t("bookForm.saveChanges")
              : t("books.create")}
        </Button>
        <Button
          type="button"
          onClick={() => navigate(isEdit ? `/books/${initial.id}` : "/books")}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700"
        >
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
};

export default BookForm;