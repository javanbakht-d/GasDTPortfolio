import { NextRequest, NextResponse } from "next/server";
import { logout, SESSION_COOKIE } from "@/lib/auth";
import { handleApiError } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (token) await logout(token);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", expires: new Date(0) });
    return res;
  } catch (e) {
    return handleApiError(e);
  }
}
