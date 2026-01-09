import {
  getPostTitle,
  getPostSubtitle,
  getPostSubtype,
  getPostEvent,
  getPostIncident,
  getLastModifiedByList,
  getLatestModifier,
} from "@inseme/cop-host";

/**
 * Universal Feed Adapter
 * Parses JSON Feed, RSS, and Atom into a normalized internal format.
 */

export const FeedType = {
  JSON_FEED: "jsonfeed",
  RSS: "rss",
  ATOM: "atom",
  UNKNOWN: "unknown",
};

/**
 * Detects the type of feed from the content.
 * @param {string|object} content
 * @returns {string} FeedType
 */
export function detectFeedType(content) {
  if (typeof content === "object" && content.version && content.version.includes("jsonfeed")) {
    return FeedType.JSON_FEED;
  }
  if (typeof content === "string") {
    if (content.includes("<rss") || content.includes("<channel>")) return FeedType.RSS;
    if (content.includes("<feed") && content.includes('xmlns="http://www.w3.org/2005/Atom"'))
      return FeedType.ATOM;
  }
  return FeedType.UNKNOWN;
}

/**
 * Parses a feed into a normalized format.
 * @param {string|object} content
 * @returns {object} Normalized feed object
 */
export function parseFeed(content) {
  const type = detectFeedType(content);

  switch (type) {
    case FeedType.JSON_FEED:
      return parseJSONFeed(content);
    case FeedType.RSS:
      return parseRSS(content);
    case FeedType.ATOM:
      return parseAtom(content);
    default:
      throw new Error("Unsupported feed format");
  }
}

function parseJSONFeed(json) {
  // Already close to our internal format
  return {
    title: json.title,
    description: json.description,
    home_page_url: json.home_page_url,
    feed_url: json.feed_url,
    items: json.items.map((item) => ({
      id: item.id,
      url: item.url,
      title: item.title,
      content_html: item.content_html,
      content_text: item.content_text,
      summary: item.summary,
      date_published: item.date_published,
      author: item.author,
      _meta: item._meta || {},
    })),
  };
}

function parseRSS(xmlString) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlString, "text/xml");
  const channel = xml.querySelector("channel");

  const items = Array.from(channel.querySelectorAll("item")).map((item) => {
    return {
      id: item.querySelector("guid")?.textContent || item.querySelector("link")?.textContent,
      url: item.querySelector("link")?.textContent,
      title: item.querySelector("title")?.textContent,
      content_html: item.querySelector("description")?.textContent, // RSS often puts HTML in description
      content_text: null,
      summary: item.querySelector("description")?.textContent,
      date_published: item.querySelector("pubDate")?.textContent
        ? new Date(item.querySelector("pubDate")?.textContent).toISOString()
        : null,
      author: {
        name:
          item.querySelector("author")?.textContent ||
          item.querySelector("dc\\:creator")?.textContent,
      },
      _meta: { item_type: "rss_item" },
    };
  });

  return {
    title: channel.querySelector("title")?.textContent,
    description: channel.querySelector("description")?.textContent,
    home_page_url: channel.querySelector("link")?.textContent,
    items: items,
  };
}

function parseAtom(xmlString) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlString, "text/xml");

  const items = Array.from(xml.querySelectorAll("entry")).map((entry) => {
    const link =
      entry.querySelector("link[rel='alternate']")?.getAttribute("href") ||
      entry.querySelector("link")?.getAttribute("href");
    return {
      id: entry.querySelector("id")?.textContent,
      url: link,
      title: entry.querySelector("title")?.textContent,
      content_html:
        entry.querySelector("content[type='html']")?.textContent ||
        entry.querySelector("summary")?.textContent,
      content_text: entry.querySelector("content[type='text']")?.textContent,
      summary: entry.querySelector("summary")?.textContent,
      date_published:
        entry.querySelector("published")?.textContent ||
        entry.querySelector("updated")?.textContent,
      author: { name: entry.querySelector("author name")?.textContent },
      _meta: { item_type: "atom_entry" },
    };
  });

  return {
    title: xml.querySelector("title")?.textContent,
    home_page_url: xml.querySelector("link[rel='alternate']")?.getAttribute("href"),
    items: items,
  };
}
