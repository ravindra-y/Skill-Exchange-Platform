const fs = require('fs');
const path = require('path');

class EscoService {
  constructor() {
    this.skills = [];
    this.canonicalMap = new Map();
    this.initialized = false;
    this.init();
  }

  init() {
    try {
      const indexPath = path.join(__dirname, '../data/esco_skills_index.json');
      if (fs.existsSync(indexPath)) {
        const raw = fs.readFileSync(indexPath, 'utf8');
        this.skills = JSON.parse(raw);
        
        // Build fast lookup by canonical name (lowercase)
        for (const skill of this.skills) {
          const key = (skill.canonicalName || skill.name).toLowerCase();
          this.canonicalMap.set(key, skill);
          
          // Also map aliases to canonical skill
          if (Array.isArray(skill.aliases)) {
            for (const alias of skill.aliases) {
              const aliasKey = alias.toLowerCase().trim();
              if (!this.canonicalMap.has(aliasKey)) {
                this.canonicalMap.set(aliasKey, skill);
              }
            }
          }
        }
        
        this.initialized = true;
        console.log(`[EscoService] Successfully loaded ${this.skills.length} ESCO skills.`);
      } else {
        console.warn('[EscoService] Index file not found at', indexPath);
      }
    } catch (err) {
      console.error('[EscoService] Error loading ESCO index:', err.message);
    }
  }

  // Levenshtein distance for fuzzy matching
  levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];
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
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Search skills with prefix, partial, alias, and fuzzy matching.
   * Ensures duplicate canonical skills are normalized and only returned once.
   */
  async search(query, limit = 8) {
    if (!query || typeof query !== 'string') return [];
    const q = query.trim().toLowerCase();
    if (q.length === 0) return [];

    const scored = new Map(); // canonicalName.toLowerCase() -> item with score

    for (const s of this.skills) {
      const canonicalKey = (s.canonicalName || s.name).toLowerCase();
      const nameLower = s.name.toLowerCase();
      let score = 0;
      let matchedAlias = null;

      // 1. Exact match on canonical name
      if (nameLower === q) {
        score = 1000;
      }
      // 2. Prefix match on canonical name
      else if (nameLower.startsWith(q)) {
        score = 800 - Math.min(100, (nameLower.length - q.length) * 2);
      }
      // 3. Word boundary match on canonical name (e.g. "machine" in "Machine Learning")
      else if (nameLower.includes(' ' + q) || nameLower.includes('-' + q) || nameLower.includes('/' + q) || nameLower.includes('(' + q)) {
        score = 650 - Math.min(100, (nameLower.length - q.length));
      } else {
        // 4. Check aliases
        if (Array.isArray(s.aliases)) {
          for (const alias of s.aliases) {
            const aLower = alias.toLowerCase().trim();
            if (aLower === q) {
              score = Math.max(score, 750);
              matchedAlias = alias;
              break;
            } else if (aLower.startsWith(q)) {
              const sAlias = 600 - Math.min(100, (aLower.length - q.length) * 2);
              if (sAlias > score) {
                score = sAlias;
                matchedAlias = alias;
              }
            } else if (aLower.includes(' ' + q) || aLower.includes('-' + q) || aLower.includes('/' + q)) {
              const sAlias = 450 - Math.min(100, (aLower.length - q.length));
              if (sAlias > score) {
                score = sAlias;
                matchedAlias = alias;
              }
            }
          }
        }
      }

      // 5. General substring match
      if (score === 0 && nameLower.includes(q)) {
        score = 300 - Math.min(100, (nameLower.length - q.length));
      }

      // 6. Fuzzy match for queries of length >= 4 if still no match
      if (score === 0 && q.length >= 4) {
        // Check prefix distance
        const namePrefix = nameLower.slice(0, q.length + 1);
        const dist = this.levenshteinDistance(q, namePrefix);
        if (dist <= 1) {
          score = 150 - dist * 30;
        } else if (q.length >= 6 && dist <= 2) {
          score = 100 - dist * 25;
        }
      }

      if (score > 0) {
        // Prioritize curated/tech industry skills
        if (s.isCurated) {
          score += 120;
        }

        const existing = scored.get(canonicalKey);
        if (!existing || score > existing.score) {
          scored.set(canonicalKey, {
            id: s.id,
            name: s.name,
            canonicalName: s.canonicalName || s.name,
            category: s.category || 'General',
            description: s.description || '',
            matchedAlias: matchedAlias && matchedAlias.toLowerCase() !== s.name.toLowerCase() ? matchedAlias : null,
            score
          });
        }
      }
    }

    let results = Array.from(scored.values());
    results.sort((a, b) => b.score - a.score);

    // If local results are empty or (fewer than 3 and no exact match) and length >= 3, attempt remote ESCO suggest2 API fallback
    const hasExactMatch = results.some(r => r.name.toLowerCase() === q);
    if (!hasExactMatch && results.length < 3 && q.length >= 3) {
      try {
        const remoteResults = await this.queryRemoteEsco(q);
        for (const rem of remoteResults) {
          const key = rem.name.toLowerCase();
          if (!scored.has(key)) {
            scored.set(key, rem);
          }
        }
        results = Array.from(scored.values());
        results.sort((a, b) => b.score - a.score);
      } catch (err) {
        // Log error and gracefully continue with local results
        console.warn('[EscoService] Remote ESCO API fallback failed:', err.message);
      }
    }

    // Clean up result object for frontend (remove internal score)
    return results.slice(0, limit).map(({ score, ...rest }) => rest);
  }

  /**
   * Fallback query to live ESCO API if needed.
   * Includes 2-second timeout and robust error handling.
   */
  async queryRemoteEsco(query) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    try {
      const url = `https://ec.europa.eu/esco/api/suggest2?text=${encodeURIComponent(query)}&language=en&type=skill&limit=5&alt=true`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const items = data._embedded?.results || [];

      return items.map(item => {
        // Strip trailing qualifiers like "(computer programming)" for cleaner name
        let cleanName = item.title;
        const m = cleanName.match(/^(.+?)\s*\((computer programming|programming language|software)\)$/i);
        if (m) cleanName = m[1].trim();

        return {
          id: item.uri || item._links?.self?.uri,
          name: cleanName,
          canonicalName: cleanName,
          category: 'ESCO Skill',
          description: '',
          matchedAlias: item.searchHit && item.searchHit.toLowerCase() !== cleanName.toLowerCase() ? item.searchHit : null,
          score: 250
        };
      });
    } catch (err) {
      clearTimeout(timeoutId);
      return [];
    }
  }

  /**
   * Resolve any skill name or alias to its canonical representation.
   */
  getCanonical(name) {
    if (!name) return null;
    const key = name.trim().toLowerCase();
    return this.canonicalMap.get(key) || null;
  }
}

module.exports = new EscoService();
