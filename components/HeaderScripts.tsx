import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * HeaderScripts Component
 * Loads and injects custom header scripts from site settings into the document head
 */
const HeaderScripts: React.FC = () => {
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

        const headerScripts = data?.value?.header_scripts || '';
        
        if (!headerScripts || typeof headerScripts !== 'string' || headerScripts.trim() === '') {
          return;
        }

        // Create a temporary container to parse the HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = headerScripts;

        // Process all elements
        const allElements = Array.from(tempDiv.children);
        
        allElements.forEach((element) => {
          const tagName = element.tagName.toLowerCase();
          
          if (tagName === 'script') {
            const script = document.createElement('script');
            
            // Copy all attributes
            Array.from(element.attributes).forEach((attr) => {
              script.setAttribute(attr.name, attr.value);
            });
            
            // Copy inner text/content
            if (element.textContent) {
              script.textContent = element.textContent;
            }
            
            // Handle async and defer attributes
            if (element.hasAttribute('async')) {
              script.async = true;
            }
            if (element.hasAttribute('defer')) {
              script.defer = true;
            }
            
            document.head.appendChild(script);
            scriptElements.push(script);
          } else if (tagName === 'link') {
            const link = document.createElement('link');
            
            // Copy all attributes
            Array.from(element.attributes).forEach((attr) => {
              link.setAttribute(attr.name, attr.value);
            });
            
            document.head.appendChild(link);
            styleElements.push(link);
          } else if (tagName === 'style') {
            const style = document.createElement('style');
            
            // Copy all attributes
            Array.from(element.attributes).forEach((attr) => {
              style.setAttribute(attr.name, attr.value);
            });
            
            // Copy inner text/content
            if (element.textContent) {
              style.textContent = element.textContent;
            }
            
            document.head.appendChild(style);
            otherElements.push(style);
          } else {
            // For other elements (meta, noscript, etc.), clone and append
            const cloned = element.cloneNode(true) as HTMLElement;
            document.head.appendChild(cloned);
            otherElements.push(cloned);
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
  }, []);

  return null; // This component doesn't render anything
};

export default HeaderScripts;

