import { NextRequest, NextResponse } from "next/server";
import { login, SESSION_COOKIE } from "@/lib/auth";
import { handleApiError, rateLimit, clientIp, fail } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    // محدودیت نرخ: حداکثر ۱۰ تلاش در ۵ دقیقه برای هر IP
    if (!rateLimit(`login:${ip}`, 10, 5 * 60_000)) {
      return fail(429, "تلاش‌های ناموفق بیش از حد مجاز. لطفاً چند دقیقه بعد تلاش کنید.", "RATE_LIMITED");
    }
    const body = await req.json().catch(() => ({}));
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    if (!username || !password) return fail(400, "نام کاربری و گذرواژه الزامی است.", "BAD_INPUT");

    const result = await login(username, password, ip, req.headers.get("user-agent") ?? undefined);
    if (!result) return fail(401, "نام کاربری یا گذرواژه نادرست است یا حساب غیرفعال است.", "INVALID_CREDENTIALS");

    const res = NextResponse.json({ user: result.user, expiresAt: result.expiresAt });
    res.cookies.set(SESSION_COOKIE, result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // در محیط عملیاتی با TLS فعال شود
      path: "/",
      expires: result.expiresAt,
    });
    return res;
  } catch (e) {
    return handleApiError(e);
  }
}
