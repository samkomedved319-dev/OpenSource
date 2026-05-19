// ============================================================================
// OpenSource CLI - Browser Tool
// Basic browser automation via Puppeteer/Playwright
// ============================================================================

import type { ToolRegistry } from './registry.js';

export function registerBrowserTools(registry: ToolRegistry): void {
  registry.register({
    name: 'browser_navigate',
    description: 'Navigate to a URL and extract page content. Useful for web research and testing.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to navigate to' },
      },
      required: ['url'],
    },
    handler: async (args) => {
      const url = args.url as string;

      try {
        // Try using fetch with a browser-like user agent
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        const html = await response.text();

        // Simple HTML to text
        let text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        return {
          toolCallId: '',
          content: `Page: ${url}\nTitle: ${extractTitle(html)}\n\n${text.slice(0, 15000)}`,
        };
      } catch (error) {
        return {
          toolCallId: '',
          content: `Browser error: ${error instanceof Error ? error.message : String(error)}`,
          isError: true,
        };
      }
    },
    category: 'browser',
    requiresApproval: true,
  });
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : 'Unknown';
}
