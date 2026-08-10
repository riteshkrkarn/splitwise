import { NextResponse } from "next/server";
import { getGroupExportData } from "@/actions/advanced";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "csv";
  const data = await getGroupExportData(id);
  const nameById = Object.fromEntries(
    data.members.map((m) => [m.userId, m.name])
  );

  if (format === "json") {
    return NextResponse.json(data, {
      headers: {
        "Content-Disposition": `attachment; filename="group-${id}.json"`,
      },
    });
  }

  const lines = [
    "type,description,amount,currency,date,from,to,note",
    ...data.expenses.map(
      (e) =>
        `expense,"${e.description.replace(/"/g, '""')}",${e.amount},${e.currency},${new Date(e.date).toISOString()},,,,`
    ),
    ...data.settlements.map(
      (s) =>
        `settlement,"transfer",${s.amount},${s.currency},${new Date(s.date).toISOString()},"${nameById[s.fromUserId] ?? s.fromUserId}","${nameById[s.toUserId] ?? s.toUserId}","${(s.note ?? "").replace(/"/g, '""')}"`
    ),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="group-${id}.csv"`,
    },
  });
}
