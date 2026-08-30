import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/api";
import { Input, Button } from "../components";
import { useI18n } from "../context/I18nContext";

const labelClass = "block text-sm font-medium text-gray-700 mb-1";
const fieldClass =
  "w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2 px-3 bg-white";
// "!border-red-500" (Tailwind v4 important prefix) forces the red border to
// win over the default border-gray-300 baked into the Input component and the
// fieldClass below, so fields with errors are visibly highlighted.
const errorFieldClass = " !border-red-500! !ring-red-500";
const inputErrorClass = " !border-red-500";

const VISIBLE_FIELDS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "membership_status",
  "max_borrow_limit",
  "joined_date",
  "expiry_date",
  "address",
  "notes",
  "photo",
];

const MemberForm = ({ initial, mode = "create" }) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const isEdit = mode === "edit";

  const [form, setForm] = useState({
    first_name: initial?.first_name || "",
    last_name: initial?.last_name || "",
    email: initial?.email || "",
    phone: initial?.phone || "",
    address: initial?.address || "",
    membership_status: initial?.membership_status || "ACTIVE",
    max_borrow_limit:
      initial?.max_borrow_limit != null ? String(initial.max_borrow_limit) : "5",
    joined_date: initial?.joined_date || "",
    expiry_date: initial?.expiry_date || "",
    notes: initial?.notes || "",
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState(null);
  const [summaryError, setSummaryError] = useState(null);

  useEffect(() => {
    if (photoFile) {
      const url = URL.createObjectURL(photoFile);
      setPhotoPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPhotoPreview(null);
  }, [photoFile]);

  const currentPhoto = (() => {
    if (photoFile) return photoPreview;
    if (isEdit && !removePhoto && initial?.photo) return initial.photo;
    return null;
  })();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const errorText = (field) =>
    errors && Array.isArray(errors[field]) ? errors[field].join(", ") : errors?.[field];

  // Returns a truthy renderable message for `field` within an arbitrary errors
  // object (used with the raw response payload, not the state).
  const renderableError = (errorsObj, field) => {
    const raw = errorsObj?.[field];
    if (raw == null) return null;
    if (Array.isArray(raw)) {
      const joined = raw.filter((v) => v != null).join(", ");
      return joined || null;
    }
    if (typeof raw === "string") return raw || null;
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors(null);
    setSummaryError(null);

    const required = [
      ["first_name", t("memberForm.requiredFirstName")],
      ["last_name", t("memberForm.requiredLastName")],
      ["email", t("memberForm.requiredEmail")],
      ["phone", t("memberForm.requiredPhone")],
    ];
    const missing = required.filter(([key]) => !form[key].trim());
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map(([key, msg]) => [key, [msg]])));
      setSummaryError(t("memberForm.requiredSummary"));
      setSubmitting(false);
      return;
    }

    const payload = {
      ...form,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      max_borrow_limit: form.max_borrow_limit || "5",
    };

    for (const key of ["joined_date", "expiry_date"]) {
      if (payload[key] === "") delete payload[key];
    }

    try {
      let memberId = initial?.id;
      if (isEdit && initial?.id) {
        const { data } = await api.put(`/api/v1/members/${initial.id}/`, payload);
        memberId = data.id;
      } else {
        const { data } = await api.post("/api/v1/members/", payload);
        memberId = data.id;
      }

      if (photoFile) {
        const fData = new FormData();
        fData.append("photo", photoFile);
        // The shared axios instance defaults to Content-Type: application/json.
        // Clearing it lets axios emit a proper `multipart/form-data` body with
        // the boundary, which the backend needs to populate request.FILES. A
        // stale JSON content type caused the photo endpoint to see no FILES and
        // respond 400 "A photo file is required." even though uploads succeeded.
        await api.post(`/api/v1/members/${memberId}/photo/`, fData, {
          headers: { "Content-Type": undefined },
        });
      } else if (isEdit && removePhoto) {
        await api.delete(`/api/v1/members/${memberId}/photo/`);
      }

      // Create -> Members list; Edit -> this member's details.
      navigate(isEdit ? `/members/${memberId}` : "/members", {
        state: { saved: true, created: isEdit ? false : true },
      });
    } catch (err) {
      const data = err?.response?.data;
      if (
        data &&
        typeof data === "object" &&
        !Array.isArray(data) &&
        typeof data.detail !== "string"
      ) {
        setErrors(data);
        // Only show the generic "correct the highlighted fields" banner when
        // there is at least one field-level error that will actually be
        // rendered inline (i.e. visibly highlighted). Otherwise surface the
        // real non-field/general message so real errors are never hidden.
        const hasVisibleFieldError = VISIBLE_FIELDS.some(
          (field) => renderableError(data, field)
        );
        if (hasVisibleFieldError) {
          setSummaryError(t("memberForm.validationSummary"));
        } else {
          const general =
            (typeof data.error === "string" && data.error.trim()) ||
            (Array.isArray(data.non_field_errors) &&
              data.non_field_errors.filter(Boolean).join(", ")) ||
            (Array.isArray(data.detail) &&
              data.detail.filter(Boolean).join(", ")) ||
            null;
          setSummaryError(general || t("memberForm.saveError"));
        }
      } else {
        setErrors(data || t("memberForm.saveError"));
      }
      console.error(err);
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg border border-gray-200 shadow-sm p-6"
    >
      {summaryError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mb-4">
          <span className="font-medium">{summaryError}</span>
        </div>
      )}
      {errors?._error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mb-4">
          <span className="font-medium">{errors._error}</span>
        </div>
      )}
      {errors?.detail != null && typeof errors.detail === "string" && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mb-4">
          <span className="font-medium">{errors.detail}</span>
        </div>
      )}
      {typeof errors === "string" && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mb-4">
          <span className="font-medium">{errors}</span>
        </div>
      )}

      {/* Photo */}
      <div className="mb-6">
        <label className={labelClass}>{t("memberForm.photo")}</label>
        <div
          className={`flex flex-col sm:flex-row items-start gap-4 rounded-lg border p-3 ${
            errorText("photo")
              ? "border-red-500"
              : "border-transparent"
          }`}
        >
          <div className="w-24 h-24 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
            {currentPhoto ? (
              <img
                src={currentPhoto}
                alt="Member profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-gray-400 text-3xl">👤</span>
            )}
          </div>
          <div className="space-y-2 flex-1">
            <div>
              <label
                htmlFor="member_photo"
                className="inline-block cursor-pointer rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                {photoFile ? photoFile.name : t("memberForm.uploadPhoto")}
              </label>
              <input
                id="member_photo"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setPhotoFile(e.target.files[0]);
                    setRemovePhoto(false);
                  }
                }}
                className="sr-only"
              />
            </div>
            {isEdit && initial?.photo && !photoFile && (
              <Button
                type="button"
                size="sm"
                className="bg-red-100 hover:bg-red-200 text-red-600"
                onClick={() => setRemovePhoto((v) => !v)}
              >
                {removePhoto ? t("memberForm.keepPhoto") : t("memberForm.removePhoto")}
              </Button>
            )}
          </div>
        </div>
        {errorText("photo") && (
          <p className="text-xs text-red-600 mt-2">{errorText("photo")}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="first_name" className={labelClass}>
            {t("memberForm.firstName")}
          </label>
          <Input
            id="first_name"
            name="first_name"
            value={form.first_name}
            onChange={handleChange}
            required
            className={`w-full flex-1${errorText("first_name") ? inputErrorClass : ""}`}
          />
          {errorText("first_name") && (
            <p className="text-xs text-red-600 mt-1">{errorText("first_name")}</p>
          )}
        </div>

        <div>
          <label htmlFor="last_name" className={labelClass}>
            {t("memberForm.lastName")}
          </label>
          <Input
            id="last_name"
            name="last_name"
            value={form.last_name}
            onChange={handleChange}
            required
            className={`w-full flex-1${errorText("last_name") ? inputErrorClass : ""}`}
          />
          {errorText("last_name") && (
            <p className="text-xs text-red-600 mt-1">{errorText("last_name")}</p>
          )}
        </div>

        <div>
          <label htmlFor="email" className={labelClass}>
            {t("memberForm.email")}
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            required
            className={`w-full flex-1${errorText("email") ? inputErrorClass : ""}`}
          />
          {errorText("email") && (
            <p className="text-xs text-red-600 mt-1">{errorText("email")}</p>
          )}
        </div>

        <div>
          <label htmlFor="phone" className={labelClass}>
            {t("memberForm.phone")}
          </label>
          <Input
            id="phone"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            required
            className={`w-full flex-1${errorText("phone") ? inputErrorClass : ""}`}
          />
          {errorText("phone") && (
            <p className="text-xs text-red-600 mt-1">{errorText("phone")}</p>
          )}
        </div>

        <div>
          <label htmlFor="membership_status" className={labelClass}>
            {t("memberForm.membershipStatus")}
          </label>
          <select
            id="membership_status"
            name="membership_status"
            value={form.membership_status}
            onChange={handleChange}
            className={`${fieldClass}${errorText("membership_status") ? errorFieldClass : ""}`}
          >
            <option value="ACTIVE">{t("memberForm.statusActive")}</option>
            <option value="SUSPENDED">{t("memberForm.statusSuspended")}</option>
            <option value="INACTIVE">{t("memberForm.statusInactive")}</option>
            <option value="EXPIRED">{t("memberForm.statusExpired")}</option>
          </select>
          {errorText("membership_status") && (
            <p className="text-xs text-red-600 mt-1">
              {errorText("membership_status")}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="max_borrow_limit" className={labelClass}>
            {t("memberForm.maxBorrow")}
          </label>
          <Input
            id="max_borrow_limit"
            name="max_borrow_limit"
            type="number"
            min="0"
            value={form.max_borrow_limit}
            onChange={handleChange}
            className={`w-full flex-1${errorText("max_borrow_limit") ? inputErrorClass : ""}`}
          />
          {errorText("max_borrow_limit") && (
            <p className="text-xs text-red-600 mt-1">
              {errorText("max_borrow_limit")}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="joined_date" className={labelClass}>
            {t("memberForm.joined")}
          </label>
          <Input
            id="joined_date"
            name="joined_date"
            type="date"
            value={form.joined_date}
            onChange={handleChange}
            className={`w-full flex-1${errorText("joined_date") ? inputErrorClass : ""}`}
          />
          {errorText("joined_date") && (
            <p className="text-xs text-red-600 mt-1">{errorText("joined_date")}</p>
          )}
        </div>

        <div>
          <label htmlFor="expiry_date" className={labelClass}>
            {t("memberForm.expiry")}
          </label>
          <Input
            id="expiry_date"
            name="expiry_date"
            type="date"
            value={form.expiry_date}
            onChange={handleChange}
            className={`w-full flex-1${errorText("expiry_date") ? inputErrorClass : ""}`}
          />
          {errorText("expiry_date") && (
            <p className="text-xs text-red-600 mt-1">{errorText("expiry_date")}</p>
          )}
        </div>

        <div className="md:col-span-2">
          <label htmlFor="address" className={labelClass}>
            {t("memberForm.address")}
          </label>
          <textarea
            id="address"
            name="address"
            value={form.address}
            onChange={handleChange}
            rows={3}
            className={`${fieldClass}${errorText("address") ? errorFieldClass : ""}`}
          />
          {errorText("address") && (
            <p className="text-xs text-red-600 mt-1">{errorText("address")}</p>
          )}
        </div>

        <div className="md:col-span-2">
          <label htmlFor="notes" className={labelClass}>
            {t("memberForm.notes")}
          </label>
          <textarea
            id="notes"
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={3}
            className={`${fieldClass}${errorText("notes") ? errorFieldClass : ""}`}
          />
          {errorText("notes") && (
            <p className="text-xs text-red-600 mt-1">{errorText("notes")}</p>
          )}
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
              ? t("memberForm.saveChanges")
              : t("members.create")}
        </Button>
        <Button
          type="button"
          onClick={() => navigate(isEdit ? `/members/${initial.id}` : "/members")}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700"
        >
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
};

export default MemberForm;