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
    // Fetch the XML feed
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
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
    
    // Try to match currency code at the start (e.g., "KES 13995.0" or "KES 13995")
    // Pattern: 3 uppercase letters at the start, followed by space(s), then number (with optional decimal and commas)
    // This is the most common format: "KES 13995.0"
    const currencyMatch = priceText.match(/^([A-Z]{3})\s+([\d,]+(?:\.\d+)?)/);
    if (currencyMatch && currencyMatch.length >= 3) {
      currency = currencyMatch[1];
      // Extract numeric value (remove commas, keep decimal point)
      const numericValue = currencyMatch[2].replace(/,/g, '');
      const parsedPrice = parseFloat(numericValue);
      if (!isNaN(parsedPrice) && parsedPrice > 0) {
        price = parsedPrice;
      }
    } else {
      // Fallback: Find ALL currency matches and pick the one with the largest price
      // This handles cases where there might be multiple currency mentions
      // We want the MAIN price, not a small number like "USD 2"
      const allMatches: Array<{currency: string, price: number, index: number}> = [];
      const regex = /\b([A-Z]{3})\s+([\d,]+(?:\.\d+)?)/g;
      let match;
      
      while ((match = regex.exec(priceText)) !== null) {
        const currencyCode = match[1];
        const numericValue = match[2].replace(/,/g, '');
        const parsedPrice = parseFloat(numericValue);
        if (!isNaN(parsedPrice) && parsedPrice > 0) {
          allMatches.push({
            currency: currencyCode,
            price: parsedPrice,
            index: match.index
          });
        }
      }
      
      // If we found multiple matches, prefer the one with the largest price (likely the main price)
      // Also prefer matches closer to the start of the string if prices are similar
      if (allMatches.length > 0) {
        // Sort by price (descending), then by index (ascending)
        allMatches.sort((a, b) => {
          if (Math.abs(b.price - a.price) > 1) {
            return b.price - a.price; // Larger price first (if significantly different)
          }
          return a.index - b.index; // Earlier in string first (if prices are similar)
        });
        
        const bestMatch = allMatches[0];
        currency = bestMatch.currency;
        price = bestMatch.price;
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
  }
  
  const imageUrl = getText('g\\:image_link') || getText('g\\:image');
  const category = getText('g\\:google_product_category') || getText('g\\:product_type') || getText('g\\:category');
  const availability = getText('g\\:availability')?.toLowerCase();
  const inStock = !availability || availability.includes('in stock');

  return {
    id: '',
    botId: '',
    productId: id,
    name: title,
    description,
    price,
    currency,
    imageUrl,
    productUrl: link,
    category,
    keywords: extractKeywords(title, description, category),
    inStock,
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
  if (products.length === 0) return;

  // Prepare products for upsert
  const productsToUpsert = products.map(p => ({
    bot_id: botId,
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

  // Upsert products (update if exists, insert if not)
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

