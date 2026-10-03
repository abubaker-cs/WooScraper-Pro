document.addEventListener('DOMContentLoaded', () => {
  let dataset = [];

  // Load data from Chrome Local Storage
  chrome.storage.local.get(['wooData'], function(result) {
    if (result.wooData) {
      dataset = result.wooData;
      document.getElementById('totalCount').innerText = dataset.length;
    } else {
      document.getElementById('totalCount').innerText = "0 (No data found)";
    }
  });

  // Helper: Safely escape CSV strings and flatten line breaks
  const escapeCSV = (str) => {
    if (str === null || str === undefined) return '""';
    let stringified = String(str);
    
    // If the text doesn't have HTML yet, convert raw newlines to <br> tags
    if (!stringified.includes('<p>') && !stringified.includes('<li>')) {
        stringified = stringified.replace(/(\r\n|\n|\r)/gm, "<br>");
    } else {
        // If it already has HTML, just strip the raw newlines to keep the CSV clean
        stringified = stringified.replace(/(\r\n|\n|\r)/gm, " "); 
    }
    
    // Double-escape quotes and wrap in quotes
    return '"' + stringified.replace(/"/g, '""').trim() + '"';
  };

  // Helper: Trigger file download
  const downloadCSV = (csvContent, filename) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Helper: Create URL-friendly slugs for Shopify
  const generateHandle = (title) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  };

  // ----------------------------------------------------
  // 1. WOOCOMMERCE FORMATTER
  // ----------------------------------------------------
  document.getElementById('btnWoo').addEventListener('click', () => {
    if (dataset.length === 0) return alert('No data to export.');
    
    // Strict WooCommerce Importer Headers
    const headers = [
      'Type', 'SKU', 'Name', 'Published', 'Is featured', 'Visibility in catalog', 
      'Short description', 'Description', 'Regular price', 'Categories', 'Tags', 'Images'
    ];
    
    let csvString = headers.join(',') + '\n';
    
    dataset.forEach(item => {
      let row = [
        escapeCSV('simple'),
        escapeCSV(item.SKU),
        escapeCSV(item.Name),
        escapeCSV('1'), // Published
        escapeCSV('0'), // Is featured
        escapeCSV('visible'), // Visibility
        escapeCSV(item.ShortDescription),
        escapeCSV(item.LongDescription),
        escapeCSV(item.RegularPrice),
        escapeCSV(item.Categories),
        escapeCSV(item.Tags),
        escapeCSV(item.Images)
      ];
      csvString += row.join(',') + '\n';
    });
    
    downloadCSV(csvString, 'woocommerce_native_export.csv');
  });

  // ----------------------------------------------------
  // 2. SHOPIFY FORMATTER
  // ----------------------------------------------------
  document.getElementById('btnShopify').addEventListener('click', () => {
    if (dataset.length === 0) return alert('No data to export.');
    
    // Shopify Importer Headers
    const headers = [
      'Handle', 'Title', 'Body (HTML)', 'Vendor', 'Product Category', 'Type', 'Tags', 
      'Published', 'Variant SKU', 'Variant Price', 'Variant Requires Shipping', 'Variant Taxable', 'Image Src'
    ];
    
    let csvString = headers.join(',') + '\n';
    
    dataset.forEach(item => {
      const handle = generateHandle(item.Name);
      
      // Shopify requires each image on a new line attached to the same Handle.
      // We split the comma-separated image string and generate rows accordingly.
      const imageArray = item.Images.split(',').map(img => img.trim()).filter(img => img);
      
      if (imageArray.length === 0) {
        // No images
        let row = [
          escapeCSV(handle), escapeCSV(item.Name), escapeCSV(item.LongDescription || item.ShortDescription),
          escapeCSV('Corporate Gifts'), escapeCSV(''), escapeCSV(''), escapeCSV(item.Tags),
          escapeCSV('TRUE'), escapeCSV(item.SKU), escapeCSV(item.RegularPrice), escapeCSV('TRUE'), escapeCSV('TRUE'), escapeCSV('')
        ];
        csvString += row.join(',') + '\n';
      } else {
        // First row contains all product data + first image
        let firstRow = [
          escapeCSV(handle), escapeCSV(item.Name), escapeCSV(item.LongDescription || item.ShortDescription),
          escapeCSV('Corporate Gifts'), escapeCSV(''), escapeCSV(''), escapeCSV(item.Tags),
          escapeCSV('TRUE'), escapeCSV(item.SKU), escapeCSV(item.RegularPrice), escapeCSV('TRUE'), escapeCSV('TRUE'), escapeCSV(imageArray[0])
        ];
        csvString += firstRow.join(',') + '\n';
        
        // Subsequent rows only need the Handle and the extra Image Src
        for (let i = 1; i < imageArray.length; i++) {
          let extraImageRow = [
            escapeCSV(handle), '', '', '', '', '', '', '', '', '', '', '', escapeCSV(imageArray[i])
          ];
          csvString += extraImageRow.join(',') + '\n';
        }
      }
    });
    
    downloadCSV(csvString, 'shopify_migration_export.csv');
  });

  // ----------------------------------------------------
  // 3. EXCEL / STANDARD FORMATTER
  // ----------------------------------------------------
  document.getElementById('btnExcel').addEventListener('click', () => {
    if (dataset.length === 0) return alert('No data to export.');
    
    // Simplified headers for human reading
    const headers = ['Product ID (SKU)', 'Product Name', 'Price (AED)', 'Category', 'Tags', 'Short Desc', 'Long Desc', 'Image URLs'];
    let csvString = headers.join(',') + '\n';
    
    dataset.forEach(item => {
      let row = [
        escapeCSV(item.SKU),
        escapeCSV(item.Name),
        escapeCSV(item.RegularPrice),
        escapeCSV(item.Categories),
        escapeCSV(item.Tags),
        escapeCSV(item.ShortDescription),
        escapeCSV(item.LongDescription),
        escapeCSV(item.Images)
      ];
      csvString += row.join(',') + '\n';
    });
    
    downloadCSV(csvString, 'excel_catalog_backup.csv');
  });
});