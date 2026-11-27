// Teclado da tela: em celulares e tablets (tela de toque), os campos de digitação nunca abrem o teclado
// do aparelho — `inputmode="none"` o suprime e este teclado aparece no lugar. Campos numéricos (CPF,
// matrícula, PIN, CNPJ, telefone) recebem o teclado numérico; os demais, o alfabético com acentos e
// símbolos. Teclados físicos e leitores USB continuam funcionando. Campos que já têm teclado próprio
// na tela (ex.: o do terminal) ficam marcados com data-sp-keypad="own".
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowBigUp, ChevronDown, CornerDownLeft, Delete } from 'lucide-react';

type Field = HTMLInputElement | HTMLTextAreaElement;
type Layout = 'numeric' | 'alpha';
type Layer = 'abc' | 'sym' | 'acc';

const TEXT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number', '']);
const NUMERIC_MODES = new Set(['numeric', 'decimal', 'tel']);

function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const mm = (q: string) => window.matchMedia?.(q).matches ?? false;
  return mm('(pointer: coarse)') || (navigator.maxTouchPoints > 0 && mm('(hover: none)'));
}

function editable(el: EventTarget | null): Field | null {
  if (el instanceof HTMLTextAreaElement) return el.readOnly || el.disabled ? null : el;
  if (el instanceof HTMLInputElement) {
    if (!TEXT_TYPES.has((el.getAttribute('type') ?? '').toLowerCase()) || el.readOnly || el.disabled) return null;
    return el;
  }
  return null;
}

/** Guarda o inputmode original e troca por "none" para o teclado do aparelho não abrir. */
function suppress(el: Field): Layout {
  if (!el.hasAttribute('data-sp-im')) el.setAttribute('data-sp-im', el.getAttribute('inputmode') ?? '');
  const mode = el.getAttribute('data-sp-im') ?? '';
  el.setAttribute('inputmode', 'none');
  const type = (el.getAttribute('type') ?? '').toLowerCase();
  return NUMERIC_MODES.has(mode) || type === 'number' || type === 'tel' ? 'numeric' : 'alpha';
}

function setValue(el: Field, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function caret(el: Field): [number, number] | null {
  try {
    if (el.selectionStart == null || el.selectionEnd == null) return null;
    return [el.selectionStart, el.selectionEnd];
  } catch { return null; } // type=number/email não expõem a seleção
}

function insert(el: Field, text: string) {
  const v = el.value;
  const sel = caret(el);
  const [a, b] = sel ?? [v.length, v.length];
  const max = el.maxLength > 0 ? el.maxLength : Infinity;
  if (v.length - (b - a) + text.length > max) return;
  setValue(el, v.slice(0, a) + text + v.slice(b));
  if (sel) try { el.setSelectionRange(a + text.length, a + text.length); } catch { /* ignora */ }
}

function backspace(el: Field) {
  const v = el.value;
  const sel = caret(el);
  const [a, b] = sel ?? [v.length, v.length];
  if (a === b && a === 0) return;
  const from = a === b ? a - 1 : a;
  setValue(el, v.slice(0, from) + v.slice(b));
  if (sel) try { el.setSelectionRange(from, from); } catch { /* ignora */ }
}

function enter(el: Field) {
  if (el instanceof HTMLTextAreaElement) return insert(el, '\n');
  const ev = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true });
  const ok = el.dispatchEvent(ev);
  el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
  if (ok && el.form) { el.form.requestSubmit(); return; }
  el.blur();
}

const ROWS_ABC = ['1234567890', 'qwertyuiop', 'asdfghjklç', 'zxcvbnm'];
const ROWS_SYM = ['1234567890', '@#$%&*-+()', '/_:;,!?\'"', '=<>[]{}'];
const ROWS_ACC = ['áàâãäéêëíï', 'óôõöúüñ', '´`^~¨ºª', '§|\\€£'];

export function ScreenKeyboard() {
  const [field, setField] = useState<Field | null>(null);
  const [layout, setLayout] = useState<Layout>('alpha');
  const [layer, setLayer] = useState<Layer>('abc');
  const [shift, setShift] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<Field | null>(null);
  fieldRef.current = field;

  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      if (!isTouchDevice()) return;
      const el = editable(e.target);
      if (!el) return;
      const lay = suppress(el);
      if (el.closest('[data-sp-keypad="own"]')) { setField(null); return; }
      setLayout(lay);
      setLayer('abc');
      setShift(false);
      setField(el);
    };
    // Marca campos antes do foco por toque, para o teclado do aparelho não piscar na tela.
    const onTouch = (e: Event) => {
      if (!isTouchDevice()) return;
      const el = editable(e.target);
      if (el) suppress(el);
    };
    const onBlur = () => {
      window.setTimeout(() => {
        const active = document.activeElement;
        if (active !== fieldRef.current) setField(editable(active) && isTouchDevice() && !(active as Field).closest('[data-sp-keypad="own"]') ? (active as Field) : null);
      }, 60);
    };
    document.addEventListener('focusin', onFocus, true);
    document.addEventListener('focusout', onBlur, true);
    document.addEventListener('pointerdown', onTouch, true);
    document.addEventListener('touchstart', onTouch, { capture: true, passive: true });
    // O campo já focado ao abrir a tela (autoFocus) também é tratado.
    if (document.activeElement) onFocus({ target: document.activeElement } as unknown as FocusEvent);
    return () => {
      document.removeEventListener('focusin', onFocus, true);
      document.removeEventListener('focusout', onBlur, true);
      document.removeEventListener('pointerdown', onTouch, true);
      document.removeEventListener('touchstart', onTouch, true);
    };
  }, []);

  // Tocar no teclado não pode tirar o foco do campo nem fechar diálogos abertos.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const stop = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
    root.addEventListener('pointerdown', stop);
    root.addEventListener('mousedown', stop);
    return () => { root.removeEventListener('pointerdown', stop); root.removeEventListener('mousedown', stop); };
  }, [field]);

  // Reserva o espaço do teclado para o campo continuar visível.
  useEffect(() => {
    const html = document.documentElement;
    if (!field) { html.classList.remove('sp-kb-open'); html.style.removeProperty('--sp-kb-h'); document.body.style.paddingBottom = ''; return; }
    const h = rootRef.current?.offsetHeight ?? 0;
    html.classList.add('sp-kb-open');
    html.style.setProperty('--sp-kb-h', `${h}px`);
    document.body.style.paddingBottom = `${h}px`;
    window.setTimeout(() => field.scrollIntoView({ block: 'center', behavior: 'smooth' }), 30);
  }, [field, layout]);

  const press = useCallback((fn: (el: Field) => void) => {
    const el = fieldRef.current;
    if (!el || !el.isConnected) { setField(null); return; }
    fn(el);
    navigator.vibrate?.(8);
  }, []);

  if (!field) return null;

  const key = (label: React.ReactNode, onPress: () => void, cls = '', aria?: string) => (
    <button key={aria ?? String(label)} type="button" aria-label={aria ?? (typeof label === 'string' ? label : undefined)} onClick={onPress}
      className={`flex h-12 min-w-0 select-none items-center justify-center rounded-xl bg-background text-lg font-medium shadow-sm active:scale-95 active:bg-primary/20 ${cls}`}>
      {label}
    </button>
  );

  const hide = () => { fieldRef.current?.blur(); setField(null); };
  const chr = (c: string) => (shift ? c.toUpperCase() : c);
  const rows = layer === 'sym' ? ROWS_SYM : layer === 'acc' ? ROWS_ACC : ROWS_ABC;
  const decimal = field.getAttribute('data-sp-im') === 'decimal';

  return createPortal(
    <div ref={rootRef} role="group" aria-label="Teclado da tela" data-sp-screen-keyboard=""
      className="fixed inset-x-0 bottom-0 z-[200] border-t bg-muted/95 px-1.5 pt-1.5 backdrop-blur"
      style={{ pointerEvents: 'auto', paddingBottom: 'calc(env(safe-area-inset-bottom) + 6px)' }}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-1 flex justify-end">
          <button type="button" onClick={hide} aria-label="Fechar teclado" className="flex h-7 items-center gap-1 rounded-full px-3 text-xs text-muted-foreground">
            <ChevronDown className="h-4 w-4" /> Fechar
          </button>
        </div>
        {layout === 'numeric' ? (
          <div className="mx-auto grid max-w-md grid-cols-3 gap-1.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => key(d, () => press((el) => insert(el, d)), 'h-14 text-2xl'))}
            {decimal ? key(',', () => press((el) => insert(el, ',')), 'h-14 text-2xl') : key('Limpar', () => press((el) => setValue(el, '')), 'h-14 text-sm')}
            {key('0', () => press((el) => insert(el, '0')), 'h-14 text-2xl')}
            {key(<Delete className="h-6 w-6" />, () => press(backspace), 'h-14', 'Apagar')}
            {key('OK', () => press(enter), 'col-span-3 h-12 bg-primary text-primary-foreground', 'Confirmar')}
          </div>
        ) : (
          <div className="space-y-1.5">
            {rows.map((row, i) => (
              <div key={row} className="flex gap-1">
                {i === 3 && layer === 'abc' && key(<ArrowBigUp className={`h-5 w-5 ${shift ? 'fill-current' : ''}`} />, () => setShift((s) => !s), 'w-[13%] flex-none bg-muted-foreground/15', 'Maiúsculas')}
                {[...row].map((c) => <div key={c} className="min-w-0 flex-1">{key(chr(c), () => { press((el) => insert(el, chr(c))); if (shift) setShift(false); }, 'w-full')}</div>)}
                {i === 3 && key(<Delete className="h-5 w-5" />, () => press(backspace), 'w-[13%] flex-none bg-muted-foreground/15', 'Apagar')}
              </div>
            ))}
            <div className="flex gap-1">
              {key(layer === 'sym' ? 'abc' : '?123', () => setLayer((l) => (l === 'sym' ? 'abc' : 'sym')), 'w-[14%] flex-none text-sm bg-muted-foreground/15')}
              {key(layer === 'acc' ? 'abc' : 'áé', () => setLayer((l) => (l === 'acc' ? 'abc' : 'acc')), 'w-[11%] flex-none text-sm bg-muted-foreground/15')}
              {key('@', () => press((el) => insert(el, '@')), 'w-[9%] flex-none')}
              {key('espaço', () => press((el) => insert(el, ' ')), 'flex-1 text-sm text-muted-foreground')}
              {key('.', () => press((el) => insert(el, '.')), 'w-[9%] flex-none')}
              {key(<CornerDownLeft className="h-5 w-5" />, () => press(enter), 'w-[16%] flex-none bg-primary text-primary-foreground', 'Confirmar')}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
