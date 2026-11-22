const BLOCK_TITLE = /access denied|are you a robot|unusual traffic|request blocked|verify you are (a )?human|just a moment|attention required|pardon our interruption|proxy error/i;
const MISSING_TITLE = /page not found|404 not found|^404\b|can'?t find the page|page (is )?unavailable|no longer available/i;

export function pageTitle(html) {
    return html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1].trim() ?? '';
}

export function classifyPage(html) {
    const title = pageTitle(html);
    if (BLOCK_TITLE.test(title) || /<h1\b[^>]*>\s*(access denied|request blocked|verify you are (a )?human)/i.test(html)) {
        return 'SOFT_BLOCK';
    }
    if (MISSING_TITLE.test(title)) return 'NOT_FOUND';
    if (!title || /^error$|^privacy error$/i.test(title) || /chrome-error:\/\/chromewebdata|id="main-frame-error"/i.test(html.slice(0, 2000))) {
        return 'ERROR';
    }
    if (/"@type"\s*:\s*(?:"Product"|\[\s*"Product")|<meta\b[^>]*property=["']og:type["'][^>]*content=["']product["']/i.test(html)) {
        return 'PRODUCT_CANDIDATE';
    }
    return 'UNVERIFIED';
}
