import { Product } from '../types';
import { supabase } from '../lib/supabase';

/**
 * Parse XML product feed from URL
 * Supports common formats: RSS, Google Shopping, and custom XML structures
 */
export async function parseXMLFeed(url: string): Promise<Product[]> {
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
    // 1. RSS format (rss > channel > item)
    const rssItems = xmlDoc.querySelectorAll('rss > channel > item, channel > item, item');
    if (rssItems.length > 0) {
      rssItems.forEach((item) => {
        const product = parseRSSItem(item);
        if (product) products.push(product);
      });
      return products;
    }

    // 2. Google Shopping format (rss > channel > item with g: namespace)
    const googleItems = xmlDoc.querySelectorAll('rss > channel > item');
    if (googleItems.length > 0) {
      googleItems.forEach((item) => {
        const product = parseGoogleShoppingItem(item);
        if (product) products.push(product);
      });
      if (products.length > 0) return products;
    }

    // 3. Custom XML format (products > product or root > product)
    const customProducts = xmlDoc.querySelectorAll('product, products > product, root > product');
    if (customProducts.length > 0) {
      customProducts.forEach((productEl) => {
        const product = parseCustomProduct(productEl);
        if (product) products.push(product);
      });
      return products;
    }

    // 4. Try generic structure (any element with common product fields)
    const allItems = xmlDoc.querySelectorAll('item, entry, product');
    allItems.forEach((item) => {
      const product = parseGenericItem(item);
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
function parseRSSItem(item: Element): Product | null {
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
  const priceMatch = description.match(/\$?([\d,]+\.?\d*)/);
  const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : undefined;

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
function parseGoogleShoppingItem(item: Element): Product | null {
  const getText = (selector: string) => {
    const el = item.querySelector(selector);
    return el?.textContent?.trim() || '';
  };

  // Google Shopping uses g: namespace
  const title = getText('title') || getText('g\\:title');
  const link = getText('link') || getText('g\\:link');
  if (!title || !link) return null;

  const description = getText('description') || getText('g\\:description');
  const id = getText('g\\:id') || link;
  const priceText = getText('g\\:price');
  
  // Extract currency code (3 uppercase letters, typically at the start)
  // Examples: "KES 13995.0", "USD 99.99", "EUR 50.00"
  let currency = 'USD';
  let price: number | undefined = undefined;
  
  if (priceText) {
    // Try to match currency code at the start (e.g., "KES", "USD", "EUR")
    const currencyMatch = priceText.match(/^([A-Z]{3})\s/);
    if (currencyMatch) {
      currency = currencyMatch[1];
    } else {
      // Fallback: look for any 3 uppercase letters (might be in middle)
      const fallbackCurrency = priceText.match(/\b([A-Z]{3})\b/);
      if (fallbackCurrency) {
        currency = fallbackCurrency[1];
      }
    }
    
    // Extract numeric price value (remove all non-digit/non-decimal characters)
    const numericValue = priceText.replace(/[^\d.]/g, '');
    price = numericValue ? parseFloat(numericValue) : undefined;
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
function parseCustomProduct(productEl: Element): Product | null {
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
function parseGenericItem(item: Element): Product | null {
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
  let currency = 'USD';
  let price: number | undefined = undefined;
  
  if (priceText) {
    // Check if price text contains currency code (e.g., "KES 13995.0")
    const currencyMatch = priceText.match(/^([A-Z]{3})\s/);
    if (currencyMatch) {
      currency = currencyMatch[1];
    } else {
      // Fallback: look for currency code anywhere in the string
      const fallbackCurrency = priceText.match(/\b([A-Z]{3})\b/);
      if (fallbackCurrency && !priceText.match(/^\d/)) {
        // Only use if it's not at the start of a number
        currency = fallbackCurrency[1];
      }
    }
    
    // Extract numeric value
    const numericValue = priceText.replace(/[^\d.]/g, '');
    price = numericValue ? parseFloat(numericValue) : undefined;
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

