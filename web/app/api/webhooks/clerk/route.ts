import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest } from "next/server";
import { deleteVault } from "@/lib/vault/repository";

export async function POST(req: NextRequest) {
  let event;
  try {
    event = await verifyWebhook(req);
  } catch {
    return new Response("Verification failed", { status: 400 });
  }

  if (event.type === "user.deleted") {
    const userId = event.data.id;
    if (userId) {
      try {
        await deleteVault(userId);
      } catch {
        return new Response("OK", { status: 200 });
      }
    }
  }

  return new Response("OK", { status: 200 });
}
