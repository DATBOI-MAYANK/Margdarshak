import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { getApiUrl } from '../core/services/runtime-config';

export interface TranslationResult {
  original: string;
  translated: string;
  detectedLanguage?: string;
  targetLanguage?: string;
}

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  // Use backend proxy to avoid CORS issues
  private apiUrl = `${getApiUrl()}/translate`;
  
  // Cache to avoid repeated API calls - key format: "text_targetLang"
  private translationCache: Map<string, string> = new Map();

  // Current target language (default: English)
  private _targetLanguage: string = 'en';

  // Supported languages for translation
  readonly supportedLanguages: Language[] = [
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
    { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
    { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
    { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文', flag: '🇨🇳' },
    { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文', flag: '🇹🇼' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
    { code: 'th', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭' },
    { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
    { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾' },
    { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
    { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
    { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
    { code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪' },
    { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', flag: '🇬🇷' },
    { code: 'he', name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱' },
    { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦' },
    { code: 'cs', name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿' },
    { code: 'ro', name: 'Romanian', nativeName: 'Română', flag: '🇷🇴' },
    { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', flag: '🇭🇺' },
    { code: 'fi', name: 'Finnish', nativeName: 'Suomi', flag: '🇫🇮' },
    { code: 'da', name: 'Danish', nativeName: 'Dansk', flag: '🇩🇰' },
    { code: 'no', name: 'Norwegian', nativeName: 'Norsk', flag: '🇳🇴' },
  ];

  constructor(private http: HttpClient) {}

  // Getter and setter for target language
  get targetLanguage(): string {
    return this._targetLanguage;
  }

  set targetLanguage(lang: string) {
    this._targetLanguage = lang;
  }

  getLanguageByCode(code: string): Language | undefined {
    return this.supportedLanguages.find(l => l.code === code);
  }

  /**
   * Extract English/Latin name from mixed text like "魯班先師廟 Lo Pan Temple"
   * Returns the Latin part if found, otherwise null
   */
  extractLatinName(text: string): string | null {
    if (!text) return null;
    
    // Check if text contains both non-Latin and Latin characters
    const hasNonLatin = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u0600-\u06ff\u0400-\u04ff\u0900-\u097f\u0e00-\u0e7f]/.test(text);
    const hasLatin = /[a-zA-Z]{2,}/.test(text);
    
    if (hasNonLatin && hasLatin) {
      // Try to extract Latin part
      const patterns = [
        // Non-Latin followed by Latin
        /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u0600-\u06ff\u0400-\u04ff\u0900-\u097f\u0e00-\u0e7f]+\s+([A-Za-z][A-Za-z\s\-'\.]+)$/,
        // Latin followed by Non-Latin
        /^([A-Za-z][A-Za-z\s\-'\.]+)\s+[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]+/,
        // With dash separator
        /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]+\s*[-–—]\s*([A-Za-z][A-Za-z\s\-'\.]+)/,
        /([A-Za-z][A-Za-z\s\-'\.]+)\s*[-–—]\s*[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]+/,
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const latin = match[1].trim();
          if (latin.length > 3) {
            return latin;
          }
        }
      }
      
      // Fallback: find consecutive Latin words
      const words = text.split(/\s+/);
      const latinWords: string[] = [];
      let foundLatin = false;
      
      for (const word of words) {
        if (/^[A-Za-z\-'\.]+$/.test(word) && word.length > 1) {
          latinWords.push(word);
          foundLatin = true;
        } else if (foundLatin && latinWords.length > 0) {
          break;
        }
      }
      
      if (latinWords.length >= 2) {
        return latinWords.join(' ');
      }
    }
    
    return null;
  }

  // Alias for backward compatibility
  extractEnglishName(text: string): string | null {
    return this.extractLatinName(text);
  }

  /**
   * Check if name needs translation
   */
  needsTranslation(text: string): boolean {
    if (!text) return false;
    
    // If we can extract Latin text, no translation needed
    const extractedLatin = this.extractLatinName(text);
    if (extractedLatin) {
      console.log(`needsTranslation("${text}"): NO - extracted Latin: "${extractedLatin}"`);
      return false;
    }
    
    // If already Latin-based, no translation needed
    if (this.isLatinBased(text)) {
      console.log(`needsTranslation("${text}"): NO - is Latin-based`);
      return false;
    }
    
    console.log(`needsTranslation("${text}"): YES`);
    return true;
  }

  /**
   * Translate text to target language (default: English)
   */
  translate(text: string, targetLang?: string, sourceLang: string = 'auto'): Observable<TranslationResult> {
    const target = targetLang || this._targetLanguage;
    
    if (!text || text.trim() === '') {
      return of({ original: text, translated: text, targetLanguage: target });
    }

    // For English target, try to extract Latin name first
    if (target === 'en') {
      const extractedLatin = this.extractLatinName(text);
      if (extractedLatin) {
        return of({ original: text, translated: extractedLatin, targetLanguage: target });
      }
    }

    // Check cache
    const cacheKey = `${text}_${target}`;
    if (this.translationCache.has(cacheKey)) {
      return of({
        original: text,
        translated: this.translationCache.get(cacheKey)!,
        targetLanguage: target
      });
    }

    // Detect source language
    const detectedLang = sourceLang === 'auto' ? this.detectLanguage(text) : sourceLang;
    
    // Check if already in target language
    if (detectedLang === target || (target === 'en' && this.isLatinBased(text))) {
      return of({ original: text, translated: text, targetLanguage: target });
    }

    // Build language pair
    const langPair = `${detectedLang}|${target}`;

    const params = {
      q: text,
      langpair: langPair
    };

    console.log(`Translating "${text}" [${detectedLang}] → [${target}]`);

    return this.http.get<any>(this.apiUrl, { params }).pipe(
      map(response => {
        let translated = response.responseData?.translatedText || text;
        
        // Check for error responses
        if (response.responseStatus === 403 || translated === text) {
          console.warn(`Translation may have failed for "${text}"`);
        }
        
        console.log(`Result: "${text}" → "${translated}"`);
        
        // Clean up translation for place names
        translated = this.cleanTranslation(translated);
        
        // Cache result
        this.translationCache.set(cacheKey, translated);
        
        return {
          original: text,
          translated: translated,
          detectedLanguage: detectedLang,
          targetLanguage: target
        };
      }),
      catchError(error => {
        console.error('Translation error:', error);
        return of({ original: text, translated: text, targetLanguage: target });
      })
    );
  }

  // Alias for backward compatibility
  translateToEnglish(text: string, sourceLang: string = 'auto'): Observable<TranslationResult> {
    return this.translate(text, 'en', sourceLang);
  }

  /**
   * Translate to a specific language
   */
  translateTo(text: string, targetLang: string): Observable<TranslationResult> {
    return this.translate(text, targetLang);
  }

  /**
   * Translate multiple texts
   */
  translateMultiple(texts: string[], targetLang?: string): Observable<TranslationResult[]> {
    if (!texts || texts.length === 0) {
      return of([]);
    }

    const target = targetLang || this._targetLanguage;
    const translations$ = texts.map(text => this.translate(text, target));
    return forkJoin(translations$);
  }

  /**
   * Clean up translation result
   */
  private cleanTranslation(text: string): string {
    if (!text) return text;
    
    // For Latin-based languages, capitalize words (for place names)
    if (this.isLatinBased(text)) {
      return text.split(' ')
        .map(word => {
          if (word.length === 0) return word;
          // Don't capitalize small words like "of", "the", "de", "la" etc.
          const smallWords = ['of', 'the', 'a', 'an', 'de', 'la', 'le', 'les', 'du', 'des', 'el', 'los', 'las', 'di', 'da', 'von', 'van'];
          if (smallWords.includes(word.toLowerCase())) {
            return word.toLowerCase();
          }
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
    }
    
    return text;
  }

  /**
   * Check if text is Latin-based (English, Spanish, French, etc.)
   */
  isLatinBased(text: string): boolean {
    const latinChars = text.replace(/[^a-zA-ZÀ-ÿ]/g, '').length;
    const totalChars = text.replace(/\s/g, '').length;
    
    if (totalChars === 0) return true;
    
    return (latinChars / totalChars) > 0.8;
  }

  // Alias for backward compatibility
  isEnglish(text: string): boolean {
    return this.isLatinBased(text);
  }

  /**
   * Detect language of text - returns language code for MyMemory API
   */
  detectLanguage(text: string): string {
    // Check for Chinese characters
    if (/[\u4e00-\u9fff]/.test(text)) {
      // Traditional vs Simplified (rough detection)
      const traditionalChars = /[繁體傳統國學書畫經濟電腦視頻網絡機場語學習學網綱車書報發動機華語問題學術總統環境編輯]/.test(text);
      return traditionalChars ? 'zh-TW' : 'zh-CN';
    }
    
    // Japanese (has Hiragana or Katakana)
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja';
    
    // Korean (Hangul)
    if (/[\uac00-\ud7af\u1100-\u11ff]/.test(text)) return 'ko';
    
    // Arabic
    if (/[\u0600-\u06ff\u0750-\u077f]/.test(text)) return 'ar';
    
    // Hebrew
    if (/[\u0590-\u05ff]/.test(text)) return 'he';
    
    // Cyrillic (Russian, Ukrainian, etc.)
    if (/[\u0400-\u04ff]/.test(text)) {
      // Try to distinguish Ukrainian vs Russian
      if (/[їієґІЇЄҐ]/.test(text)) return 'uk';
      return 'ru';
    }
    
    // Thai
    if (/[\u0e00-\u0e7f]/.test(text)) return 'th';
    
    // Hindi/Devanagari
    if (/[\u0900-\u097f]/.test(text)) return 'hi';
    
    // Tamil
    if (/[\u0b80-\u0bff]/.test(text)) return 'ta';
    
    // Telugu
    if (/[\u0c00-\u0c7f]/.test(text)) return 'te';
    
    // Bengali
    if (/[\u0980-\u09ff]/.test(text)) return 'bn';
    
    // Greek
    if (/[\u0370-\u03ff]/.test(text)) return 'el';
    
    // Vietnamese (has special diacritics)
    if (/[ăâđêôơưàảãạằẳẵặầẩẫậèẻẽẹềểễệìỉĩịòỏõọồổỗộờởỡợùủũụừửữựỳỷỹỵ]/i.test(text)) return 'vi';
    
    // Turkish specific characters
    if (/[ğışçöüĞİŞÇÖÜ]/.test(text)) return 'tr';
    
    // Polish specific characters
    if (/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(text)) return 'pl';
    
    // Czech/Slovak
    if (/[ěščřžýďťňĚŠČŘŽÝĎŤŇ]/.test(text)) return 'cs';
    
    // Romanian
    if (/[ăâîșțĂÂÎȘȚ]/.test(text)) return 'ro';
    
    // Hungarian
    if (/[őűŐŰ]/.test(text)) return 'hu';
    
    // Default to English for Latin text
    if (this.isLatinBased(text)) return 'en';
    
    // Fallback to Chinese (most common non-Latin)
    return 'zh-CN';
  }

  /**
   * Get language name from code
   */
  getLanguageName(code: string): string {
    const lang = this.supportedLanguages.find(l => l.code === code);
    return lang ? lang.name : code;
  }

  /**
   * Clear translation cache
   */
  clearCache(): void {
    this.translationCache.clear();
  }

  /**
   * Clear cache for specific target language
   */
  clearCacheForLanguage(targetLang: string): void {
    const keysToDelete: string[] = [];
    this.translationCache.forEach((_, key) => {
      if (key.endsWith(`_${targetLang}`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.translationCache.delete(key));
  }
}
