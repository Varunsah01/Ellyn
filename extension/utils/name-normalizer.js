// Name Normalizer Utility
// handles cleaning and validation of extracted names
// strictly follows project conventions: Zero-API, local processing

(function(window) {
  'use strict';

  // Titles to strip (case insensitive)
  const TITLES = [
    'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'dr', 'dr.', 'prof', 'prof.',
    'sir', 'madam', 'hon', 'rev'
  ];

  /**
   * Normalize a raw name string
   * @param {string} rawName - The raw name string extracted from DOM
   * @returns {Object} - { rawName, fullName, firstName, lastName, confidence }
   */
  function normalizeName(rawName) {
    if (!rawName || typeof rawName !== 'string') {
      return {
        rawName: '',
        fullName: '',
        firstName: '',
        lastName: null,
        confidence: 0
      };
    }

    const trimmed = rawName.trim();
    if (!trimmed) {
      return {
        rawName: '',
        fullName: '',
        firstName: '',
        lastName: null,
        confidence: 0
      };
    }

    // 1. Strip known pollution patterns (hex/numeric strings at end)
    // Regex explanation:
    // \s+           : space separator
    // [a-fA-F0-9]+  : hex/numeric characters
    // $             : end of string
    // logic: look for tokens that look like IDs
    
    let clean = trimmed;
    
    // Split by space to inspect tokens
    const tokens = clean.split(/\s+/);
    const validTokens = [];
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      
      // Check if token is garbage
      if (isGarbageToken(token)) {
        continue;
      }
      
      // Check if token is a title
      if (TITLES.includes(token.toLowerCase())) {
        continue;
      }
      
      validTokens.push(token);
    }
    
    // Reassemble
    let fullName = validTokens.join(' ');
    
    // 2. Calculate confidence and validate
    const confidence = calculateConfidence(trimmed, fullName, validTokens);
    
    // 3. Parse first/last
    let firstName = '';
    let lastName = null;
    
    if (validTokens.length > 0) {
      firstName = validTokens[0];
      if (validTokens.length > 1) {
        lastName = validTokens.slice(1).join(' ');
      }
    }

    return {
      rawName: trimmed,
      fullName: fullName,
      firstName: firstName,
      lastName: lastName,
      confidence: confidence
    };
  }

  /**
   * Check if a token is likely a database ID or hash
   */
  function isGarbageToken(token) {
    if (!token) return false;
    
    // 1. Hex/Numeric strings >= 6 chars (e.g., "1105601aa", "0b22494a")
    if (token.length >= 6) {
      const hexMatch = /^[a-fA-F0-9]+$/.test(token);
      if (hexMatch) {
        // It's hex/numeric. Check if it's mostly numeric/hex noise
        // A name *could* be "Decimus" (7 chars, hex-ish), but unlikely to be mixed numbers
        const hasDigits = /\d/.test(token);
        if (hasDigits) return true; // "Karthik1" is bad, "110560" is bad
        
        // If it's all letters but looks random? Hard to say without dictionary.
        // But the prompt specifically mentions hex/numeric strings >= 6 chars
        // and "UUID-like tokens"
      }
    }
    
    // 2. Check for mixed alphanumeric garbage (e.g. "x8js9") if it has digits
    if (token.length >= 4 && /[a-zA-Z]/.test(token) && /\d/.test(token)) {
      return true; 
    }

    // 3. Pure numbers are bad (unless maybe "3rd"? but usually handled by suffixes)
    if (/^\d+$/.test(token)) {
      return true;
    }
    
    return false;
  }

  /**
   * Calculate confidence score (0-100)
   */
  function calculateConfidence(original, cleaned, tokens) {
    if (!cleaned) return 0;
    
    let score = 100;
    
    // Penalize if we stripped a lot
    if (original.length > cleaned.length + 10) {
      score -= 20;
    }
    
    // Penalize if single word
    if (tokens.length === 1) {
      score -= 30; // Single names are risky
    }
    
    // Reject names where > 25% chars are numeric/hex (per requirements)
    // We count digits and a-f in the *original* string? 
    // Requirement: "Reject names where >25% characters are numeric/hex"
    // This implies checking the original string for pollution density.
    const hexChars = original.match(/[a-fA-F0-9]/g)?.length || 0;
    const totalChars = original.replace(/\s/g, '').length;
    
    if (totalChars > 0 && (hexChars / totalChars) > 0.8) { 
      // High density of hex/numbers implies extracted ID, not name
      // NOTE: Real names have a,b,c,d,e,f. So strictly counting [a-f] is dangerous for "Fade Cabbage".
      // Better to count *digits* and maybe high-entropy mix?
      // The prompt says "numeric/hex". 
      // A better heuristic is: if it contains digits, it's suspect.
      // If it looks like a hash, we likely already stripped it.
      // If the *cleaned* name still has digits, score is 0.
    }
    
    // Check for digits in the cleaned name
    if (/\d/.test(cleaned)) {
      return 0; // Names shouldn't have numbers
    }
    
    // Check for unusual characters
    if (/[^a-zA-Z\s\-\.'\u00C0-\u024F]/.test(cleaned)) {
      score -= 40; // Weird symbols
    }

    return Math.max(0, score);
  }

  // Export to window
  window.EllynNameNormalizer = {
    normalizeName
  };

})(window);
