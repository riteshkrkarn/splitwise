import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { PaginationNav } from "@/components/pagination-nav";
import { TransferList } from "@/components/transfer-list";
import { getTransfersForUser } from "@/lib/group-data";
import {
  DEFAULT_PAGE_SIZE,
  hasNextPage,
  pageOffset,
  parsePage,
} from "@/lib/pagination";

function transfersHref(sentPage: number, receivedPage: number) {
  const params = new URLSearchParams();
  if (sentPage > 1) params.set("sentPage", String(sentPage));
  if (receivedPage > 1) params.set("receivedPage", String(receivedPage));
  const qs = params.toString();
  return qs ? `/transfers?${qs}` : "/transfers";
}

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ sentPage?: string; receivedPage?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const sp = await searchParams;
  const sentPage = parsePage(sp.sentPage);
  const receivedPage = parsePage(sp.receivedPage);

  const [sent, received] = await Promise.all([
    getTransfersForUser(session.user.id, {
      direction: "sent",
      limit: DEFAULT_PAGE_SIZE,
      offset: pageOffset(sentPage, DEFAULT_PAGE_SIZE),
    }),
    getTransfersForUser(session.user.id, {
      direction: "received",
      limit: DEFAULT_PAGE_SIZE,
      offset: pageOffset(receivedPage, DEFAULT_PAGE_SIZE),
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transfers"
        description="Every payment you recorded to someone else, and payments recorded to you."
      />

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-muted">You paid</h2>
        {sent.total === 0 ? (
          <EmptyState
            title="No payments yet"
            description="When you tap Pay part on a balance you owe, it shows up here."
          />
        ) : (
          <TransferList
            transfers={sent.rows}
            empty="No payments yet."
            direction="sent"
            showGroup
          />
        )}
        <PaginationNav
          prevHref={
            sentPage > 1 ? transfersHref(sentPage - 1, receivedPage) : null
          }
          nextHref={
            hasNextPage(sentPage, DEFAULT_PAGE_SIZE, sent.total)
              ? transfersHref(sentPage + 1, receivedPage)
              : null
          }
        />
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-muted">Paid to you</h2>
        {received.total === 0 ? (
          <EmptyState
            title="Nothing received yet"
            description="When someone records a payment to you, it is listed here."
          />
        ) : (
          <TransferList
            transfers={received.rows}
            empty="Nothing received yet."
            direction="received"
            showGroup
          />
        )}
        <PaginationNav
          prevHref={
            receivedPage > 1 ? transfersHref(sentPage, receivedPage - 1) : null
          }
          nextHref={
            hasNextPage(receivedPage, DEFAULT_PAGE_SIZE, received.total)
              ? transfersHref(sentPage, receivedPage + 1)
              : null
          }
        />
      </Card>
    </div>
  );
}
