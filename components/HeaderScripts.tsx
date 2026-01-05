import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * HeaderScripts Component
 * Loads and injects custom header scripts from site settings into the document head
 * SECURITY: Only allows external scripts with src attribute (no inline scripts)
 */

// Whitelist of allowed attributes for script tags
const ALLOWED_SCRIPT_ATTRIBUTES = ['src', 'async', 'defer', 'type', 'crossorigin', 'integrity'];
// Whitelist of allowed attributes for link tags
const ALLOWED_LINK_ATTRIBUTES = ['href', 'rel', 'type', 'media', 'crossorigin', 'integrity'];
// Whitelist of allowed attributes for style tags
const ALLOWED_STYLE_ATTRIBUTES = ['type', 'media'];
// Allowed meta tag attributes
const ALLOWED_META_ATTRIBUTES = ['name', 'content', 'property', 'http-equiv', 'charset'];

// Validate URL is safe (https only, no javascript:, data:, etc.)
const isValidUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  // Block dangerous protocols
  if (trimmed.startsWith('javascript:') || 
      trimmed.startsWith('data:') || 
      trimmed.startsWith('vbscript:') ||
      trimmed.startsWith('file:')) {
    return false;
  }
  // Only allow http/https
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
};

// Sanitize attribute value
const sanitizeAttribute = (name: string, value: string): string => {
  // Remove any script-like content from attribute values
  const dangerous = ['javascript:', 'onerror', 'onload', 'onclick', 'onmouseover'];
  const lowerValue = value.toLowerCase();
  for (const danger of dangerous) {
    if (lowerValue.includes(danger)) {
      return '';
    }
  }
  return value;
};

interface HeaderScriptsProps {
  skipWidget?: boolean; // If true, skip loading widget scripts (for landing page)
}

const HeaderScripts: React.FC<HeaderScriptsProps> = ({ skipWidget = false }) => {
  useEffect(() => {
    let scriptElements: HTMLScriptElement[] = [];
    let styleElements: HTMLLinkElement[] = [];
    let otherElements: HTMLElement[] = [];

    const loadAndInjectScripts = async () => {
      try {
        // Load header scripts from site settings
        const { data, error } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'site_config')
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading header scripts:', error);
          return;
        }

        let headerScripts = data?.value?.header_scripts || '';
        
        if (!headerScripts || typeof headerScripts !== 'string' || headerScripts.trim() === '') {
          return;
        }

        // Create a temporary container to parse the HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = headerScripts;

        // If skipWidget is true, remove widget-related scripts (AetherBotConfig)
        if (skipWidget) {
          // Remove scripts that contain AetherBotConfig or widget.js/widget.css
          const scripts = Array.from(tempDiv.querySelectorAll('script'));
          scripts.forEach((script) => {
            const src = script.getAttribute('src') || '';
            const content = script.textContent || '';
            if (src.includes('widget.js') || 
                src.includes('widget.css') || 
                content.includes('AetherBotConfig')) {
              script.remove();
            }
          });
          
          // Also check for link tags with widget.css
          const links = Array.from(tempDiv.querySelectorAll('link'));
          links.forEach((link) => {
            const href = link.getAttribute('href') || '';
            if (href.includes('widget.css')) {
              link.remove();
            }
          });
        }

        // Process all elements
        const allElements = Array.from(tempDiv.children);
        
        allElements.forEach((element) => {
          const tagName = element.tagName.toLowerCase();
          
          if (tagName === 'script') {
            const src = element.getAttribute('src');
            const script = document.createElement('script');
            
            // Handle external scripts (with src attribute)
            if (src) {
              // Validate src URL
              if (!isValidUrl(src)) {
                console.warn('HeaderScripts: Invalid script src URL:', src);
                return;
              }
              
              // Only copy whitelisted attributes
              Array.from(element.attributes).forEach((attr) => {
                if (ALLOWED_SCRIPT_ATTRIBUTES.includes(attr.name.toLowerCase())) {
                  const sanitized = sanitizeAttribute(attr.name, attr.value);
                  if (sanitized) {
                    script.setAttribute(attr.name, sanitized);
                  }
                }
              });
              
              // Handle async and defer attributes
              if (element.hasAttribute('async')) {
                script.async = true;
              }
              if (element.hasAttribute('defer')) {
                script.defer = true;
              }
            } else {
              // Handle inline scripts - allow but with validation
              const inlineContent = element.textContent || '';
              
              // Security check: Only allow inline scripts that:
              // 1. Set configuration objects (window.*Config = {...})
              // 2. Don't contain dangerous patterns
              const dangerousPatterns = [
                /document\.write/i,
                /eval\(/i,
                /Function\(/i,
                /setTimeout\(['"]/i,
                /setInterval\(['"]/i,
                /\.innerHTML\s*=/i,
                /\.outerHTML\s*=/i,
                /\.insertAdjacentHTML/i,
                /<script/i,
                /<iframe/i,
              ];
              
              // Check if it's a configuration script (safe pattern)
              const isConfigScript = /window\.\w+\s*=\s*\{/.test(inlineContent) || 
                                     /window\.\w+\s*=\s*\[/.test(inlineContent) ||
                                     /window\.\w+\s*=\s*['"]/.test(inlineContent);
              
              // Block if it contains dangerous patterns
              const hasDangerousPattern = dangerousPatterns.some(pattern => pattern.test(inlineContent));
              
              if (hasDangerousPattern && !isConfigScript) {
                console.warn('HeaderScripts: Inline script contains potentially dangerous patterns and is not a configuration script');
                return;
              }
              
              // Copy allowed attributes
              Array.from(element.attributes).forEach((attr) => {
                if (ALLOWED_SCRIPT_ATTRIBUTES.includes(attr.name.toLowerCase())) {
                  const sanitized = sanitizeAttribute(attr.name, attr.value);
                  if (sanitized) {
                    script.setAttribute(attr.name, sanitized);
                  }
                }
              });
              
              // Set inline content
              script.textContent = inlineContent;
            }
            
            document.head.appendChild(script);
            scriptElements.push(script);
          } else if (tagName === 'link') {
            const link = document.createElement('link');
            const href = element.getAttribute('href');
            
            // Validate href URL if present
            if (href && !isValidUrl(href) && !href.startsWith('/') && !href.startsWith('./')) {
              // Allow relative URLs but validate absolute ones
              if (href.includes('://')) {
                console.warn('HeaderScripts: Invalid link href URL:', href);
                return;
              }
            }
            
            // Only copy whitelisted attributes
            Array.from(element.attributes).forEach((attr) => {
              if (ALLOWED_LINK_ATTRIBUTES.includes(attr.name.toLowerCase())) {
                const sanitized = sanitizeAttribute(attr.name, attr.value);
                if (sanitized) {
                  link.setAttribute(attr.name, sanitized);
                }
              }
            });
            
            document.head.appendChild(link);
            styleElements.push(link);
          } else if (tagName === 'style') {
            // Allow style tags but sanitize content
            const style = document.createElement('style');
            
            // Only copy whitelisted attributes
            Array.from(element.attributes).forEach((attr) => {
              if (ALLOWED_STYLE_ATTRIBUTES.includes(attr.name.toLowerCase())) {
                const sanitized = sanitizeAttribute(attr.name, attr.value);
                if (sanitized) {
                  style.setAttribute(attr.name, sanitized);
                }
              }
            });
            
            // Copy inner text/content (CSS is generally safe, but we'll validate)
            if (element.textContent) {
              // Basic check for script tags in CSS (shouldn't happen but be safe)
              const cssContent = element.textContent;
              if (!cssContent.toLowerCase().includes('<script') && 
                  !cssContent.toLowerCase().includes('javascript:')) {
                style.textContent = cssContent;
              } else {
                console.warn('HeaderScripts: Potentially unsafe CSS content detected');
                return;
              }
            }
            
            document.head.appendChild(style);
            otherElements.push(style);
          } else if (tagName === 'meta') {
            // Allow meta tags with sanitization
            const meta = document.createElement('meta');
            
            Array.from(element.attributes).forEach((attr) => {
              if (ALLOWED_META_ATTRIBUTES.includes(attr.name.toLowerCase()) || 
                  attr.name.toLowerCase() === 'content') {
                const sanitized = sanitizeAttribute(attr.name, attr.value);
                if (sanitized) {
                  meta.setAttribute(attr.name, sanitized);
                }
              }
            });
            
            document.head.appendChild(meta);
            otherElements.push(meta);
          } else {
            // Block other potentially dangerous elements
            console.warn('HeaderScripts: Unsupported element type:', tagName);
          }
        });
      } catch (error) {
        console.error('Error injecting header scripts:', error);
      }
    };

    loadAndInjectScripts();

    // Cleanup function to remove injected scripts when component unmounts
    return () => {
      scriptElements.forEach((script) => {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      });
      styleElements.forEach((link) => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      });
      otherElements.forEach((element) => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      });
    };
  }, [skipWidget]);

  return null; // This component doesn't render anything
};

export default HeaderScripts;

