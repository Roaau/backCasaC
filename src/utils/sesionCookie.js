// Sesion en cookie segura (httpOnly) cuando el front y el back comparten dominio propio
// (app.kairuma.dev y api.kairuma.dev). En ese caso el navegador guarda la sesion donde JavaScript no la puede leer.
// En los dominios viejos (vercel.app / onrender.com) se sigue usando el token en el header Authorization.
//
// Variables: COOKIE_DOMAIN=kairuma.dev (sin punto inicial). Si no esta, nunca se usa cookie.

export const NOMBRE_COOKIE = "scpos_sesion";
const OCHO_HORAS_MS = 8 * 60 * 60 * 1000;

const dominioCookie = () => String(process.env.COOKIE_DOMAIN || "").trim().replace(/^\./, "");

/** La peticion viene del front en el dominio propio (ej. https://app.kairuma.dev). */
export const usaCookie = (req) => {
  const dominio = dominioCookie();
  if (!dominio) return false;
  const origen = String(req?.headers?.origin || req?.headers?.referer || "");
  try {
    const host = new URL(origen).hostname;
    return host === dominio || host.endsWith(`.${dominio}`);
  } catch {
    return false;
  }
};

export const ponerCookieSesion = (res, token) => {
  res.cookie(NOMBRE_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    domain: dominioCookie(),
    path: "/",
    maxAge: OCHO_HORAS_MS
  });
};

export const borrarCookieSesion = (res) => {
  if (!dominioCookie()) return;
  res.clearCookie(NOMBRE_COOKIE, { httpOnly: true, secure: true, sameSite: "lax", domain: dominioCookie(), path: "/" });
};

/** Lee una cookie del header Cookie sin dependencias. */
export const leerCookie = (cabecera, nombre = NOMBRE_COOKIE) => {
  for (const parte of String(cabecera || "").split(";")) {
    const i = parte.indexOf("=");
    if (i > 0 && parte.slice(0, i).trim() === nombre) {
      try { return decodeURIComponent(parte.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
};

/** Token de la peticion: header Authorization o, si no hay, la cookie de sesion. */
export const tokenDeLaPeticion = (req) => {
  const auth = req?.headers?.authorization;
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7);
  return leerCookie(req?.headers?.cookie);
};
