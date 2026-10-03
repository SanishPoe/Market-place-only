package au.sutto.marketonly;
public final class UrlRulesTest {
    private static int count;
    private static void check(boolean ok, String label) {
        count++; if (!ok) throw new AssertionError(label);
    }
    public static void main(String[] args) {
        check(UrlRules.facebook(UrlRules.MARKET), "official marketplace");
        check(UrlRules.facebook("https://m.facebook.com/login/"), "mobile login");
        check(!UrlRules.facebook("https://facebook.com.attacker.test/"), "lookalike host");
        check(!UrlRules.facebook("https://facebook.com@attacker.test/"), "userinfo deception");
        check(!UrlRules.facebook("https://user@facebook.com/"), "reject userinfo");
        check(!UrlRules.facebook("http://facebook.com/"), "reject insecure main frame");
        check(!UrlRules.facebook("https://facebook.com:8443/"), "reject alternate port");
        check(!UrlRules.facebook(null), "null rejected");
        check(!UrlRules.facebook("javascript:alert(1)"), "script rejected");
        for (String path : new String[]{"/", "/?sk=h_chr", "/home.php", "/index.php", "/watch/", "/reel/123", "/reels/", "/stories/", "/friends", "/gaming/", "/feeds/", "/groups/feed/"})
            check(UrlRules.feed("https://www.facebook.com"+path),"feed block "+path);
        for (String path : new String[]{"/marketplace/", "/marketplace/item/123/", "/marketplace/you/saved/", "/saved/", "/login/", "/checkpoint/", "/marketplace/profile/123/"})
            check(!UrlRules.feed("https://www.facebook.com"+path),"allow "+path);
        check(UrlRules.authentication("https://www.facebook.com/checkpoint/123"), "2FA allowed");
        check(UrlRules.messenger("https://www.facebook.com/messages/t/123"), "facebook thread");
        check(UrlRules.messenger("https://www.messenger.com/t/123"), "messenger thread");
        check(UrlRules.messenger("https://m.me/example"), "m.me");
        check(UrlRules.messenger("fb-messenger://user/123"), "messenger scheme");
        check(!UrlRules.messenger("https://messenger.com.evil.test/t/1"), "messenger lookalike rejected");
        check(!UrlRules.messenger("https://www.facebook.com/marketplace/item/123"), "listing is not recipient");
        check(UrlRules.messengerWeb("https://www.facebook.com/messages/t/123").equals("https://www.messenger.com/t/123"), "thread conversion exact");
        check(UrlRules.messengerWeb("https://www.facebook.com/messenger/t/456").equals("https://www.messenger.com/t/456"), "alternate thread conversion");
        check(UrlRules.messengerWeb("https://www.facebook.com/messages/t/123?ref=marketplace#last").equals("https://www.messenger.com/t/123?ref=marketplace#last"), "thread context preserved");
        check(UrlRules.marketplace("https://m.facebook.com/marketplace/item/123/"), "share listing accepted");
        check(!UrlRules.marketplace("https://evil.test/marketplace/item/123/"), "share attacker rejected");
        check(UrlRules.listing("https://www.facebook.com/marketplace/item/123/"),"photo viewer on listing");
        check(!UrlRules.listing(UrlRules.MARKET),"photo viewer is not browse routing");
        check(UrlRules.photo("https://scontent.xx.fbcdn.net/photo.jpg?token=123"),"Facebook CDN photo");
        check(UrlRules.photo("https://lookaside.fbsbx.com/photo.jpg"),"Facebook alternate CDN");
        check(UrlRules.photo("https://www.facebook.com/photo.php?id=1"),"Facebook image source");
        check(!UrlRules.photo("https://fbcdn.net.evil.test/photo.jpg"),"photo lookalike rejected");
        check(!UrlRules.photo("https://user@fbcdn.net/photo.jpg"),"photo userinfo rejected");
        check(!UrlRules.photo("https://fbcdn.net:8443/photo.jpg"),"photo alternate port rejected");
        check(!UrlRules.photo("http://fbcdn.net/photo.jpg"),"insecure photo rejected");
        check(!UrlRules.photo("file:///sdcard/photo.jpg"),"local photo rejected");
        check(!UrlRules.photo("javascript:alert(1)"),"photo script rejected");
        check(!UrlRules.photo(null),"null photo rejected");
        System.out.println("PASS: " + count + " URL routing and security cases");
    }
}
