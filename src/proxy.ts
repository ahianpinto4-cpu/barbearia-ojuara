import { NextResponse, type NextRequest } from "next/server";

/**
 * Proteção otimista do painel: sem o cookie de sessão, redireciona para o login.
 * A validação completa (assinatura, expiração, usuário ativo) acontece no
 * servidor em requireAdmin().
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !req.cookies.has("ojuara_admin")) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = { matcher: ["/admin/:path*"] };
