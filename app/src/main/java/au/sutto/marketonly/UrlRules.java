package au.sutto.marketonly;

import java.net.URI;
import java.util.Locale;

/** No Android dependencies: used by the browser and executable routing tests. */
public final class UrlRules {
    public static final String MARKET = "https://www.facebook.com/marketplace/";
    public static final String SAVED = "https://www.facebook.com/marketplace/you/saved/";
    public static final String COLLECTIONS = "https://www.facebook.com/saved/";
    private UrlRules() {}
    public static URI parse(String raw) {
        try { return new URI(raw); } catch (Exception e) { return null; }
    }
    public static boolean domain(String host, String base) {
        if (host == null) return false;
        host = host.toLowerCase(Locale.ROOT);
        return host.equals(base) || host.endsWith("." + base);
    }
    public static boolean https(String raw) {
        URI u = parse(raw);
        return u != null && "https".equalsIgnoreCase(u.getScheme()) && u.getUserInfo() == null
                && (u.getPort() == -1 || u.getPort() == 443);
    }
    public static boolean facebook(String raw) {
        URI u = parse(raw);
        return https(raw) && domain(u.getHost(), "facebook.com");
    }
    public static boolean messenger(String raw) {
        URI u = parse(raw);
        if (u == null) return false;
        String scheme = u.getScheme();
        if ("fb-messenger".equalsIgnoreCase(scheme)) return true;
        if (!https(raw)) return false;
        if (domain(u.getHost(), "messenger.com") || "m.me".equalsIgnoreCase(u.getHost())) return true;
        String p = path(raw);
        return facebook(raw) && (segment(p, "/messages") || segment(p, "/messenger")
                || p.equals("/messages.php"));
    }
    public static String path(String raw) {
        URI u = parse(raw);
        String p = u == null ? null : u.getPath();
        if (p == null || p.isEmpty()) return "/";
        return p.toLowerCase(Locale.ROOT).replaceAll("/{2,}", "/");
    }
    private static boolean segment(String p, String base) {
        return p.equals(base) || p.startsWith(base + "/");
    }
    public static boolean home(String raw) {
        if (!facebook(raw)) return false;
        String p = path(raw);
        return p.equals("/") || p.equals("/home.php") || p.equals("/index.php");
    }
    public static boolean feed(String raw) {
        if (!facebook(raw)) return false;
        String p = path(raw);
        return home(raw) || segment(p, "/watch") || segment(p, "/reel") || segment(p, "/reels")
            || segment(p, "/stories") || segment(p, "/gaming") || segment(p, "/friends")
            || segment(p, "/newsfeed") || segment(p, "/feeds") || segment(p, "/groups/feed");
    }
    public static boolean authentication(String raw) {
        if (!facebook(raw)) return false;
        String p = path(raw);
        return p.startsWith("/login") || p.startsWith("/checkpoint") || p.startsWith("/two_step")
            || p.startsWith("/recover") || p.startsWith("/confirm") || p.startsWith("/auth")
            || p.startsWith("/security") || p.startsWith("/device") || p.startsWith("/dialog")
            || p.startsWith("/reg") || p.startsWith("/r.php") || p.startsWith("/consent");
    }
    public static boolean marketplace(String raw) {
        return facebook(raw) && segment(path(raw), "/marketplace");
    }
    public static boolean listing(String raw) {
        return facebook(raw) && path(raw).matches("/marketplace/item/[^/]+/?");
    }
    public static boolean photo(String raw) {
        URI u=parse(raw);
        return https(raw) && u!=null && (domain(u.getHost(),"fbcdn.net")
            ||domain(u.getHost(),"fbsbx.com")||domain(u.getHost(),"facebook.com"));
    }
    /** Only convert a known thread URL, never use a listing ID as a person ID. */
    public static String messengerWeb(String raw) {
        if (!facebook(raw)) return raw;
        URI u = parse(raw);
        String p = u.getPath();
        String suffix = (u.getRawQuery() == null ? "" : "?" + u.getRawQuery())
            + (u.getRawFragment() == null ? "" : "#" + u.getRawFragment());
        if (p.startsWith("/messages/t/")) return "https://www.messenger.com/t/" + p.substring(12) + suffix;
        if (p.startsWith("/messenger/t/")) return "https://www.messenger.com/t/" + p.substring(13) + suffix;
        return raw;
    }
}
