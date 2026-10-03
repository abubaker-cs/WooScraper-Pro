(async function() {
  const sendLog = (msg, type = 'normal') => chrome.runtime.sendMessage({ action: "log", message: msg, type: type });
  const sendProgress = (current, total, item) => chrome.runtime.sendMessage({ action: "progress", current, total, item });
  const sendComplete = (data) => chrome.runtime.sendMessage({ action: "complete", data: data });

  // Safe Chrome Storage Wrappers
  const getCache = (key) => new Promise(resolve => {
    if (!chrome || !chrome.storage || !chrome.storage.local) return resolve(null);
    chrome.storage.local.get([key], res => resolve(res ? res[key] : null));
  });
  const setCache = (key, val) => new Promise(resolve => {
    if (!chrome || !chrome.storage || !chrome.storage.local) return resolve();
    chrome.storage.local.set({[key]: val}, resolve);
  });

  const currentDomain = window.location.hostname;
  
  let path = window.location.pathname;
  let subDirMatch = path.match(/^(.*?)\/(?:shop|product|product-category|pd)/i);
  const baseUrl = window.location.origin + (subDirMatch ? subDirMatch[1] : "");
  const cacheKey = `wooSession_${currentDomain}${subDirMatch ? subDirMatch[1] : ""}`;

  sendLog(`Universal Engine Initialized. Target: ${baseUrl}`, "system");

  let productLinks = new Set();
  let extractedData = [];

  // ==========================================
  // PHASE 0: CHECK FOR EXISTING CACHE
  // ==========================================
  let sessionCache = await getCache(cacheKey);
  if (sessionCache && sessionCache.urls && sessionCache.urls.length > 0) {
    sendLog(`Found existing session cache. Resuming...`, "success");
    sessionCache.urls.forEach(u => productLinks.add(u));
    extractedData = sessionCache.extractedData || [];
  } 
  else {
    // ==========================================
    // LAYER 1: WOOCOMMERCE API SNIFFER
    // ==========================================
    let apiTag = document.querySelector('link[rel="https://api.w.org/"]');
    let apiBase = apiTag ? apiTag.href : `${baseUrl}/wp-json/`;

    if (!currentDomain.includes("jasani.ae") && !currentDomain.includes("hakplus.com") && !currentDomain.includes("brandersonline.com")) {
      sendLog("Probing WordPress REST API for catalog access...");
      try {
        let apiRes = await fetch(`${apiBase}wp/v2/product?per_page=5`);
        if (!apiRes.ok) apiRes = await fetch(`${apiBase}wc/store/products?per_page=5`); 
        
        if (apiRes.ok) {
          let data = await apiRes.json();
          if(data && data.length > 0) {
            sendLog("REST API is vulnerable. Mapping catalog via JSON...", "success");
            let page = 1;
            let previousSize = 0;

            while(page <= 50) { 
              sendLog(`Fetching API page ${page}...`, "system");
              let pageRes = await fetch(`${apiBase}wp/v2/product?per_page=100&page=${page}`);
              if(!pageRes.ok) pageRes = await fetch(`${apiBase}wc/store/products?per_page=100&page=${page}`);
              
              if(!pageRes.ok) break;
              let pageData = await pageRes.json();
              if(!pageData || pageData.length === 0) break;
              
              pageData.forEach(p => { 
                if (p.link) productLinks.add(p.link); 
                else if (p.permalink) productLinks.add(p.permalink);
              });
              
              if (productLinks.size === previousSize) break;
              previousSize = productLinks.size;
              page++;
            }
          }
        }
      } catch (e) {
        sendLog("REST API blocked. Engaging Layer 2 (Sitemaps)...", "error");
      }
    }

    // ==========================================
    // LAYER 2: SITEMAP MAPPER
    // ==========================================
    if (productLinks.size === 0) {
      sendLog("Scanning XML Sitemaps to map website inventory...");
      const sitemaps = ['/sitemap.xml', '/sitemap_index.xml', '/product-sitemap.xml', '/sitemap-pt-product-1.xml', '/wp-sitemap-posts-product-1.xml', '/sitemap.php'];

      for (let sm of sitemaps) {
        try {
          let res = await fetch(baseUrl + sm);
          if (res.ok) {
            sendLog(`Analyzing index: ${sm}...`);
            let text = await res.text();
            let doc = new DOMParser().parseFromString(text, "text/xml");
            
            let locs = doc.getElementsByTagName("loc");
            for (let i = 0; i < locs.length; i++) {
              let url = locs[i].textContent;
              if (currentDomain.includes("jasani.ae") && url.includes('/shop/') && !url.includes('/category/')) {
                productLinks.add(url);
              } else if (currentDomain.includes("hakplus.com") && url.includes('product_id=')) {
                productLinks.add(url); 
              } else if (currentDomain.includes("brandersonline.com") && url.includes('/pd/')) {
                productLinks.add(url); 
              } else if (!currentDomain.includes("jasani.ae") && !currentDomain.includes("hakplus.com") && !currentDomain.includes("brandersonline.com") && url.includes('/product/')) {
                productLinks.add(url); 
              }
            }
          }
        } catch(e) {}
      }
    }

    // ==========================================
    // LAYER 3: CONTEXTUAL DOM CRAWLER (Active Tab Target)
    // ==========================================
    if (productLinks.size === 0) {
      sendLog("Sitemaps missing. Engaging Contextual DOM Crawler on current page...", "system");
      try {
        let currentUrl = window.location.href; // Grabs the URL you are currently viewing
        let res = await fetch(currentUrl);
        let text = await res.text();
        let doc = new DOMParser().parseFromString(text, 'text/html');
        
        let links = doc.querySelectorAll('a');
        let foundOnPage = 0;
        
        links.forEach(a => {
          let href = a.href;
          if (!href) return;
          
          if (currentDomain.includes("brandersonline.com") && href.includes('/pd/')) {
            productLinks.add(href);
            foundOnPage++;
          } else if (currentDomain.includes("jasani.ae") && href.includes('/shop/') && !href.includes('/category/')) {
            productLinks.add(href);
            foundOnPage++;
          } else if (currentDomain.includes("hakplus.com") && href.includes('product_id=')) {
            productLinks.add(href);
            foundOnPage++;
          } else if (!currentDomain.includes("brandersonline.com") && !currentDomain.includes("jasani.ae") && !currentDomain.includes("hakplus.com") && href.includes('/product/') && !href.includes('?add-to-cart=') && !href.includes('#')) {
            productLinks.add(href);
            foundOnPage++;
          }
        });
        
        sendLog(`Contextual scan found ${foundOnPage} products on this page.`);
      } catch(e) { 
        sendLog("Contextual crawler failed to parse current page.", "error");
      }
    }
  }

  let urls = Array.from(productLinks);
  if (urls.length === 0) {
    sendLog("Critical Failure: Could not map product URLs.", "error");
    return;
  }

  await setCache(cacheKey, { urls: urls, extractedData: extractedData });

  // ==========================================
  // PHASE 2: SMART RESUME & ROUTING
  // ==========================================
  const total = urls.length;
  let completedUrls = extractedData.map(item => item.SourceURL);
  let pendingUrls = urls.filter(url => !completedUrls.includes(url));

  if (pendingUrls.length === 0) {
     sendLog("All products extracted! Handing payload to UI.", "success");
     sendComplete(extractedData);
     chrome.storage.local.remove(cacheKey); 
     return;
  }

  sendLog(`Extracting ${pendingUrls.length} products remaining out of ${total}.`, "system");

  for (let i = 0; i < pendingUrls.length; i++) {
    if (!navigator.onLine) {
       sendLog("CRITICAL: Internet connection lost. Pausing extraction.", "error");
       break; 
    }

    let url = pendingUrls[i];
    try {
      let res = await fetch(url);
      let text = await res.text();
      let doc = new DOMParser().parseFromString(text, 'text/html');
      
      let productObj = null;
      if (currentDomain.includes("jasani.ae")) productObj = extractOdoo(doc, url);
      else if (currentDomain.includes("hakplus.com")) productObj = extractHakplus(doc, url, text);
      else if (currentDomain.includes("brandersonline.com")) productObj = extractBrandersOnline(doc, url, text);
      else productObj = extractWooCommerce(doc, url);

      if (productObj) {
        productObj.SourceURL = url; 
        extractedData.push(productObj);
        await setCache(cacheKey, { urls: urls, extractedData: extractedData });

        sendProgress(extractedData.length, total, {
          sku: productObj.SKU,
          name: productObj.Name,
          price: `AED ${productObj.RegularPrice}`
        });
      }
    } catch (e) {
      sendLog(`Extraction failed for: ${url}`, "error");
    }
    await new Promise(r => setTimeout(r, 50)); 
  }

  if (extractedData.length === total) {
    sendLog("Universal extraction complete. Handing payload to UI.", "success");
    sendComplete(extractedData);
    chrome.storage.local.remove(cacheKey); 
  } else {
    sendLog(`Engine paused. ${extractedData.length}/${total} completed.`, "system");
    sendComplete(extractedData); 
  }

  // ==========================================
  // PHASE 3: THE EXTRACTION ADAPTERS
  // ==========================================

  // --- ADAPTER 4: BRANDERSONLINE (CUSTOM) ---
  function extractBrandersOnline(doc, url, text) {
    let title = doc.querySelector('h1')?.innerText.trim() || doc.querySelector('title')?.innerText.split('-')[0].trim() || 'Unknown';
    
    // Extract SKU securely from their URL structure (/pd/SKU/name)
    let skuMatch = url.match(/\/pd\/([^\/]+)/i);
    let sku = skuMatch ? skuMatch[1] : 'N/A';
    
    // Look for prices in the raw text or common tags
    let priceMatch = text.match(/(?:AED|Dhs|\$)[\s]*([0-9.,]+)/i);
    let price = priceMatch ? priceMatch[1].replace(/[^0-9.]/g, '') : '0.00';
    
    let desc = doc.querySelector('.product-description, #description, .desc, .item-details')?.innerHTML.trim() || doc.querySelector('meta[name="description"]')?.content.trim() || '';
    
    // Aggressive image grab for custom sites
    let images = Array.from(doc.querySelectorAll('.product-image img, .main-image img, #img-main, .gallery img, img.zoomImg'))
                 .map(img => img.src || img.getAttribute('data-src') || img.getAttribute('data-large_image'))
                 .filter(src => src && !src.includes('data:image'));
                 
    if(images.length === 0 && doc.querySelector('meta[property="og:image"]')) images.push(doc.querySelector('meta[property="og:image"]').content);
    
    return { Type: 'simple', SKU: sku, Name: title, RegularPrice: price, ShortDescription: desc, LongDescription: desc, Categories: 'Branders Import', Tags: '', Images: [...new Set(images)].join(', ') };
  }

  // --- ADAPTER 1: JASANI (ODOO) ---
  function extractOdoo(doc, url) {
    let ogTitle = doc.querySelector('meta[property="og:title"]')?.content || '';
    let title = doc.querySelector('h1[itemprop="name"]')?.textContent.trim() || ogTitle.split('|')[0].trim() || 'Unknown';
    
    let sku = doc.querySelector('.default_code')?.textContent.trim() || doc.querySelector('[itemprop="sku"]')?.textContent.trim();
    
    if (!sku || sku === 'N/A') {
      let bodyText = doc.body.textContent; 
      let skuMatch = bodyText.match(/(?:Item Code|SKU|Product Code)[\s:]*([A-Za-z0-9-]+(?:\s+[A-Za-z0-9-]+)?)/i);
      if (skuMatch) sku = skuMatch[1];
      else {
          let urlMatch = url.match(/\/shop\/([a-zA-Z0-9]+-[a-zA-Z0-9]+)-/i) || url.match(/\/shop\/([a-zA-Z0-9]+)-/i);
          sku = urlMatch ? urlMatch[1].toUpperCase() : 'N/A';
      }
    }
    
    if (sku && sku !== 'N/A') sku = sku.replace(/\s+/g, '');
    
    let priceElem = doc.querySelector('.oe_currency_value') || doc.querySelector('[itemprop="price"]');
    let price = priceElem ? priceElem.textContent.replace(/[^0-9.]/g, '') : '0.00';
    
    let rawDesc = doc.querySelector('#product_details')?.innerHTML || doc.querySelector('meta[name="description"]')?.content || '';
    let temp = document.createElement('div');
    temp.innerHTML = rawDesc;
    
    // Strip all layout junk, forms, hidden elements, and buttons/links
    temp.querySelectorAll('form, input, button, script, style, svg, [style*="display:none"], [style*="display: none"], .btn, a').forEach(el => el.remove());
    
    // Extract raw text, normalize spaces, filter empty lines, and format for WooCommerce
    let cleanText = temp.innerText.replace(/[\u00A0\t]/g, ' ');
    let lines = cleanText.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    let finalDesc = lines.join("<br><br>");
    
    let images = Array.from(doc.querySelectorAll('#o-carousel-product img.img-fluid, [itemprop="image"]')).map(img => img.src || img.content).filter(src => src && !src.includes('data:image'));
    if(images.length === 0 && doc.querySelector('meta[property="og:image"]')) images.push(doc.querySelector('meta[property="og:image"]').content);
    
    return { Type: 'simple', SKU: sku, Name: title, RegularPrice: price, ShortDescription: finalDesc, LongDescription: finalDesc, Categories: 'Jasani Import', Tags: '', Images: [...new Set(images)].join(', '), SourceURL: url };
  }

  // --- ADAPTER 2: HAKPLUS (OPENCART) ---
  function extractHakplus(doc, url, text) {
    let ogTitle = doc.querySelector('meta[property="og:title"]')?.content || '';
    let title = doc.querySelector('h1')?.innerText.trim() || ogTitle.trim() || 'Unknown';
    let skuMatch = text.match(/(?:Product Code|SKU|Item Code|Model)[\s<>\/a-z]*:\s*([A-Za-z0-9-]+)/i);
    let sku = skuMatch ? skuMatch[1] : 'N/A';
    let priceElem = doc.querySelector('h2.price') || doc.querySelector('ul.list-unstyled h2');
    let priceMatch = text.match(/(?:AED|Dhs)[\s]*([0-9.,]+)/i); 
    let price = '0.00';
    if (priceElem) price = priceElem.innerText.replace(/[^0-9.]/g, '');
    else if (priceMatch) price = priceMatch[1].replace(/[^0-9.]/g, '');
    
    // Grab the rich HTML description
    let desc = doc.querySelector('#tab-description')?.innerHTML.trim() || doc.querySelector('.product-description')?.innerHTML.trim() || doc.querySelector('meta[name="description"]')?.content.trim() || '';
    
    // NEW: Strip out toxic base64 embedded images from the description HTML to prevent CSV bloating
    desc = desc.replace(/src="data:image[^"]+"/g, 'src=""');
    
    let images = Array.from(doc.querySelectorAll('.thumbnails a.thumbnail, .product-image img')).map(el => el.href || el.src).filter(src => src && !src.includes('data:image'));
    if(images.length === 0 && doc.querySelector('meta[property="og:image"]')) images.push(doc.querySelector('meta[property="og:image"]').content);
    return { Type: 'simple', SKU: sku, Name: title, RegularPrice: price, ShortDescription: desc, LongDescription: desc, Categories: 'Hakplus Import', Tags: '', Images: [...new Set(images)].join(', ') };
  }

  // --- ADAPTER 3: WOOCOMMERCE (DEFAULT / corporategiftsme.com) ---
  function extractWooCommerce(doc, url) {
    let title = doc.querySelector('h1.product_title')?.innerText || doc.querySelector('h1.entry-title')?.innerText || doc.querySelector('meta[property="og:title"]')?.content.split(' - ')[0] || doc.querySelector('title')?.innerText.split(' - ')[0] || 'Unknown';
    title = title.trim();
    let sku = doc.querySelector('.sku')?.innerText || doc.querySelector('meta[property="product:sku"]')?.content || `N/A`;
    let priceElem = doc.querySelector('p.price ins bdi') || doc.querySelector('p.price bdi') || doc.querySelector('.price .woocommerce-Price-amount') || doc.querySelector('meta[property="product:price:amount"]');
    let price = priceElem ? (priceElem.content || priceElem.innerText).replace(/[^0-9.]/g, '') : '0.00';
    let shortDesc = doc.querySelector('.woocommerce-product-details__short-description')?.innerText.trim() || doc.querySelector('meta[name="description"]')?.content.trim() || '';
    let longDesc = doc.querySelector('#tab-description')?.innerHTML.trim() || '';
    let cats = Array.from(doc.querySelectorAll('.posted_in a')).map(a => a.innerText.trim()).join(', ');
    let tags = Array.from(doc.querySelectorAll('.tagged_as a')).map(a => a.innerText.trim()).join(', ');
    let imageSelectors = [
      '.woocommerce-product-gallery__wrapper a',
      '.woocommerce-product-gallery__image img',
      '.type-product .images img',
      '.type-product .product-images img',
      '.elementor-widget-woocommerce-product-images img',
      'img.wp-post-image',
      'img.attachment-woocommerce_single',
      'img.attachment-shop_single',
      'img.wc-block-woocommerce-product-gallery-large-image__image',
      '.wc-block-components-product-image img',
      '.wp-block-woocommerce-product-image img'
    ].join(', ');
    let imageNodes = Array.from(doc.querySelectorAll(imageSelectors));
    let rawImages = imageNodes.map(el => {
      let src = el.getAttribute('data-large_image') || el.getAttribute('data-src') || el.getAttribute('data-lazy-src') || el.href || el.src;
      if (src && src.startsWith('/')) src = window.location.origin + src;
      return src;
    }).filter(src => src && !src.includes('data:image') && !src.endsWith('.svg') && !src.endsWith('.gif'));
    if (rawImages.length === 0) { 
      let seoImg = doc.querySelector('meta[property="og:image"]')?.content; 
      if (seoImg) rawImages.push(seoImg); 
    }
    return { Type: 'simple', SKU: sku, Name: title, RegularPrice: price, ShortDescription: shortDesc, LongDescription: longDesc, Categories: cats, Tags: tags, Images: [...new Set(rawImages)].join(', ') };
  }
})();