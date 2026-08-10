"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";

const COLORS = [
  "oklch(0.48 0.17 357)",
  "oklch(0.42 0.09 230)",
  "oklch(0.50 0.18 25)",
  "oklch(0.55 0.12 160)",
  "oklch(0.45 0.08 280)",
  "oklch(0.55 0.04 357)",
];

export default function AnalyticsCharts({
  byCategory,
  byMonth,
  crossGroup,
}: {
  byCategory: { name: string; total: number }[];
  byMonth: { name: string; total: number }[];
  crossGroup: { name: string; net: number }[];
}) {
  const empty = byCategory.length === 0 && byMonth.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Insights"
        description="Where shared money goes — by category and over time."
      />
      {empty ? (
        <EmptyState
          title="Not enough data yet"
          description="Add a few expenses in your groups to see charts here."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="h-80">
            <h2 className="mb-3 text-sm font-semibold text-muted">
              By category
            </h2>
            <ResponsiveContainer width="100%" height="85%">
              <PieChart>
                <Pie
                  data={byCategory}
                  dataKey="total"
                  nameKey="name"
                  outerRadius={90}
                  label
                >
                  {byCategory.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
          <Card className="h-80">
            <h2 className="mb-3 text-sm font-semibold text-muted">
              Over time
            </h2>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={byMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 12 }} />
                <YAxis tick={{ fill: "var(--muted)", fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="total" fill="oklch(0.48 0.17 357)" radius={6} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-muted">
          Across groups
        </h2>
        <ul className="space-y-2 text-sm">
          {crossGroup.length === 0 && (
            <li className="text-muted">No cross-group balances yet.</li>
          )}
          {crossGroup.map((c) => (
            <li key={c.name} className="flex justify-between gap-3">
              <span className="font-medium">{c.name}</span>
              <span
                className={`money ${
                  c.net >= 0 ? "text-owed" : "text-owe"
                }`}
              >
                {c.net >= 0 ? "owes you " : "you owe "}
                {Math.abs(c.net).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
