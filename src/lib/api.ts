/**
 * API route helpers: consistent validation, error shapes, and JSON responses.
 * Every mutation route follows the same pattern — guard role, parse+validate
 * body, act inside a transaction, write an audit entry, return the entity.
 */
import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { jsonSafe } from "./utils";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(jsonSafe(data), { status });
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(e: unknown) {
  const message = e instanceof Error ? e.message : "Internal server error";
  console.error("[api] error:", e);
  return NextResponse.json({ error: message }, { status: 500 });
}

/**
 * Parse + validate a JSON body. Returns either { data } or { response } (a 400
 * with field errors) so callers can `if ("response" in r) return r.response`.
 */
export async function readJson<T>(
  req: Request,
  schema: ZodSchema<T>
): Promise<{ data: T } | { response: NextResponse }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { response: badRequest("Invalid JSON body") };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const err = result.error as ZodError;
    return {
      response: badRequest("Validation failed", err.flatten().fieldErrors),
    };
  }
  return { data: result.data };
}
