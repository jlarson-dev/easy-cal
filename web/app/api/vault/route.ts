import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  isVaultWriteBody,
  parseIfMatch,
  resolveVaultWrite,
  vaultWriteTooLarge,
} from "@/lib/vault/payload";
import { getVaultRow, insertVault, updateVault } from "@/lib/vault/repository";

function jsonError(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return jsonError("unauthorized", 401);
  }

  try {
    const vault = await getVaultRow(userId);
    if (!vault) {
      return jsonError("not_found", 404);
    }
    return NextResponse.json(vault);
  } catch (error) {
    if (error instanceof Error && error.message === "DATABASE_URL is not set") {
      return jsonError("unavailable", 503);
    }
    return jsonError("not_found", 500);
  }
}

export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return jsonError("unauthorized", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid", 400);
  }

  if (!isVaultWriteBody(body)) {
    return jsonError("invalid", 400);
  }

  if (vaultWriteTooLarge(body)) {
    return jsonError("too_large", 413);
  }

  const ifMatch = parseIfMatch(request.headers.get("if-match"));

  try {
    const existing = await getVaultRow(userId);
    const decision = resolveVaultWrite(existing?.revision ?? null, ifMatch);

    if (decision === "conflict") {
      return jsonError("conflict", 409);
    }
    if (decision === "precondition") {
      return jsonError("precondition", 428);
    }
    if (decision === "insert") {
      const created = await insertVault(userId, body);
      return NextResponse.json(created, { status: 201 });
    }

    const updated = await updateVault(userId, body, ifMatch as number);
    if (!updated) {
      return jsonError("conflict", 409);
    }
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "DATABASE_URL is not set") {
      return jsonError("unavailable", 503);
    }
    return jsonError("not_found", 500);
  }
}
