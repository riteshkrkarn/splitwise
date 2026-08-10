import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_at_top,oklch(0.92_0.06_357)_0%,transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top,oklch(0.28_0.06_357)_0%,transparent_55%)]"
      />
      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
        <p className="text-sm font-semibold tracking-wide text-primary">
          Splitwise
        </p>
        <h1 className="mt-4 max-w-xl text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          Split shared costs. Trust the numbers.
        </h1>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-muted sm:text-lg">
          Keep group expenses accurate and private — for friends, flatmates, and
          whoever’s splitting the bill. No occasion required.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/register">
            <Button size="lg">Create account</Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="secondary">
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
