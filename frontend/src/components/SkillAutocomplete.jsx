import React, { useState, useEffect, useRef } from 'react';
import axios from '../api/axios';
import { Search, Loader2, X, AlertCircle, Check } from 'lucide-react';

const SkillAutocomplete = ({
  onSelectSkill,
  existingSkills = [],
  placeholder = 'Search skills (e.g. Python, React, SQL)...',
  disabled = false,
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search with AbortController
  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 1) {
      setSuggestions([]);
      setIsLoading(false);
      setError('');
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    setIsLoading(true);
    setError('');
    const controller = new AbortController();

    const fetchSuggestions = async () => {
      try {
        const response = await axios.get(`/skills/search?q=${encodeURIComponent(trimmed)}&limit=10`, {
          signal: controller.signal,
        });
        setSuggestions(Array.isArray(response.data) ? response.data : []);
        setIsOpen(true);
        setActiveIndex(-1);
      } catch (err) {
        if (!axios.isCancel(err)) {
          console.error('Skill autocomplete search error:', err);
          setError('Failed to load suggestions. Please try again.');
          setSuggestions([]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchSuggestions, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Scroll active option into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[activeIndex];
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  const handleSelect = (skill) => {
    if (!skill) return;
    onSelectSkill(skill);
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
    setActiveIndex(-1);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          handleSelect(suggestions[activeIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  // Helper to highlight matching text in suggestion
  const highlightMatch = (text, matchQuery) => {
    if (!matchQuery || !text) return text;
    const q = matchQuery.trim().toLowerCase();
    const t = text.toLowerCase();
    const idx = t.indexOf(q);

    if (idx === -1) return text;

    const before = text.slice(0, idx);
    const matched = text.slice(idx, idx + q.length);
    const after = text.slice(idx + q.length);

    return (
      <>
        {before}
        <span className="font-semibold text-brand-text underline decoration-brand-text/30">
          {matched}
        </span>
        {after}
      </>
    );
  };

  // Check if a skill or its canonical name is already in existingSkills
  const isSkillAlreadyAdded = (skill) => {
    if (!existingSkills || existingSkills.length === 0) return false;
    const targetName = (skill.canonicalName || skill.name).toLowerCase();
    return existingSkills.some((s) => {
      const existingName = (s.skillId?.name || s.name || '').toLowerCase();
      return existingName === targetName;
    });
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input container */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-brand-muted" aria-hidden="true" />
        </div>

        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls="skill-autocomplete-list"
          aria-activedescendant={activeIndex >= 0 ? `skill-option-${activeIndex}` : undefined}
          aria-label="Search skills"
          disabled={disabled}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen && e.target.value.trim().length > 0) {
              setIsOpen(true);
            }
          }}
          onFocus={() => {
            if (query.trim().length > 0 && suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="input-field pl-10 pr-10"
        />

        {/* Right side icon: Loading or Clear */}
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-brand-muted animate-spin" aria-hidden="true" />
          ) : query.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSuggestions([]);
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              className="text-brand-muted hover:text-brand-text p-0.5 rounded transition-colors"
              aria-label="Clear skill search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && query.trim().length > 0 && (
        <div className="absolute z-30 mt-1 w-full bg-brand-surface border border-black/[0.12] rounded-[8px] shadow-lg max-h-72 overflow-y-auto">
          {isLoading && suggestions.length === 0 ? (
            <div className="px-4 py-3 text-sm text-brand-muted flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-brand-text" />
              <span>Searching ESCO taxonomy…</span>
            </div>
          ) : error ? (
            <div className="px-4 py-3 text-sm text-status-error flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : suggestions.length > 0 ? (
            <ul
              ref={listRef}
              id="skill-autocomplete-list"
              role="listbox"
              className="py-1 focus:outline-none"
            >
              {suggestions.map((skill, index) => {
                const isSelected = activeIndex === index;
                const alreadyAdded = isSkillAlreadyAdded(skill);

                return (
                  <li
                    key={skill.id || skill.name + index}
                    id={`skill-option-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(skill)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`px-3.5 py-2.5 cursor-pointer text-sm transition-colors border-b border-black/[0.04] last:border-b-0 flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-brand-surface-2 text-brand-text'
                        : 'text-brand-text hover:bg-brand-surface-2'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-brand-text truncate">
                          {highlightMatch(skill.name, query)}
                        </span>
                        {alreadyAdded && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.2 rounded-full bg-green-500/10 text-green-700 font-medium">
                            <Check className="w-2.5 h-2.5" /> Added
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-brand-muted mt-0.5 truncate">
                        <span>{skill.category || 'General Skill'}</span>
                        {skill.matchedAlias && (
                          <span className="text-brand-faint text-[11px] truncate">
                            · alias: "{skill.matchedAlias}"
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="text-[11px] text-brand-faint shrink-0 font-mono">
                      select ↵
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-4 text-sm text-center text-brand-muted">
              <p>No skills found for <span className="font-medium text-brand-text">"{query}"</span></p>
              <p className="text-xs text-brand-faint mt-1">Check spelling or try a broader term.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SkillAutocomplete;
