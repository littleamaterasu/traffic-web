import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  void request;
  throw new Error("Chưa triển khai.");
}
