import React, { useState, useEffect, useCallback } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { api } from "../api/api";
import { Button } from "../components";
import { useI18n } from "../context/I18nContext";

const PIE_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#ef4444",
];

const ACTION_STYLES = {
  RETURNED: "bg-green-100 text-green-700",
  BORROWED: "bg-indigo-100 text-indigo-700",
  OVERDUE: "bg-red-100 text-red-700",
  LOST: "bg-amber-100 text-amber-700",
};

const DashboardPage = () => {
  const { t } = useI18n();
  const [summary, setSummary] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [popularCategories, setPopularCategories] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/v1/analytics/dashboard/");
      const data = res.data || {};
      setSummary(data.summary || null);
      const activity = data.borrowing_activity || {};
      setTimeline(Array.isArray(activity.timeline) ? activity.timeline : []);
      setPopularCategories(
        Array.isArray(data.popular_categories) ? data.popular_categories : []
      );
      setRecentActivity(Array.isArray(data.recent_activity) ? data.recent_activity : []);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      setError(t("dashboard.loadError"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const formatMoney = (value) => {
    const num = parseFloat(value);
    return isNaN(num) ? "-" : `$${num.toFixed(2)}`;
  };

  const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    return isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
  };

  const chartData = timeline.map((point) => ({
    month: point.month,
    Borrowed: point.count || 0,
  }));

  const pieData = popularCategories.map((cat) => ({
    name: cat.name || "Uncategorized",
    value: cat.borrow_count || 0,
  }));

  const totalFines = (parseFloat(summary?.fines_collected) || 0) + (parseFloat(summary?.fines_pending) || 0);
  const overduePct =
    (summary?.active_loans || 0) > 0
      ? ((summary.overdue_loans / summary.active_loans) * 100).toFixed(1)
      : "0.0";
  const collectedPct =
    totalFines > 0 ? ((parseFloat(summary.fines_collected) / totalFines) * 100).toFixed(1) : "0.0";

  const statCards = summary
    ? [
        {
          label: t("dashboard.totalBooks"),
          icon: "📚",
          value: summary.total_books,
          sub: null,
          color: "bg-indigo-50 text-indigo-600",
        },
        {
          label: t("dashboard.totalCopies"),
          icon: "🗂️",
          value: summary.total_copies,
          sub: null,
          color: "bg-violet-50 text-violet-600",
        },
        {
          label: t("dashboard.activeLoans"),
          icon: "📖",
          value: summary.active_loans,
          sub: null,
          color: "bg-blue-50 text-blue-600",
        },
        {
          label: t("dashboard.overdueLoans"),
          icon: "⚠️",
          value: summary.overdue_loans,
          sub: t("dashboard.pctOfActive", { pct: overduePct }),
          color: "bg-red-50 text-red-600",
        },
        {
          label: t("dashboard.totalMembers"),
          icon: "👥",
          value: summary.total_members,
          sub: null,
          color: "bg-green-50 text-green-600",
        },
        {
          label: t("dashboard.totalAuthors"),
          icon: "✍️",
          value: summary.total_authors ?? 0,
          sub: null,
          color: "bg-cyan-50 text-cyan-600",
        },
        {
          label: t("dashboard.totalPublishers"),
          icon: "🏢",
          value: summary.total_publishers ?? 0,
          sub: null,
          color: "bg-rose-50 text-rose-600",
        },
        {
          label: t("dashboard.totalGenres"),
          icon: "🏷️",
          value: summary.total_genres ?? 0,
          sub: null,
          color: "bg-teal-50 text-teal-600",
        },
        {
          label: t("dashboard.totalSubGenres"),
          icon: "🏷️",
          value: summary.total_sub_genres ?? 0,
          sub: null,
          color: "bg-cyan-50 text-cyan-700",
        },
        {
          label: t("dashboard.finesCollected"),
          icon: "💰",
          value: formatMoney(summary.fines_collected),
          sub: t("dashboard.pctCollected", { pct: collectedPct }),
          color: "bg-emerald-50 text-emerald-600",
        },
        {
          label: t("dashboard.finesPending"),
          icon: "⏳",
          value: formatMoney(summary.fines_pending),
          sub: totalFines > 0 ? t("dashboard.awaitingPayment") : null,
          color: "bg-amber-50 text-amber-600",
        },
      ]
    : [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {t("dashboard.title")}
        </h2>
        <Button
          onClick={fetchDashboard}
          disabled={loading}
          className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        >
          {t("common.refresh")}
        </Button>
      </div>

      {error && (
        <div className="bg-red-100 border-red-400 text-red-700 px-4 py-3 rounded-md mb-4">
          <span className="font-medium">{error}</span>
        </div>
      )}

      {loading && !summary ? (
        <p className="text-gray-500">{t("dashboard.loading")}</p>
      ) : !summary ? (
        <p className="text-gray-500">{t("dashboard.noData")}</p>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {statCards.map((card) => (
              <div
                key={card.label}
                className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex items-start gap-4"
              >
                <div
                  className={`w-11 h-11 rounded-lg flex items-center justify-center text-xl ${card.color}`}
                >
                  {card.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {card.label}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 leading-tight">
                    {card.value ?? 0}
                  </p>
                  {card.sub && (
                    <p className="text-xs text-gray-500 mt-1">{card.sub}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                {t("dashboard.borrowingTrends")}
              </h3>
              {chartData.length ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="Borrowed"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">{t("dashboard.noBorrowData")}</p>
              )}
            </div>

            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                {t("dashboard.genreDistribution")}
              </h3>
              {pieData.length ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={(entry) => entry.name}
                      >
                        {pieData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">{t("dashboard.noGenreData")}</p>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              {t("dashboard.recentActivity")}
            </h3>
            {recentActivity.length === 0 ? (
              <p className="text-gray-500 text-sm">{t("dashboard.noRecent")}</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {recentActivity.map((item) => {
                  const badgeClass =
                    ACTION_STYLES[item.action] || "bg-gray-100 text-gray-700";
                  return (
                    <li key={item.id} className="py-3 flex items-start gap-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}
                      >
                        {item.action}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.book_title}
                          <span className="text-gray-500 font-normal">
                            {" "}
                            • {item.member_name || t("dashboard.unknownMember")}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500">
                          {t("dashboard.borrowed")} {formatDate(item.borrow_date)} → {t("dashboard.due")}{" "}
                          {formatDate(item.due_date)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardPage;