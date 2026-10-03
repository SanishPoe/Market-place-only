package au.sutto.marketonly;

import java.net.URI;
import java.net.URLDecoder;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Validates untrusted Android VIEW and SEND input; never launches a supplied intent. */
public final class ExternalLinks {
    private ExternalLinks() {}
    private static boolean directHost(String host) {
        return "facebook.com".equals(host) || "www.facebook.com".equals(host)
            || "m.facebook.com".equals(host) || "web.facebook.com".equals(host)
            || "mbasic.facebook.com".equals(host);
    }
    public static String fromUrl(String raw) {
        for (int depth = 0; depth < 4; depth++) {
            if (raw == null || raw.length() > 16000) return null;
            URI u = UrlRules.parse(raw.trim());
            if (u == null || u.getHost() == null || u.getUserInfo() != null) return null;
            String scheme = u.getScheme() == null ? "" : u.getScheme().toLowerCase(Locale.ROOT);
            if (!scheme.equals("http") && !scheme.equals("https")) return null;
            if (u.getPort() != -1 && u.getPort() != (scheme.equals("http") ? 80 : 443)) return null;
            String host = u.getHost().toLowerCase(Locale.ROOT), path = u.getPath();
            if (path == null || path.contains("\\") || path.matches(".*(?:^|/)\\.{1,2}(?:/.*|$)")) return null;
            if ((host.equals("l.facebook.com") || host.equals("lm.facebook.com")) && path.equals("/l.php")) {
                raw = parameter(u.getRawQuery(), "u");
                continue;
            }
            if (!directHost(host) || !(path.equals("/marketplace") || path.startsWith("/marketplace/"))) return null;
            // Retain search/filter parameters while avoiding user info, ports, and fragments.
            return "https://www.facebook.com" + u.getRawPath()
                + (u.getRawQuery() == null ? "" : "?" + u.getRawQuery());
        }
        return null;
    }
    private static String parameter(String query, String key) {
        if (query == null) return null;
        for (String part : query.split("&")) {
            int split = part.indexOf('=');
            if (split < 0) continue;
            try {
                if (key.equals(URLDecoder.decode(part.substring(0, split), "UTF-8")))
                    return URLDecoder.decode(part.substring(split + 1), "UTF-8");
            } catch (Exception ignored) { return null; }
        }
        return null;
    }
    public static String fromText(String text) {
        if (text == null || text.length() > 100000) return null;
        Matcher m = Pattern.compile("https?://[^\\s<>\"']+", Pattern.CASE_INSENSITIVE).matcher(text);
        while (m.find()) {
            String candidate = m.group().replaceAll("[.,;!?)\\]}>]+$", "");
            String link = fromUrl(candidate);
            if (link != null) return link;
        }
        return null;
    }
}
