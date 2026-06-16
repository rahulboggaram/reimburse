import { NextResponse } from "next/server";
import { getGoldPriceSnapshot } from "@/lib/gold-price";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getGoldPriceSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("gold-price", error);
    return NextResponse.json(
      { error: "Unable to fetch live gold rates right now." },
      { status: 503 },
    );
  }
}
