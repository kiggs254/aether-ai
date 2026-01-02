import { supabase } from '../lib/supabase';
import { Product, ProductSummary, ProductFilters } from '../types';

/**
 * Query products with filters and return lightweight summaries for AI
 */
export async function queryProducts(
  botId: string,
  filters: ProductFilters
): Promise<ProductSummary[]> {
  try {
    let query = supabase
      .from('product_catalog')
      .select('id, product_id, name, price, currency, category')
      .eq('bot_id', botId);

    // Apply filters
    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    if (filters.priceMin !== undefined) {
      query = query.gte('price', filters.priceMin);
    }

    if (filters.priceMax !== undefined) {
      query = query.lte('price', filters.priceMax);
    }

    if (filters.inStock !== undefined) {
      query = query.eq('in_stock', filters.inStock);
    } else {
      // Default to only in-stock products
      query = query.eq('in_stock', true);
    }

    // Keyword search (search in keywords array)
    if (filters.keywords && filters.keywords.length > 0) {
      // Use array overlap operator for keyword matching
      query = query.overlaps('keywords', filters.keywords);
    }

    // Limit results
    const maxResults = filters.maxResults || 50;
    query = query.limit(maxResults);

    const { data, error } = await query;

    if (error) {
      console.error('Error querying products:', error);
      throw error;
    }

    // Map to ProductSummary format
    return (data || []).map((p: any) => ({
      id: p.id,
      productId: p.product_id,
      name: p.name,
      price: p.price ? parseFloat(p.price) : undefined,
      currency: p.currency || 'USD',
      category: p.category || undefined,
    }));
  } catch (error) {
    console.error('Error in queryProducts:', error);
    throw error;
  }
}

/**
 * Get full product details by IDs (for carousel display)
 */
export async function getProductDetails(productIds: string[]): Promise<Product[]> {
  if (productIds.length === 0) return [];

  try {
    const { data, error } = await supabase
      .from('product_catalog')
      .select('*')
      .in('id', productIds);

    if (error) {
      console.error('Error fetching product details:', error);
      throw error;
    }

    return (data || []).map((p: any) => ({
      id: p.id,
      botId: p.bot_id,
      productId: p.product_id,
      name: p.name,
      description: p.description || undefined,
      price: p.price ? parseFloat(p.price) : undefined,
      currency: p.currency || 'USD',
      imageUrl: p.image_url || undefined,
      productUrl: p.product_url,
      category: p.category || undefined,
      keywords: p.keywords || [],
      inStock: p.in_stock !== false,
      lastUpdated: p.last_updated ? new Date(p.last_updated).getTime() : undefined,
    }));
  } catch (error) {
    console.error('Error in getProductDetails:', error);
    throw error;
  }
}

/**
 * Get all products for a bot (for preview/management)
 */
export async function getProductCatalog(botId: string): Promise<Product[]> {
  try {
    const { data, error } = await supabase
      .from('product_catalog')
      .select('*')
      .eq('bot_id', botId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching product catalog:', error);
      throw error;
    }

    return (data || []).map((p: any) => ({
      id: p.id,
      botId: p.bot_id,
      productId: p.product_id,
      name: p.name,
      description: p.description || undefined,
      price: p.price ? parseFloat(p.price) : undefined,
      currency: p.currency || 'USD',
      imageUrl: p.image_url || undefined,
      productUrl: p.product_url,
      category: p.category || undefined,
      keywords: p.keywords || [],
      inStock: p.in_stock !== false,
      lastUpdated: p.last_updated ? new Date(p.last_updated).getTime() : undefined,
    }));
  } catch (error) {
    console.error('Error in getProductCatalog:', error);
    throw error;
  }
}

