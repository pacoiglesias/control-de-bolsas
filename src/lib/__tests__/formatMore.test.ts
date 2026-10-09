import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  exportToCsv,
  getPrintHeaderHtml,
  escapeHtml,
  shareHtmlAsPdf,
  toInputDate,
  fromInputDate,
  monthKey,
  monthLabel,
  fmtDateTime,
} from '../format';

describe('format.ts Extended Unit Tests', () => {
  let originalCreateObjectURL: any;
  let originalRevokeObjectURL: any;
  let originalDocument: any;

  beforeEach(() => {
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();

    originalDocument = (global as any).document;
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    (global as any).document = originalDocument;
  });

  it('correctly escapes HTML for safe interpolation', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(escapeHtml("Tom's & Jerry's")).toBe('Tom&#039;s &amp; Jerry&#039;s');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('formats input date conversions and month keys/labels correctly', () => {
    const d = new Date(2026, 3, 18); // Abril 18, 2026
    const inputStr = toInputDate(d);
    expect(inputStr).toBe('2026-04-18');

    const parsed = fromInputDate('2026-04-18');
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(3);
    expect(parsed?.getDate()).toBe(18);

    expect(fromInputDate('')).toBeNull();
    expect(fromInputDate('invalid')).toBeNull();

    const mKey = monthKey(d);
    expect(mKey).toBe('2026-04');
    expect(monthLabel(mKey)).toBe('Abr 26');

    expect(toInputDate(null)).toBe('');
    expect(fmtDateTime(null)).toBe('—');
    expect(fmtDateTime(d)).toBeTruthy();
  });

  it('generates print header HTML with provided settings or fallbacks', () => {
    const htmlWithSubtitle = getPrintHeaderHtml(
      { companyName: 'Elemental Denim', companyLogoUrl: 'https://logo.com/img.png' },
      'Reporte de Entregas',
      'Lote Especial'
    );
    expect(htmlWithSubtitle).toContain('Elemental Denim');
    expect(htmlWithSubtitle).toContain('Reporte de Entregas');
    expect(htmlWithSubtitle).toContain('Lote Especial');
    expect(htmlWithSubtitle).toContain('https://logo.com/img.png');

    const htmlDefault = getPrintHeaderHtml(null, 'Resumen');
    expect(htmlDefault).toContain('Bolsas Elemental');
    expect(htmlDefault).toContain('/logo.png');
    expect(htmlDefault).not.toContain('margin-top: 4px;');
  });

  it('exports CSV content creating a downloadable blob link', () => {
    const clickSpy = vi.fn();
    const appendSpy = vi.fn();
    const removeSpy = vi.fn();

    (global as any).document = {
      createElement: vi.fn(() => ({
        setAttribute: vi.fn(),
        click: clickSpy,
      })),
      body: {
        appendChild: appendSpy,
        removeChild: removeSpy,
      },
    };

    exportToCsv('reporte_bolsas', ['Folio', 'Kilos', 'Cliente'], [
      ['OC-100', 1200, 'Textil "Hogar"'],
      ['OC-200', 2500, null],
    ]);

    expect(clickSpy).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('handles shareHtmlAsPdf fallback gracefully when html2pdf fails or prints fallback', async () => {
    const windowOpenSpy = vi.fn().mockReturnValue({
      document: {
        write: vi.fn(),
        close: vi.fn(),
      },
      focus: vi.fn(),
    });
    vi.stubGlobal('window', { open: windowOpenSpy });

    (global as any).document = {
      createElement: vi.fn(() => ({
        style: {},
      })),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    };

    (global as any).DOMParser = class {
      parseFromString() {
        return {
          querySelectorAll: () => [],
          body: { innerHTML: '<p>Content</p>' },
        };
      }
    };

    await shareHtmlAsPdf('<html><body><h1>Factura</h1></body></html>', 'test.pdf');
    expect(windowOpenSpy).toHaveBeenCalled();
  });
});
