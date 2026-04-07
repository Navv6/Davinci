import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Stripe checkout is disabled. Use the manual supporter request flow instead.",
    },
    { status: 410 },
  );
}
