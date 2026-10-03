# WooExtractor Pro 📦

![Version](https://img.shields.io/badge/version-3.2.0-blue.svg)
![Manifest](https://img.shields.io/badge/Manifest-V3-brightgreen.svg)
![Platform](https://img.shields.io/badge/platform-Chrome_Extension-orange.svg)

**WooExtractor Pro** is a powerful, locally-run Chrome Extension designed to autonomously discover, extract, standardize, and export massive e-commerce product catalogs from diverse CMS architectures. 

Built to handle large-scale data migrations (5,000+ products) directly from the browser, it bypasses traditional server-side limitations, network timeouts, and API restrictions by leveraging your active, authenticated browser session.

---

## 🎯 Why This Was Created (The Problem)
Migrating extensive product catalogs between e-commerce platforms is historically prone to failure. Traditional methods rely on server-side scripts that frequently hit `504 Gateway Timeouts`, strict PHP `memory_limit` walls, or restrictive firewalls. Furthermore, target websites often use aggressive caching, hidden REST APIs, missing sitemaps, lazy-loaded images, toxic Base64 embedded assets, or entirely different CMS backends (WooCommerce vs. Odoo vs. OpenCart), making standard scraping tools useless or requiring expensive, recurring SaaS subscriptions.

## 💡 How It Helps (The Solution)
WooExtractor Pro shifts the extraction workload from the server to the local browser environment. By acting as an authorized client session, it bypasses firewalls and server resource limits. 
It utilizes a **Universal Adapter Pattern** to normalize data from radically different platforms into a single, standardized object structure. The resulting data is formatted perfectly for instantaneous, zero-configuration imports into fresh WooCommerce or Shopify installations while preserving original rich-text formatting.

---

## ✨ Core Features

*   **Tri-Layer Discovery Engine:** Intelligently maps website catalogs using a cascading failsafe system:
    1.  **Layer 1 (API Sniffer):** Probes for vulnerable or public REST APIs (`/wp-json/wp/v2/product` or `/wc/store/products`). Includes intelligent subdirectory detection for nested WordPress installs.
    2.  **Layer 2 (Sitemap Mapper):** If APIs are locked, scans standard XML indexes (`sitemap.xml`, `product-sitemap.xml`, etc.).
    3.  **Layer 3 (Contextual Active-Tab Crawler):** If SEO indexes are disabled, scans the exact category page you are actively viewing in your browser to precision-target specific product grids.
*   **Universal Platform Adapters:** Specific DOM extraction and routing logic for:
    *   **WooCommerce** (Supports both Classic Themes and modern Gutenberg Block layouts)
    *   **Odoo ERP** (Includes a 3-Tier SKU Extraction system: Structural classes → Visual text reading → URL slug sniffing)
    *   **OpenCart** (e.g., Hakplus)
    *   **Custom PHP Platforms** (e.g., BrandersOnline)
*   **Persistent Side Panel UI (Manifest V3):** Locks the extraction dashboard to Chrome's Side Panel, allowing you to switch tabs, browse, or minimize the window without the operating system killing the background process. Includes a 1-click **Reset Engine** utility.
*   **Smart Session Caching (Unlimited Storage):** Writes extraction progress directly to `chrome.storage.local` bypassing Chrome's default 5MB quota. If the internet connection drops, the engine pauses safely and resumes exactly where it left off. 
*   **Aggressive Asset & Rich Text Extraction:** 
    *   **Image Hunter:** Defeats modern optimization plugins by digging through lazy-load attributes (`data-src`, `data-large_image`) to extract true high-resolution assets.
    *   **Rich HTML Preservation:** Captures `.innerHTML` to preserve bullet points, bold headers, and tables, while safely stripping out toxic, bloated Base64 inline images.
    *   **Smart CSV Formatting:** Flattens HTML newlines into `<br>` tags to keep the CSV strictly 1-row-per-product for flawless database imports.

---

## 🚀 Installation & Usage

### Local Installation (Developer Mode)
1. Download or clone this repository to your local machine.
2. Open Google Chrome (or Brave) and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top right corner).
4. Click **Load unpacked** and select the folder containing the extension files.

### How to Run an Extraction
1. Navigate to the target e-commerce store in your active Chrome tab.
2. Click the WooExtractor Pro icon in your Chrome toolbar. This will open the persistent **Side Panel**.
3. Click **Start Deep Scan**.
4. The engine will automatically detect the CMS, route to the correct adapter, and begin processing the catalog. 
5. You can safely switch tabs or work in other applications while the progress bar updates live.
6. Once complete (or manually paused), click **Export CSV** to download a perfectly formatted payload.
7. Click **Reset Engine** when you are ready to wipe the local cache and start a new project.

---

## 🛠️ Architecture & Tech Stack
*   **Frontend UI:** HTML5, CSS3 (Custom Dark Theme / Material aesthetic)
*   **Engine Logic:** Vanilla JavaScript (ES6+), DOMParser API, Fetch API, RegEx
*   **Chrome APIs:** `chrome.sidePanel`, `chrome.storage.local`, `chrome.runtime.sendMessage`, `unlimitedStorage`

---

## 📅 Release History & Revision Log

### v3.3.0 (Current)
*   **[Engine Upgrade]** Implemented a Real-Time Virtual DOM Cleaner for Odoo adapters to strip complex page layouts, form inputs, and injected CSS from product descriptions, outputting pristine text.
*   **[Feature]** Added `unlimitedStorage` manifest permission to bypass Chrome's 5MB limit, preventing silent crashes on massive catalogs.
*   **[Feature]** Upgraded Jasani (Odoo) adapter with a 3-Tier SKU fallback (Class -> Visual Text -> URL Slug) and dual-block string compression (e.g., "TBSN 2142" -> "TBSN2142").
*   **[UI]** Added a dedicated "Reset Engine" button to the Sidebar to instantly clear the `chrome.storage.local` database.
*   **[Fix]** Implemented Base64 image stripping (`src="data:image..."`) to prevent CSV bloat from embedded HTML assets.

### v3.1.0
*   **[Architecture]** Replaced `.innerText` with `.innerHTML` across all adapters to perfectly preserve bullet points, tables, and bold text.
*   **[Fix]** Upgraded CSV Escaping function to convert raw line breaks into `<br>` tags, maintaining clean 1-row-per-product spreadsheet formatting.
*   **[Feature]** Added custom Adapter #4 (BrandersOnline) with URL-slug SKU sniffing.
*   **[Feature]** Upgraded Layer 3 Crawler to Contextual Active-Tab scanning for platforms that lack standard `/shop/` routing.

### v3.0.0
*   **[UI Upgrade]** Migrated from fragile Browser Action Popups to the persistent Manifest V3 Side Panel API.
*   **[Feature]** Smart Session Caching: Engine now reads/writes to `chrome.storage.local` to allow pausing, resuming, and surviving internet disconnections.
*   **[Fix]** Implemented intelligent Base URL detection for WordPress instances installed in subdirectories (e.g., `/nexbyte/`).
*   **[Fix]** Upgraded `extractWooCommerce` with Aggressive Image Extraction to bypass lazy-loading and WooCommerce Gutenberg Block images.

### v2.0.0
*   **[Architecture]** Shifted from a single-platform script to the "Universal Adapter Pattern".
*   **[Feature]** Added specific extraction adapters for Odoo ERP and Custom PHP/OpenCart.
*   **[UI]** Replaced automatic local downloads with a dedicated Export Dashboard (`export.html`).

### v1.0.0
*   Initial release. Basic hybrid extraction engine built strictly for WooCommerce standard themes.