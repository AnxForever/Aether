/**
 * Semantic Search - Vector-based intelligent search
 */

import { createLogger } from '../utils/logger';
import Database from 'better-sqlite3';
import { EventEmitter } from 'events';

const logger = createLogger('SemanticSearch');

/**
 * Search result
 */
export interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, any>;
  score: number;
  highlights?: string[];
}

/**
 * Search index entry
 */
interface IndexEntry {
  id: string;
  content: string;
  embedding: number[];
  metadata: string;
  timestamp: number;
}

/**
 * Search query
 */
export interface SearchQuery {
  text: string;
  filters?: Record<string, any>;
  limit?: number;
  threshold?: number;
}

/**
 * Semantic Search Engine
 */
export class SemanticSearch extends EventEmitter {
  private db: Database.Database;
  private embeddingDimension = 384; // all-MiniLM-L6-v2 dimension

  constructor(dbPath: string) {
    super();
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  /**
   * Initialize database tables
   */
  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS search_index (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        embedding BLOB NOT NULL,
        metadata TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        results INTEGER NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_search_timestamp ON search_index(timestamp);
      CREATE INDEX IF NOT EXISTS idx_history_timestamp ON search_history(timestamp);

      CREATE VIRTUAL TABLE IF NOT EXISTS fts_index USING fts5(
        id UNINDEXED,
        content,
        metadata
      );
    `);

    logger.info('Search index initialized');
  }

  /**
   * Index content for semantic search
   */
  async index(id: string, content: string, metadata: Record<string, any> = {}): Promise<void> {
    try {
      // Generate embedding (simplified - in production, use actual embedding model)
      const embedding = await this.generateEmbedding(content);

      // Store in vector index
      this.db
        .prepare(
          `INSERT OR REPLACE INTO search_index (id, content, embedding, metadata, timestamp)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(id, content, Buffer.from(new Float32Array(embedding).buffer), JSON.stringify(metadata), Date.now());

      // Store in full-text index
      this.db
        .prepare(
          `INSERT OR REPLACE INTO fts_index (id, content, metadata)
           VALUES (?, ?, ?)`
        )
        .run(id, content, JSON.stringify(metadata));

      logger.debug(`Indexed content: ${id}`);
      this.emit('content-indexed', { id, content: content.substring(0, 100) });
    } catch (error: any) {
      logger.error(`Failed to index content: ${id}`, error as Error);
      throw error;
    }
  }

  /**
   * Search using semantic similarity
   *
   * ⚠️ PERFORMANCE WARNING:
   * This implementation performs O(n) full table scan and calculates similarity
   * for every entry in memory. This will be VERY SLOW for large datasets (>10k entries).
   *
   * For production use with large datasets, implement:
   * 1. Approximate Nearest Neighbor (ANN) index (FAISS, Annoy, HNSW)
   * 2. Pre-filtering before similarity calculation
   * 3. Batch processing for large result sets
   * 4. Use a dedicated vector database
   */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query.text);

      // ⚠️ WARNING: Full table scan - slow for large datasets!
      // In production, use ANN index like FAISS or Annoy
      const entries = this.db.prepare('SELECT * FROM search_index').all() as any[];

      // Calculate cosine similarity
      const results: SearchResult[] = [];

      for (const entry of entries) {
        const embedding = this.bufferToArray(entry.embedding);
        const similarity = this.cosineSimilarity(queryEmbedding, embedding);

        // Apply threshold
        if (similarity >= (query.threshold || 0.5)) {
          const metadata = JSON.parse(entry.metadata);

          // Apply filters
          if (query.filters && !this.matchesFilters(metadata, query.filters)) {
            continue;
          }

          results.push({
            id: entry.id,
            content: entry.content,
            metadata,
            score: similarity,
            highlights: this.extractHighlights(entry.content, query.text)
          });
        }
      }

      // Sort by score
      results.sort((a, b) => b.score - a.score);

      // Limit results
      const limited = results.slice(0, query.limit || 10);

      // Record search history
      this.recordSearch(query.text, limited.length);

      const duration = Date.now() - startTime;
      logger.info(`Search completed: "${query.text}" (${limited.length} results in ${duration}ms)`);

      return limited;
    } catch (error: any) {
      logger.error('Search failed:', error as Error);
      throw error;
    }
  }

  /**
   * Full-text search
   */
  async fullTextSearch(query: string, limit: number = 10): Promise<SearchResult[]> {
    try {
      const rows = this.db
        .prepare(
          `SELECT id, content, metadata, rank
           FROM fts_index
           WHERE fts_index MATCH ?
           ORDER BY rank
           LIMIT ?`
        )
        .all(query, limit) as any[];

      const results: SearchResult[] = rows.map(row => ({
        id: row.id,
        content: row.content,
        metadata: JSON.parse(row.metadata),
        score: -row.rank, // FTS5 rank is negative
        highlights: this.extractHighlights(row.content, query)
      }));

      logger.info(`Full-text search: "${query}" (${results.length} results)`);

      return results;
    } catch (error: any) {
      logger.error('Full-text search failed:', error as Error);
      return [];
    }
  }

  /**
   * Fuzzy search
   */
  async fuzzySearch(query: string, maxDistance: number = 2, limit: number = 10): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    const entries = this.db.prepare('SELECT * FROM search_index').all() as any[];

    for (const entry of entries) {
      const distance = this.levenshteinDistance(query.toLowerCase(), entry.content.toLowerCase().substring(0, query.length * 2));

      if (distance <= maxDistance) {
        results.push({
          id: entry.id,
          content: entry.content,
          metadata: JSON.parse(entry.metadata),
          score: 1 - distance / query.length,
          highlights: [entry.content.substring(0, 100)]
        });
      }
    }

    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  /**
   * Regex search
   */
  async regexSearch(pattern: string, limit: number = 10): Promise<SearchResult[]> {
    try {
      const regex = new RegExp(pattern, 'i');
      const results: SearchResult[] = [];

      const entries = this.db.prepare('SELECT * FROM search_index').all() as any[];

      for (const entry of entries) {
        const matches = entry.content.match(regex);

        if (matches) {
          results.push({
            id: entry.id,
            content: entry.content,
            metadata: JSON.parse(entry.metadata),
            score: matches.length,
            highlights: matches.slice(0, 3)
          });
        }
      }

      results.sort((a, b) => b.score - a.score);

      logger.info(`Regex search: "${pattern}" (${results.length} results)`);

      return results.slice(0, limit);
    } catch (error: any) {
      logger.error('Regex search failed:', error as Error);
      return [];
    }
  }

  /**
   * Get search suggestions
   */
  async getSuggestions(prefix: string, limit: number = 5): Promise<string[]> {
    const rows = this.db
      .prepare(
        `SELECT DISTINCT query FROM search_history
         WHERE query LIKE ?
         ORDER BY timestamp DESC
         LIMIT ?`
      )
      .all(`${prefix}%`, limit) as { query: string }[];

    return rows.map(row => row.query);
  }

  /**
   * Get search history
   */
  getSearchHistory(limit: number = 20): Array<{ query: string; results: number; timestamp: number }> {
    return this.db
      .prepare(
        `SELECT query, results, timestamp FROM search_history
         ORDER BY timestamp DESC
         LIMIT ?`
      )
      .all(limit) as any[];
  }

  /**
   * Clear search history
   */
  clearHistory(): void {
    this.db.prepare('DELETE FROM search_history').run();
    logger.info('Search history cleared');
  }

  /**
   * Remove from index
   */
  remove(id: string): void {
    this.db.prepare('DELETE FROM search_index WHERE id = ?').run(id);
    this.db.prepare('DELETE FROM fts_index WHERE id = ?').run(id);
    logger.debug(`Removed from index: ${id}`);
  }

  /**
   * Clear entire index
   */
  clearIndex(): void {
    this.db.prepare('DELETE FROM search_index').run();
    this.db.prepare('DELETE FROM fts_index').run();
    logger.info('Search index cleared');
  }

  /**
   * Get index statistics
   */
  getStats(): {
    totalEntries: number;
    totalSearches: number;
    averageResultCount: number;
  } {
    const totalEntries = (this.db.prepare('SELECT COUNT(*) as count FROM search_index').get() as any).count;

    const searchStats = this.db
      .prepare(
        `SELECT COUNT(*) as count, AVG(results) as avgResults
         FROM search_history`
      )
      .get() as any;

    return {
      totalEntries,
      totalSearches: searchStats.count || 0,
      averageResultCount: searchStats.avgResults || 0
    };
  }

  /**
   * Generate embedding (SIMPLIFIED - NOT FOR PRODUCTION)
   *
   * ⚠️ WARNING: This is a placeholder implementation!
   *
   * This method uses a simple hash-based approach that does NOT provide
   * real semantic understanding. For production use, you MUST replace this
   * with a proper embedding model such as:
   *
   * - OpenAI Embeddings API (text-embedding-ada-002)
   * - Sentence Transformers (all-MiniLM-L6-v2)
   * - Google Universal Sentence Encoder
   * - Cohere Embed API
   *
   * Additionally, for large datasets, use a vector database like:
   * - FAISS (Facebook AI Similarity Search)
   * - Pinecone
   * - Weaviate
   * - Milvus
   *
   * The current implementation will NOT give meaningful semantic search results!
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // PLACEHOLDER: Simple hash-based approach for demonstration only
    const embedding = new Array(this.embeddingDimension).fill(0);

    // Simple hash-based embedding
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const index = charCode % this.embeddingDimension;
      embedding[index] += Math.sin(charCode * i) * 0.1;
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / (norm || 1));
  }

  /**
   * Calculate cosine similarity
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Levenshtein distance
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Convert buffer to array
   */
  private bufferToArray(buffer: Buffer): number[] {
    const array = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
    return Array.from(array);
  }

  /**
   * Extract highlights
   */
  private extractHighlights(content: string, query: string): string[] {
    const words = query.toLowerCase().split(/\s+/);
    const highlights: string[] = [];

    for (const word of words) {
      const index = content.toLowerCase().indexOf(word);
      if (index !== -1) {
        const start = Math.max(0, index - 50);
        const end = Math.min(content.length, index + word.length + 50);
        highlights.push('...' + content.substring(start, end) + '...');
      }
    }

    return highlights.slice(0, 3);
  }

  /**
   * Check if metadata matches filters
   */
  private matchesFilters(metadata: Record<string, any>, filters: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filters)) {
      if (metadata[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Record search in history
   */
  private recordSearch(query: string, resultCount: number): void {
    this.db
      .prepare(
        `INSERT INTO search_history (query, results, timestamp)
         VALUES (?, ?, ?)`
      )
      .run(query, resultCount, Date.now());
  }
}
