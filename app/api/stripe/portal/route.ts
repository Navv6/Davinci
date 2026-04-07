import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Stripe billing portal is disabled. Manual supporter requests are now handled outside Stripe.",
    },
    { status: 410 },
  );
}
