package au.sutto.marketonly;
import java.net.URLEncoder;

public final class ExternalLinksTest {
    private static int count;
    private static void equal(String actual, String expected, String label) {
        count++;
        if (expected == null ? actual != null : !expected.equals(actual))
            throw new AssertionError(label + ": " + actual);
    }
    public static void main(String[] args) throws Exception {
        String listing = "https://www.facebook.com/marketplace/item/123/";
        for (String host : new String[]{"facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "mbasic.facebook.com"}) {
            equal(ExternalLinks.fromUrl("https://" + host + "/marketplace/item/123/"), listing, "host " + host);
            equal(ExternalLinks.fromUrl("http://" + host + "/marketplace/item/123/"), listing, "https upgrade " + host);
        }
        equal(ExternalLinks.fromUrl("HTTPS://M.FACEBOOK.COM:443/marketplace/item/123/"), listing, "case and standard port");
        equal(ExternalLinks.fromUrl("http://facebook.com:80/marketplace/item/123/"), listing, "http port");
        equal(ExternalLinks.fromUrl(listing + "?ref=messenger&tracking=%7B%22a%22%3A1%7D#ignored"),
            listing + "?ref=messenger&tracking=%7B%22a%22%3A1%7D", "preserve encoded query");
        equal(ExternalLinks.fromUrl("https://facebook.com/marketplace"), "https://www.facebook.com/marketplace", "bare Marketplace");
        for (String host : new String[]{"l.facebook.com", "lm.facebook.com"})
            equal(ExternalLinks.fromUrl("https://" + host + "/l.php?u=" + URLEncoder.encode(listing,"UTF-8") + "&h=x"), listing, "safe wrapper " + host);
        equal(ExternalLinks.fromText("Have a look:\n(" + listing + ")."), listing, "shared prose and punctuation");
        equal(ExternalLinks.fromText("https://example.com/ then " + listing), listing, "skip unrelated URL");
        equal(ExternalLinks.fromText(null), null, "empty share");
        for (String bad : new String[]{null, "", "not a link", "javascript:alert(1)", "file:///marketplace/item/123/", "fb://marketplace/123", "intent://marketplace/123",
            "https://facebook.com.evil.test/marketplace/item/123/", "https://facebook.com@evil.test/marketplace/item/123/",
            "https://user@facebook.com/marketplace/item/123/", "https://www.facebook.com:8443/marketplace/item/123/",
            "https://business.facebook.com/marketplace/item/123/", "https://facebook.com/", "https://facebook.com/reels/123/",
            "https://facebook.com/messages/t/123/", "https://facebook.com/marketplace-fake/item/123/",
            "https://facebook.com/share/abc/", "https://facebook.com/marketplace/../reels/123/",
            "https://facebook.com/marketplace/%2e%2e/reels/123/", "https://facebook.com/marketplace/./item/123/",
            "https://facebook.com/marketplace/%5creels/123/", "https://facebook.com/marketplace/item/%ZZ",
            "https://l.facebook.com/l.php?u=https%3A%2F%2Fevil.test%2Fmarketplace%2Fitem%2F123",
            "https://l.facebook.com/l.php?u=https%3A%2F%2Ffacebook.com%2Freels%2F123", "https://l.facebook.com/l.php?h=missing"})
            equal(ExternalLinks.fromUrl(bad), null, "reject unsafe or unsupported " + bad);
        String tooLong = new String(new char[100001]).replace('\0','a');
        equal(ExternalLinks.fromText(tooLong), null, "bounded share input");
        equal(ExternalLinks.fromUrl(listing + "?" + tooLong), null, "bounded URL input");
        System.out.println("PASS: " + count + " external link routing checks");
    }
}
