import { useEffect } from 'react';

const FALLBACK_SITE = 'https://www.shoovainitiative.com';

const siteOrigin = () => {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL as string | undefined;
  if (configured) return configured.replace(/\/$/, '');
  return window.location.origin || FALLBACK_SITE;
};

const setMeta = (key: string, content: string, attr: 'name' | 'property' = 'name') => {
  let tag = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

const setCanonical = (href: string) => {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = href;
};

export type PageMeta = {
  title: string;
  description?: string;
  path?: string;
  image?: string;
  noindex?: boolean;
};

export function usePageMeta({ title, description, path, image, noindex }: PageMeta) {
  useEffect(() => {
    const origin = siteOrigin();
    const url = `${origin}${path ?? window.location.pathname}`;
    const artwork = image ? `${origin}${image}` : `${origin}/icons/icon-512.png`;

    document.title = `${title} | Shoova Programs`;
    if (description) {
      setMeta('description', description);
      setMeta('og:description', description, 'property');
      setMeta('twitter:description', description);
    }
    setMeta('og:title', title, 'property');
    setMeta('og:type', 'website', 'property');
    setMeta('og:url', url, 'property');
    setMeta('og:site_name', 'Shoova Initiative', 'property');
    setMeta('og:image', artwork, 'property');
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', title);
    setMeta('twitter:image', artwork);
    setMeta('robots', noindex ? 'noindex, nofollow' : 'index, follow');
    setCanonical(url);
  }, [title, description, path, image, noindex]);
}
