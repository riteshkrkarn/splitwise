import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="relative min-h-dvh overflow-hidden bg-bg">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-112 bg-[radial-gradient(ellipse_at_top,oklch(0.92_0.06_357)_0%,transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top,oklch(0.28_0.06_357)_0%,transparent_55%)]"
      />
      <div className="relative mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6 py-16">
        <p className="text-sm font-semibold tracking-wide text-primary">
          Splitwise
        </p>
        <h1 className="mt-4 max-w-xl text-balance text-3xl font-bold tracking-tight text-ink sm:text-5xl">
          Split shared costs. Trust the numbers.
        </h1>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-muted sm:text-lg">
          Keep group expenses accurate and private — for friends, flatmates, and
          whoever’s splitting the bill. No occasion required.
        </p>
        <div className="mt-8 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap">
          <Link href="/register" className="sm:inline-flex">
            <Button size="lg" className="w-full sm:w-auto">
              Create account
            </Button>
          </Link>
          <Link href="/login" className="sm:inline-flex">
            <Button size="lg" variant="secondary" className="w-full sm:w-auto">
              Log in
            </Button>
          </Link>
        </div>
        <ul className="mt-12 grid gap-4 text-sm text-muted sm:grid-cols-3">
          <li>
            <span className="block font-semibold text-ink">Accurate</span>
            Balances update from every expense and settlement.
          </li>
          <li>
            <span className="block font-semibold text-ink">Private</span>
            Just your group — invites stay in-app.
          </li>
          <li>
            <span className="block font-semibold text-ink">Clear</span>
            See who owes whom in one glance.
          </li>
        </ul>
      </div>
    </div>
  );
}
