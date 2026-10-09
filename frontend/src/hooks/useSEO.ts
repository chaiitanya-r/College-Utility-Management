import { useEffect } from 'react';
import {
  BASE_URL,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
} from '@/config/seo';

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  noIndex?: boolean;
}

function setMeta(name: string, content: string, property = false) {
  if (!content) return;
  const attr = property ? 'property' : 'name';
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href: string) {
  if (!href) return;
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function useSEO({
  title,
  description,
  canonical,
  ogTitle,
  ogDescription,
  ogImage,
  ogType = 'website',
  noIndex = false,
}: SEOProps = {}) {
  useEffect(() => {
    const resolvedTitle = title ? `${title} | College Utility Management` : DEFAULT_TITLE;
    const resolvedDescription = description || DEFAULT_DESCRIPTION;
    const resolvedOgTitle = ogTitle || resolvedTitle;
    const resolvedOgDescription = ogDescription || resolvedDescription;
    const resolvedOgImage = ogImage || DEFAULT_OG_IMAGE;
    const resolvedCanonical = canonical ?? BASE_URL;

    document.title = resolvedTitle;

    setMeta('description', resolvedDescription);
    setMeta('robots', noIndex ? 'noindex, nofollow' : 'index, follow');

    setMeta('og:type', ogType, true);
    setMeta('og:title', resolvedOgTitle, true);
    setMeta('og:description', resolvedOgDescription, true);
    setMeta('og:image', resolvedOgImage, true);
    setMeta('og:url', resolvedCanonical, true);

    setMeta('twitter:title', resolvedOgTitle);
    setMeta('twitter:description', resolvedOgDescription);
    setMeta('twitter:image', resolvedOgImage);

    setCanonical(resolvedCanonical);
  }, [title, description, canonical, ogTitle, ogDescription, ogImage, ogType, noIndex]);
}

export default useSEO;
