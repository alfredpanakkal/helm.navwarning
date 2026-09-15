export interface ScraperSource {
  id: string;
  url: string;
  navarea: string;
  type: 'html' | 'json';
}

export const sources: ScraperSource[] = [
  {
    id: 'placeholder-html-source',
    url: 'https://example.com/navwarns.html',
    navarea: 'I',
    type: 'html',
  },
  {
    id: 'placeholder-json-source',
    url: 'https://example.com/api/warnings',
    navarea: 'IV',
    type: 'json',
  }
];
