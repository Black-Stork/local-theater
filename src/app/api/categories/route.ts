import { NextResponse } from "next/server";
import { createCategory, listCategories } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(listCategories());
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string };
    const row = createCategory(body.name ?? "");
    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create category";
    const status = message.includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
