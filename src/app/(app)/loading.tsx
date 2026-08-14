export default function AppLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-48 rounded-lg bg-surface" />
      <div className="h-4 w-72 rounded bg-surface" />
      <div className="space-y-3">
        <div className="h-16 rounded-2xl border border-border bg-surface" />
        <div className="h-16 rounded-2xl border border-border bg-surface" />
        <div className="h-16 rounded-2xl border border-border bg-surface" />
      </div>
    </div>
  );
}
