/**
 * name-normalizer.js
 * 
 * Logic for cleaning up and extracting structured data from raw names.
 */
(function(window) {
  'use strict';

  const normalizeName = (name) => {
    if (!name) return { fullName: '', firstName: '', lastName: '', confidence: 0, rawName: name };
    
    let normalized = name.replace(/\n/g, ' ').trim();
    
    // Remove titles
    const titles = [/Dr\.?\s+/i, /Mr\.?\s+/i, /Ms\.?\s+/i, /Mrs\.?\s+/i, /Prof\.?\s+/i];
    titles.forEach(title => {
      normalized = normalized.replace(title, '');
    });
    
    // Remove common suffixes
    // Fixed: added \s+ to ensure we don't leave a trailing dot or space
    const suffixes = [/\s+Jr\.?$/i, /\s+Sr\.?$/i, /\s+II+$/i, /\s+IV$/i, /\s+PhD$/i, /\s+MD$/i, /\s+Esq\.?$/i];
    suffixes.forEach(suffix => {
      normalized = normalized.replace(suffix, '');
    });
    
    // Remove hex/numeric pollution (common in some LinkedIn scrapes)
    const pollution = /\s+[a-f0-9]{8,10}$/i;
    normalized = normalized.replace(pollution, '');
    
    // Final cleanup
    normalized = normalized.replace(/\s+/g, ' ').trim();
    
    // If purely numeric or too short, reject
    if (/^[0-9a-f]+$/i.test(normalized) && normalized.length > 5) {
      return { fullName: '', firstName: '', lastName: '', confidence: 0, rawName: name };
    }
    
    const parts = normalized.split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';
    
    return {
      fullName: normalized,
      firstName,
      lastName,
      confidence: normalized.length > 0 ? 100 : 0,
      rawName: name
    };
  };

  window.EllynNameNormalizer = {
    normalizeName
  };
})(typeof window !== 'undefined' ? window : {});
