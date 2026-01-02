import { Product } from '../types';
import { supabase } from '../lib/supabase';

/**
 * Parse XML product feed from URL
 * Supports common formats: RSS, Google Shopping, and custom XML structures
 * @param url - URL of the XML feed
 * @param defaultCurrency - Default currency to use if not found in feed (e.g., "KES", "USD")
 */
export async function parseXMLFeed(url: string, defaultCurrency: string = 'USD'): Promise<Product[]> {
  try {
    // Fetch the XML feed with CORS proxy if needed
    let response: Response;
    try {
      // Try direct fetch first
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/xml, text/xml, */*',
        },
        mode: 'cors',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
      }
    } catch (fetchError: any) {
      // If CORS fails, try using a CORS proxy
      if (fetchError.message?.includes('CORS') || fetchError.message?.includes('Failed to fetch')) {
        console.warn('Direct fetch failed, trying CORS proxy...');
        // Use a public CORS proxy
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        response = await fetch(proxyUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch feed via proxy: ${response.status} ${response.statusText}`);
        }
      } else {
        throw fetchError;
      }
    }

    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    // Check for parsing errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      throw new Error('Failed to parse XML feed');
    }

    const products: Product[] = [];

    // Try different XML formats
    // Check all items first to determine format
    const allItems = xmlDoc.querySelectorAll('rss > channel > item, channel > item, item');
    
    if (allItems.length > 0) {
      // Check first item to see if it has Google Shopping namespace (g:price)
      const firstItem = allItems[0];
      let hasGooglePrice = false;
      
      // Try multiple methods to detect Google Shopping format
      // Method 1: Direct selector (escaped colon)
      try {
        hasGooglePrice = firstItem.querySelector('g\\:price') !== null;
      } catch (e) {
        // Selector might not work, try other methods
      }
      
      // Method 2: Check children directly for price element
      if (!hasGooglePrice) {
        const children = Array.from(firstItem.children);
        hasGooglePrice = children.some(child => {
          const tagName = child.tagName || child.nodeName || '';
          return tagName.toLowerCase() === 'g:price' || 
                 (tagName.toLowerCase() === 'price' && child.prefix === 'g') ||
                 (child.localName === 'price' && child.namespaceURI?.includes('google.com'));
        });
      }
      
      // Method 3: Check if any child has 'g:' prefix in tagName
      if (!hasGooglePrice) {
        const children = Array.from(firstItem.children);
        hasGooglePrice = children.some(child => {
          const tagName = child.tagName || child.nodeName || '';
          return tagName.startsWith('g:') || tagName.includes(':g:');
        });
      }
      
      if (hasGooglePrice) {
        // Google Shopping format - use Google Shopping parser
        allItems.forEach((item) => {
          const product = parseGoogleShoppingItem(item, defaultCurrency);
          if (product) products.push(product);
        });
        return products;
      } else {
        // Regular RSS format
        allItems.forEach((item) => {
          const product = parseRSSItem(item, defaultCurrency);
          if (product) products.push(product);
        });
        return products;
      }
    }

    // 3. Custom XML format (products > product or root > product)
    const customProducts = xmlDoc.querySelectorAll('product, products > product, root > product');
    if (customProducts.length > 0) {
      customProducts.forEach((productEl) => {
        const product = parseCustomProduct(productEl, defaultCurrency);
        if (product) products.push(product);
      });
      return products;
    }

    // 4. Try generic structure (any element with common product fields)
    const genericItems = xmlDoc.querySelectorAll('item, entry, product');
    genericItems.forEach((item) => {
      const product = parseGenericItem(item, defaultCurrency);
      if (product) products.push(product);
    });

    return products;
  } catch (error) {
    console.error('Error parsing XML feed:', error);
    throw error;
  }
}

/**
 * Parse RSS item format
 */
function parseRSSItem(item: Element, defaultCurrency: string = 'USD'): Product | null {
  const getText = (selector: string) => {
    const el = item.querySelector(selector);
    return el?.textContent?.trim() || '';
  };

  const title = getText('title');
  const link = getText('link');
  if (!title || !link) return null;

  const description = getText('description');
  const guid = getText('guid') || link;
  const category = getText('category');
  
  // Try to extract price from description or other fields
  // Look for currency codes followed by price
  const priceMatch = description.match(/(?:USD|EUR|GBP|KES|JPY|CNY|INR|AUD|CAD|CHF|NZD|ZAR|BRL|MXN|RUB|SEK|NOK|DKK|PLN|CZK|HUF|RON|BGN|HRK|TRY|ILS|AED|SAR|THB|SGD|HKD|KRW)\s*\$?([\d,]+\.?\d*)/i) || 
                     description.match(/\$?([\d,]+\.?\d*)/);
  let price: number | undefined = undefined;
  let currency = defaultCurrency;
  
  if (priceMatch) {
    // Check if currency code was found
    const currencyMatch = priceMatch[0].match(/([A-Z]{3})/i);
    if (currencyMatch) {
      currency = currencyMatch[1].toUpperCase();
    }
    price = parseFloat(priceMatch[priceMatch.length - 1].replace(/,/g, ''));
  }

  // Try to find image
  const imageUrl = getText('enclosure[type^="image"]') || 
                   getText('image') ||
                   getText('media\\:content[type^="image"]') ||
                   extractImageFromDescription(description);

  return {
    id: '', // Will be set when saving
    botId: '', // Will be set when saving
    productId: guid,
    name: title,
    description,
    price,
    currency,
    imageUrl,
    productUrl: link,
    category,
    keywords: extractKeywords(title, description, category),
    inStock: true,
  };
}

/**
 * Parse Google Shopping item format
 */
function parseGoogleShoppingItem(item: Element, defaultCurrency: string = 'USD'): Product | null {
  const getText = (selector: string) => {
    const el = item.querySelector(selector);
    return el?.textContent?.trim() || '';
  };

  // Google Shopping uses g: namespace
  // Try multiple selector strategies for namespace handling
  const title = getText('title') || getText('g\\:title') || getText('*|title');
  const link = getText('link') || getText('g\\:link') || getText('*|link');
  if (!title || !link) return null;

  const description = getText('description') || getText('g\\:description') || getText('*|description');
  const id = getText('g\\:id') || getText('*|id') || link;
  
  // Try multiple ways to get price (namespace handling can be tricky)
  let priceText = getText('g\\:price');
  if (!priceText) {
    // Try direct child search for price element
    const children = Array.from(item.children);
    const priceChild = children.find(child => {
      const tagName = (child.tagName || child.nodeName || '').toLowerCase();
      return tagName === 'g:price' || 
             tagName === 'price' ||
             (child.localName === 'price' && (child.prefix === 'g' || child.namespaceURI?.includes('google.com')));
    });
    priceText = priceChild?.textContent?.trim() || '';
  }
  if (!priceText) {
    // Try with wildcard namespace (might not work in all browsers)
    try {
      const priceEl = item.querySelector('*|price');
      priceText = priceEl?.textContent?.trim() || '';
    } catch (e) {
      // Wildcard namespace not supported
    }
  }
  
  // Extract currency code (3 uppercase letters, typically at the start)
  // Examples: "KES 13995.0", "USD 99.99", "EUR 50.00"
  let currency = defaultCurrency;
  let price: number | undefined = undefined;
  
  if (priceText) {
    // Trim whitespace and normalize
    priceText = priceText.trim().replace(/\s+/g, ' ');
    
    // Try multiple patterns to handle different formats:
    // Format 1: "KES 13995.0" (currency first, then price)
    // Format 2: "5979 KES" (price first, then currency)
    // Format 3: "13995.0 KES" (price with decimal, then currency)
    
    const allMatches: Array<{currency: string, price: number, index: number, confidence: number}> = [];
    
    // Pattern 1: Currency at start, then price (e.g., "KES 13995.0")
    const pattern1 = /^([A-Z]{3})\s+([\d,]+(?:\.\d+)?)/;
    let match1 = priceText.match(pattern1);
    if (match1 && match1.length >= 3) {
      const numericValue = match1[2].replace(/,/g, '');
      const parsedPrice = parseFloat(numericValue);
      if (!isNaN(parsedPrice) && parsedPrice > 0) {
        allMatches.push({
          currency: match1[1],
          price: parsedPrice,
          index: 0,
          confidence: 10 // Highest confidence for start-of-string match
        });
      }
    }
    
    // Pattern 2: Price first, then currency (e.g., "5979 KES", "13995.0 KES")
    // Match price at start, then currency (can be at end or followed by space/end)
    const pattern2 = /^([\d,]+(?:\.\d+)?)\s+([A-Z]{3})(?:\s|$)/;
    let match2 = priceText.match(pattern2);
    if (match2 && match2.length >= 3) {
      const numericValue = match2[1].replace(/,/g, '');
      const parsedPrice = parseFloat(numericValue);
      if (!isNaN(parsedPrice) && parsedPrice > 0) {
        allMatches.push({
          currency: match2[2],
          price: parsedPrice,
          index: 0,
          confidence: 9 // High confidence for start-of-string match with price first
        });
      }
    }
    
    // Pattern 3: Currency anywhere, then price (fallback for other formats)
    const pattern3 = /\b([A-Z]{3})\s+([\d,]+(?:\.\d+)?)/g;
    let match3;
    while ((match3 = pattern3.exec(priceText)) !== null) {
      // Skip if we already matched this at the start
      if (match3.index === 0 && allMatches.some(m => m.index === 0 && m.confidence >= 9)) {
        continue;
      }
      const numericValue = match3[2].replace(/,/g, '');
      const parsedPrice = parseFloat(numericValue);
      if (!isNaN(parsedPrice) && parsedPrice > 0) {
        allMatches.push({
          currency: match3[1],
          price: parsedPrice,
          index: match3.index,
          confidence: 5 // Lower confidence for mid-string matches
        });
      }
    }
    
    // Pattern 4: Price anywhere, then currency (fallback)
    const pattern4 = /([\d,]+(?:\.\d+)?)\s+([A-Z]{3})\b/g;
    let match4;
    while ((match4 = pattern4.exec(priceText)) !== null) {
      // Skip if we already matched this at the end
      if (match4.index + match4[0].length === priceText.length && allMatches.some(m => m.index === 0 && m.confidence >= 9)) {
        continue;
      }
      const numericValue = match4[1].replace(/,/g, '');
      const parsedPrice = parseFloat(numericValue);
      if (!isNaN(parsedPrice) && parsedPrice > 0) {
        allMatches.push({
          currency: match4[2],
          price: parsedPrice,
          index: match4.index,
          confidence: 4 // Lower confidence for mid-string matches
        });
      }
    }
    
    // If we found matches, pick the best one
    if (allMatches.length > 0) {
      // Sort by confidence (descending), then by price (descending), then by index (ascending)
      allMatches.sort((a, b) => {
        if (b.confidence !== a.confidence) {
          return b.confidence - a.confidence; // Higher confidence first
        }
        if (Math.abs(b.price - a.price) > 1) {
          return b.price - a.price; // Larger price first (if significantly different)
        }
        return a.index - b.index; // Earlier in string first
      });
      
      const bestMatch = allMatches[0];
      currency = bestMatch.currency;
      price = bestMatch.price;
      
      // Additional validation: If price is suspiciously small (< 1) and we have defaultCurrency set,
      // check if there's a better match with defaultCurrency
      if (price < 1 && defaultCurrency && currency !== defaultCurrency) {
        const defaultMatch = allMatches.find(m => m.currency === defaultCurrency && m.price >= 1);
        if (defaultMatch) {
          currency = defaultMatch.currency;
          price = defaultMatch.price;
        }
      }
      
      // If we have multiple matches and the best one has a very small price, 
      // prefer a match with a larger price if it exists
      if (allMatches.length > 1 && price < 10) {
        const largerPriceMatch = allMatches.find(m => m.price >= 10);
        if (largerPriceMatch && largerPriceMatch.confidence >= 5) {
          currency = largerPriceMatch.currency;
          price = largerPriceMatch.price;
        }
      }
    } else {
      // Last resort: extract just the number, use default currency
      // Only do this if we can't find any currency code
      const numericValue = priceText.replace(/[^\d.]/g, '');
      if (numericValue) {
        const parsedPrice = parseFloat(numericValue);
        if (!isNaN(parsedPrice) && parsedPrice > 0) {
          price = parsedPrice;
          // Keep defaultCurrency, don't change it
        }
      }
    }
  }
  
  const imageUrl = getText('g\\:image_link') || getText('g\\:image');
  const category = getText('g\\:google_product_category') || getText('g\\:product_type') || getText('g\\:category');
  const availability = getText('g\\:availability')?.toLowerCase();
  const inStock = !availability || availability.includes('in stock') || availability === 'in_stock';

  // Create product even if price is missing (price is optional)
  return {
    id: '', // Will be set when saving
    botId: '', // Will be set when saving
    productId: id,
    name: title,
    description,
    price, // Can be undefined if not found
    currency, // Will use defaultCurrency if not found
    imageUrl,
    productUrl: link,
    category,
    keywords: extractKeywords(title, description, category),
    inStock: inStock,
  };
}

/**
 * Parse custom product XML format
 */
function parseCustomProduct(productEl: Element, defaultCurrency: string = 'USD'): Product | null {
  const getText = (selector: string) => {
    const el = productEl.querySelector(selector);
    return el?.textContent?.trim() || '';
  };

  const name = getText('name') || getText('title') || getText('product_name');
  const url = getText('url') || getText('link') || getText('product_url');
  if (!name || !url) return null;

  const description = getText('description');
  const id = getText('id') || getText('product_id') || getText('sku') || url;
  const priceText = getText('price');
  const price = priceText ? parseFloat(priceText.replace(/[^\d.]/g, '')) : undefined;
  const currency = getText('currency') || 'USD';
  const imageUrl = getText('image') || getText('image_url') || getText('imageUrl');
  const category = getText('category') || getText('product_category');
  const inStockText = getText('in_stock') || getText('availability');
  const inStock = inStockText ? inStockText.toLowerCase() !== 'false' : true;

  return {
    id: '',
    botId: '',
    productId: id,
    name,
    description,
    price,
    currency,
    imageUrl,
    productUrl: url,
    category,
    keywords: extractKeywords(name, description, category),
    inStock,
  };
}

/**
 * Parse generic item (fallback)
 */
function parseGenericItem(item: Element, defaultCurrency: string = 'USD'): Product | null {
  const getText = (selector: string) => {
    const el = item.querySelector(selector);
    return el?.textContent?.trim() || '';
  };

  // Try common field names
  const name = getText('title') || getText('name') || item.getAttribute('name');
  const link = getText('link') || getText('url') || item.getAttribute('url');
  
  if (!name || !link) return null;

  const description = getText('description') || getText('desc');
  const id = getText('id') || getText('guid') || link;
  const priceText = getText('price') || getText('cost');
  
  // Extract currency and price
  let currency = defaultCurrency;
  let price: number | undefined = undefined;
  
  if (priceText) {
    // Check if price text contains currency code (e.g., "KES 13995.0")
    const currencyMatch = priceText.match(/^([A-Z]{3})\s+([\d,.]+)/);
    if (currencyMatch) {
      currency = currencyMatch[1];
      const numericValue = currencyMatch[2].replace(/,/g, '');
      price = parseFloat(numericValue);
    } else {
      // Fallback: look for currency code anywhere in the string
      const fallbackMatch = priceText.match(/\b([A-Z]{3})\s*([\d,.]+)/);
      if (fallbackMatch) {
        currency = fallbackMatch[1];
        const numericValue = fallbackMatch[2].replace(/,/g, '');
        price = parseFloat(numericValue);
      } else {
        // Last resort: extract just the number
        const numericValue = priceText.replace(/[^\d.]/g, '');
        price = numericValue ? parseFloat(numericValue) : undefined;
      }
    }
  }
  
  const imageUrl = getText('image') || getText('imageUrl') || getText('img');
  const category = getText('category') || getText('cat');

  return {
    id: '',
    botId: '',
    productId: id,
    name,
    description,
    price,
    currency,
    imageUrl,
    productUrl: link,
    category,
    keywords: extractKeywords(name, description, category),
    inStock: true,
  };
}

/**
 * Extract image URL from description HTML
 */
function extractImageFromDescription(description: string): string | undefined {
  const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["']/i);
  return imgMatch ? imgMatch[1] : undefined;
}

/**
 * Extract keywords from text fields
 */
function extractKeywords(name: string, description: string, category?: string): string[] {
  const keywords = new Set<string>();
  
  // Add category if present
  if (category) {
    keywords.add(category.toLowerCase());
  }

  // Extract words from name and description
  const text = `${name} ${description}`.toLowerCase();
  const words = text.match(/\b[a-z]{3,}\b/g) || [];
  
  // Filter out common stop words
  const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use']);
  
  words.forEach(word => {
    if (!stopWords.has(word) && word.length >= 3) {
      keywords.add(word);
    }
  });

  return Array.from(keywords).slice(0, 20); // Limit to 20 keywords
}

/**
 * Update product catalog for a bot
 */
export async function updateProductCatalog(botId: string, products: Product[]): Promise<void> {
  if (products.length === 0) {
    // If no products, clear the catalog for this bot
    const { error: deleteError } = await supabase
      .from('product_catalog')
      .delete()
      .eq('bot_id', botId);
    
    if (deleteError) {
      console.error('Error clearing product catalog:', deleteError);
      throw deleteError;
    }
    return;
  }

  // Set botId on all products
  const productsWithBotId = products.map(p => ({
    ...p,
    botId: botId,
  }));

  // Prepare products for upsert
  const productsToUpsert = productsWithBotId.map(p => ({
    bot_id: p.botId,
    product_id: p.productId,
    name: p.name,
    description: p.description || null,
    price: p.price || null,
    currency: p.currency || 'USD',
    image_url: p.imageUrl || null,
    product_url: p.productUrl,
    category: p.category || null,
    keywords: p.keywords || [],
    in_stock: p.inStock !== false,
    last_updated: new Date().toISOString(),
  }));

  // Get list of product IDs from the feed
  const feedProductIds = productsWithBotId.map(p => p.productId);

  // Delete products that are no longer in the feed
  // First, get all existing product IDs for this bot
  const { data: existingProducts, error: fetchError } = await supabase
    .from('product_catalog')
    .select('product_id')
    .eq('bot_id', botId);

  if (fetchError) {
    console.warn('Warning: Could not fetch existing products:', fetchError);
  } else if (existingProducts) {
    // Find products that exist in DB but not in the new feed
    const existingProductIds = existingProducts.map(p => p.product_id);
    const productsToDelete = existingProductIds.filter(id => !feedProductIds.includes(id));

    if (productsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('product_catalog')
        .delete()
        .eq('bot_id', botId)
        .in('product_id', productsToDelete);

      if (deleteError) {
        console.warn('Warning: Could not delete old products:', deleteError);
        // Continue anyway - we'll still upsert the new products
      }
    }
  }

  // Upsert products (update if exists, insert if not)
  // Use the unique constraint on (bot_id, product_id)
  const { error } = await supabase
    .from('product_catalog')
    .upsert(productsToUpsert, {
      onConflict: 'bot_id,product_id',
      ignoreDuplicates: false,
    });

  if (error) {
    console.error('Error updating product catalog:', error);
    throw error;
  }
}

