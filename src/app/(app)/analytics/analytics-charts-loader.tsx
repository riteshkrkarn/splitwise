"use client";

import dynamic from "next/dynamic";

const AnalyticsCharts = dynamic(() => import("./analytics-charts"), {
  ssr: false,
  loading: () => (
    <div className="h-80 animate-pulse rounded-2xl border border-border bg-surface" />
  ),
});

export default function AnalyticsChartsLoader(props: {
  byCategory: { name: string; total: number }[];
  byMonth: { name: string; total: number }[];
  crossGroup: {
    name: string;
    net: number;
    currency: string;
    label: string;
  }[];
  currency: string;
}) {
  return <AnalyticsCharts {...props} />;
}
