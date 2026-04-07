import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Stripe webhook handling is disabled while the manual supporter workflow is active.",
    },
    { status: 410 },
  );
}
