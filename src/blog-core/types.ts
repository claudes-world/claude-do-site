export interface NavItem {
  label: string;
  href: string;
}

export interface BrandConfig {
  name: string;
  url: string;
  tagline: string;
  description: string;
  blogDescription: string;
  defaultOgImage: string;
  icon: string;
  publisherLogo: string;
  twitter: string;
  wordmarkHtml: string;
  nav: NavItem[];
  footerHtml: string;
  footerNav: NavItem[];
}

export interface Entity {
  name: string;
  sameAs: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface ArticleData {
  title: string;
  description: string;
  slug: string;
  date: Date;
  updated?: Date;
  author?: string;
  hero?: string;
  og_image?: string;
  entities?: Entity[];
  faq?: FaqItem[];
}
