import { NextResponse } from "next/server";
import { getGroupExportData } from "@/actions/advanced";

function csvCell(value: string) {
  let v = value.replace(/"/g, '""');
  if (/^[=+\-@]/.test(v)) v = `'${v}`;
  return `"${v}"`;
}

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
    const payload = {
      ...data,
      members: data.members.map((m) =>
        data.isOwner
          ? m
          : { id: m.id, userId: m.userId, name: m.name, avatarId: m.avatarId, role: m.role, joinedAt: m.joinedAt }
      ),
    };
    return NextResponse.json(payload, {
      headers: {
        "Content-Disposition": `attachment; filename="group-${id}.json"`,
      },
    });
  }

  const lines = [
    "type,description,amount,currency,date,from,to,note",
    ...data.expenses.map(
      (e) =>
        `expense,${csvCell(e.description)},${e.amount},${e.currency},${new Date(e.date).toISOString()},,,,`
    ),
    ...data.settlements.map(
      (s) =>
        `settlement,${csvCell("transfer")},${s.amount},${s.currency},${new Date(s.date).toISOString()},${csvCell(nameById[s.fromUserId] ?? s.fromUserId)},${csvCell(nameById[s.toUserId] ?? s.toUserId)},${csvCell(s.note ?? "")}`
    ),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="group-${id}.csv"`,
    },
  });
}
