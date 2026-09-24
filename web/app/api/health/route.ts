import { NextResponse } from "next/server";
import { HEALTH_PAYLOAD } from "@/lib/legal/copy";

export async function GET() {
  return NextResponse.json(HEALTH_PAYLOAD);
}
