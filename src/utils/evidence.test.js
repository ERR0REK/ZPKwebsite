/**
 * src/utils/evidence.test.js
 * Testy helpera dowodów: wykrywanie linków z Discorda + rehost.
 */

import { isDiscordImageUrl, rehostEvidenceText, rehostImageUrl } from './evidence';

describe('evidence utils', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('isDiscordImageUrl', () => {
    it('rozpoznaje hosty Discorda', () => {
      expect(isDiscordImageUrl('https://cdn.discordapp.com/attachments/1/2/obraz.png?ex=1&is=2&hm=3')).toBe(true);
      expect(isDiscordImageUrl('https://media.discordapp.net/attachments/1/2/obraz.png')).toBe(true);
      expect(isDiscordImageUrl('https://discord.com/attachments/1/2/obraz.png')).toBe(true);
    });

    it('odrzuca inne hosty i śmieci', () => {
      expect(isDiscordImageUrl('https://files.catbox.moe/abc.png')).toBe(false);
      expect(isDiscordImageUrl('https://evil-cdn.discordapp.com.evil.com/x.png')).toBe(false);
      expect(isDiscordImageUrl('http://cdn.discordapp.com/attachments/1/2/x.png')).toBe(false); // nie-https
      expect(isDiscordImageUrl('nie jest url')).toBe(false);
      expect(isDiscordImageUrl(null)).toBe(false);
    });
  });

  describe('rehostImageUrl', () => {
    it('zwraca wieczny URL z Catboxa', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, url: 'https://files.catbox.moe/xyz.png' }),
      });
      const r = await rehostImageUrl('https://cdn.discordapp.com/attachments/1/2/a.png', 'tok');
      expect(r.ok).toBe(true);
      expect(r.url).toBe('https://files.catbox.moe/xyz.png');
      expect(global.fetch).toHaveBeenCalledWith('/api/upload-evidence', expect.objectContaining({ method: 'POST' }));
    });

    it('nie rzuca przy błędzie serwera', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({ ok: false, error: 'SOURCE_UNAVAILABLE' }),
      });
      const r = await rehostImageUrl('https://cdn.discordapp.com/attachments/1/2/a.png', 'tok');
      expect(r.ok).toBe(false);
      expect(r.error).toBe('SOURCE_UNAVAILABLE');
    });
  });

  describe('rehostEvidenceText', () => {
    it('podmienia tylko linie image z Discorda', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, url: 'https://files.catbox.moe/new.png' }),
      });
      const input = [
        'image|https://cdn.discordapp.com/attachments/1/2/old.png?ex=9&hm=9',
        'youtube|https://youtube.com/watch?v=x|Tytuł',
        'image|https://files.catbox.moe/juz-catbox.png',
      ].join('\n');
      const r = await rehostEvidenceText(input, 'tok');
      expect(r.changed).toBe(true);
      expect(r.rehosted).toBe(1);
      expect(r.failed).toBe(0);
      expect(r.text).toBe(
        [
          'image|https://files.catbox.moe/new.png',
          'youtube|https://youtube.com/watch?v=x|Tytuł',
          'image|https://files.catbox.moe/juz-catbox.png',
        ].join('\n')
      );
    });

    it('liczy porażki i zostawia oryginał (nie blokuje dodania)', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({ ok: false, error: 'SOURCE_UNAVAILABLE' }),
      });
      const r = await rehostEvidenceText('image|https://cdn.discordapp.com/attachments/1/2/dead.png', 'tok');
      expect(r.failed).toBe(1);
      expect(r.rehosted).toBe(0);
      expect(r.text).toBe('image|https://cdn.discordapp.com/attachments/1/2/dead.png');
    });
  });
});
