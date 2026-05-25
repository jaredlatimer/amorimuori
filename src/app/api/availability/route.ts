import { NextResponse } from "next/server";
import { getAvailability } from "@/lib/availability";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getAvailability();
  return NextResponse.json(data);
}
