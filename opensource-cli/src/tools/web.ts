// ============================================================================
// OpenSource CLI - Web Tools
// Web search and URL fetching
// ============================================================================

import type { ToolRegistry } from './registry.js';

export function registerWebTools(registry: ToolRegistry): void {
  // ---- web_search ----
  registry.register({
    name: 'web_search',
    description: 'Search the web for information. Returns search results with titles, URLs, and snippets.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        numResults: { type: 'number', description: 'Number of results to return', default: 8 },
      },
      required: ['query'],
    },
    handler: async (args) => {
      const query = args.query as string;
      const numResults = (args.numResults as number) || 8;

      try {
        // Use a simple web search approach
        const response = await fetch(
          `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
          {
            headers: { 'User-Agent': 'OpenSource CLI Agent/1.0' },
          }
        );
        const html = await response.text();

        // Parse results (simple extraction)
        const results: string[] = [];
        const titleRegex = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
        const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([^<]+(?:<[^>]+>[^<]*<\/a>[^<]*)*)/g;

        let titleMatch;
        let count = 0;
        while ((titleMatch = titleRegex.exec(html)) !== null && count < numResults) {
          const url = titleMatch[1];
          const title = titleMatch[2].replace(/<[^>]+>/g, '');
          results.push(`${count + 1}. ${title}\n   URL: ${url}`);
          count++;
        }

        return {
          toolCallId: '',
          content: results.length > 0
            ? `Search results for "${query}":\n\n${results.join('\n\n')}`
            : `No results found for "${query}"`,
        };
      } catch (error) {
        return {
          toolCallId: '',
          content: `Web search error: ${error instanceof Error ? error.message : String(error)}`,
          isError: true,
        };
      }
    },
    category: 'web',
  });

  // ---- fetch_url ----
  registry.register({
    name: 'fetch_url',
    description: 'Fetch and extract content from a URL. Returns the page content in markdown or text format.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
        format: { type: 'string', description: 'Output format: markdown, text, html', default: 'markdown', enum: ['markdown', 'text', 'html'] },
      },
      required: ['url'],
    },
    handler: async (args) => {
      const url = args.url as string;

      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'OpenSource CLI Agent/1.0' },
        });
        const html = await response.text();

        if (args.format === 'html') {
          return { toolCallId: '', content: html.slice(0, 20000) };
        }

        // Simple HTML to text conversion
        let text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\s+/g, ' ')
          .trim();

        return {
          toolCallId: '',
          content: text.slice(0, 20000) + (text.length > 20000 ? '\n... (truncated)' : ''),
        };
      } catch (error) {
        return {
          toolCallId: '',
          content: `Fetch error: ${error instanceof Error ? error.message : String(error)}`,
          isError: true,
        };
      }
    },
    category: 'web',
  });
}
