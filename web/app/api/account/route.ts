import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { deleteVault } from "@/lib/vault/repository";

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await deleteVault(userId);
  } catch (error) {
    if (error instanceof Error && error.message === "DATABASE_URL is not set") {
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }
    return NextResponse.json({ error: "not_found" }, { status: 500 });
  }

  const client = await clerkClient();
  await client.users.deleteUser(userId);
  return NextResponse.json({ ok: true });
}
