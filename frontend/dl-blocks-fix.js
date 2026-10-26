/* Расширенное меню блоков: видимая раскладушка над действиями.
   Родные блоки не перехватываются. Каталог пишет обычный HTML в #pvFrame. */
(function () {
  'use strict';
  if (window.__dlBlocksPanelV6) return;
  window.__dlBlocksPanelV6 = true;
  var ROOT = 'data-dl-expanded-catalog', CSS = 'dl-blocks-extended-css', OPEN = 'dl_bf_open_v6';
  var busy = false, serial = 0, mounted = false, last = { id: '', ok: false, error: '', place: '' };
  var SEL = '[data-dl-selected],[data-sf-selected],[data-selected],.dl-selected,.sf-selected,.selected';
  function note(t) { try { if (typeof window.toast === 'function') window.toast(t); } catch (e) {} }
  function log(t) { try { console.log('[блоки] ' + t); } catch (e) {} }
  function norm(v) { return String(v || '').replace(/[\s\u00a0]+/g, ' ').trim().toLowerCase(); }
  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function val(v) { if (v === null || v === undefined || v === '') return ''; return typeof v === 'number' ? (v === 0 ? '0' : v + 'px') : String(v); }
  function frame() { return document.getElementById('pvFrame'); }
  function preview() { var f = frame(); try { var d = f && (f.contentDocument || (f.contentWindow && f.contentWindow.document)); return d && d.body ? d : null; } catch (e) { return null; } }
  function visible(el) { try { var r = el && el.getBoundingClientRect(); return !!(r && r.width > 1 && r.height > 1 && el.getClientRects().length); } catch (e) { return false; } }
  function add(s, k, v) { if (v !== undefined && v !== null && v !== '') s.push(k + ':' + v); }
  function style(p, type) {
    p = p || {}; var s = ['box-sizing:border-box'], flex = /^(frame|header|footer|hscroll)$/.test(type);
    if (flex) { add(s, 'display', 'flex'); add(s, 'flex-direction', p.direction || (type === 'hscroll' ? 'row' : 'column')); if (p.gap !== undefined && Number(p.gap) >= 0) add(s, 'gap', val(p.gap)); if (p.alignItems) add(s, 'align-items', p.alignItems); if (p.justifyContent) add(s, 'justify-content', p.justifyContent); if (p.wrap) add(s, 'flex-wrap', 'wrap'); }
    if (p.width !== undefined) add(s, 'width', val(p.width)); if (p.maxWidth !== undefined) add(s, 'max-width', val(p.maxWidth)); if (p.height !== undefined) add(s, 'height', val(p.height)); if (p.padding !== undefined) add(s, 'padding', val(p.padding)); if (p.backgroundColor) add(s, 'background-color', p.backgroundColor); if (p.borderRadius !== undefined) add(s, 'border-radius', val(p.borderRadius)); if (p.backdropFilter) add(s, 'backdrop-filter', p.backdropFilter); if (p.color) add(s, 'color', p.color); if (p.fontSize !== undefined) add(s, 'font-size', val(p.fontSize)); if (p.fontWeight !== undefined) add(s, 'font-weight', p.fontWeight); if (p.lineHeight !== undefined) add(s, 'line-height', p.lineHeight); if (p.letterSpacing !== undefined) add(s, 'letter-spacing', val(p.letterSpacing));
    return s.join(';');
  }
  function attrs(p, mark, root) { return (root ? ' data-dl-catalog-node="' + esc(mark) + '"' : '') + (p && p.anchor ? ' id="' + esc(p.anchor) + '"' : ''); }
  function children(list, mark) { var out = ''; list = list || []; for (var i = 0; i < list.length; i++) out += renderNode(list[i], mark, false); return out; }
  function renderNode(n, mark, root) {
    if (!n || typeof n !== 'object') return '';
    var p = n.props || {}, type = n.type || 'frame', st = style(p, type), tag, i, links, body;
    if (type === 'paragraph') {
      tag = Number(p.fontSize || 0) >= 52 ? 'h1' : Number(p.fontSize || 0) >= 36 ? 'h2' : Number(p.fontSize || 0) >= 27 ? 'h3' : 'p';
      body = esc(p.text || 'Текст'); if (p.href) body = '<a href="' + esc(p.href) + '" style="color:inherit;text-decoration:inherit">' + body + '</a>';
      return '<' + tag + attrs(p, mark, root) + ' style="margin:0;' + esc(st) + '">' + body + '</' + tag + '>';
    }
    if (type === 'button') {
      st += ';display:inline-flex;align-items:center;justify-content:center;width:fit-content;padding:11px 17px;border-radius:10px;text-decoration:none;font-weight:600;cursor:pointer';
      if (p.variant === 'outline') st += ';background:transparent;border:1px solid var(--sf-border,rgba(128,128,128,.35));color:var(--sf-text,inherit)'; else st += ';background:var(--sf-accent,#2f6fed);border:0;color:var(--sf-onAccent,#fff)';
      return '<a href="' + esc(p.href || '#') + '"' + attrs(p, mark, root) + ' style="' + esc(st) + '">' + esc(p.label || 'Кнопка') + '</a>';
    }
    if (type === 'image') {
      st += ';display:flex;align-items:center;justify-content:center;width:' + esc(val(p.width || '100%')) + ';height:' + esc(val(p.height || 220)) + ';min-height:' + esc(val(p.height || 220)) + ';background:var(--sf-surface,rgba(128,128,128,.10));color:var(--sf-muted,rgba(120,120,120,.95));font-size:14px;overflow:hidden';
      return '<div role="img" aria-label="' + esc(p.alt || 'Изображение') + '"' + attrs(p, mark, root) + ' style="' + esc(st) + '">▧&nbsp; ' + esc(p.alt || 'Изображение') + '</div>';
    }
    if (type === 'nav' || type === 'burger') {
      links = p.links || []; body = type === 'burger' ? '<button type="button" style="border:0;background:transparent;color:inherit;font:24px/1 sans-serif;padding:0">☰</button>' : '';
      body += '<span style="display:flex;gap:14px;flex-wrap:wrap">'; for (i = 0; i < links.length; i++) body += '<a href="' + esc(links[i].href || '#') + '" style="color:inherit;text-decoration:none">' + esc(links[i].label || 'Ссылка') + '</a>'; body += '</span>';
      return '<nav' + attrs(p, mark, root) + ' style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;' + esc(st) + '">' + body + '</nav>';
    }
    if (type === 'search') return '<div' + attrs(p, mark, root) + ' style="display:flex;gap:8px;width:100%;' + esc(st) + '"><input type="search" placeholder="' + esc(p.placeholder || 'Поиск') + '" style="min-width:0;flex:1;padding:10px 12px;border:1px solid var(--sf-border,rgba(128,128,128,.35));border-radius:9px;background:transparent;color:inherit"><button type="button" style="padding:10px 14px;border:0;border-radius:9px;background:var(--sf-accent,#2f6fed);color:var(--sf-onAccent,#fff)">Найти</button></div>';
    if (type === 'htmlraw') return '<div' + attrs(p, mark, root) + ' style="width:100%;height:' + esc(val(p.height || 320)) + ';overflow:hidden;' + esc(st) + '">' + String(p.html || p.code || '') + '</div>';
    if (type === 'hscroll') return '<div' + attrs(p, mark, root) + ' style="display:flex;overflow-x:auto;flex-direction:row;' + esc(st) + '">' + children(n.children, mark) + '</div>';
    if (type === 'animation') return '<div data-dl-animation="' + esc(p.variant || 'slide-up') + '"' + attrs(p, mark, root) + ' style="' + esc(st) + '">' + children(n.children, mark) + '</div>';
    tag = type === 'header' || type === 'footer' ? type : 'section';
    if (type === 'header') st += ';position:' + (p.sticky ? 'sticky' : 'relative') + ';top:0;z-index:2';
    if (p.dlCols) st += ';display:grid;grid-template-columns:repeat(' + Number(p.dlCols) + ',minmax(0,1fr))';
    return '<' + tag + attrs(p, mark, root) + ' style="' + esc(st) + '">' + children(n.children, mark) + '</' + tag + '>';
  }
  function canHost(e) { var t = String((e && e.tagName) || '').toLowerCase(); return ['body','div','section','main','article','aside','header','footer','nav','form','li','td','blockquote'].indexOf(t) >= 0; }
  function destination(d, alt) { var s = null; try { s = d.querySelector(SEL); } catch (e) {} if (s && s !== d.body) { if (canHost(s)) return { parent: s, before: null, label: 'в выбранный контейнер' }; if (s.parentNode) return { parent: s.parentNode, before: alt ? s : s.nextSibling, label: alt ? 'перед выбранным блоком' : 'после выбранного блока' }; } return { parent: d.body, before: null, label: 'в конец страницы' }; }
  function write(page) { try { if (window.current && typeof window.current === 'object') window.current.html = page; } catch (e) {} try { var a = document.getElementById('codeTa'); if (a) { a.value = page; a.dispatchEvent(new Event('input', { bubbles: true })); a.dispatchEvent(new Event('change', { bubbles: true })); } } catch (e) {} }
  function draw(page) { var ns = ['renderHtml','renderHtmlLive']; for (var i = 0; i < ns.length; i++) try { if (typeof window[ns[i]] === 'function') { window[ns[i]](page); return; } } catch (e) {} }
  function has(mark) { var d = preview(); try { return !!(d && d.querySelector('[data-dl-catalog-node="' + mark + '"]')); } catch (e) { return false; } }
  function confirm(mark, label, page, n) { setTimeout(function () { if (has(mark)) { busy = false; last.ok = true; last.error = ''; note('Добавлено: ' + label); return; } if (n < 6) { confirm(mark, label, page, n + 1); return; } try { var f = frame(); if (f) f.srcdoc = page; } catch (e) {} setTimeout(function () { busy = false; last.ok = has(mark); last.error = last.ok ? '' : 'редактор не подтвердил появление блока'; note(last.ok ? ('Добавлено: ' + label) : ('Не получилось вставить «' + label + '»: ' + last.error)); }, 160); }, 110); }
  function insert(id, alt) {
    if (busy) { note('Секунду, вставляю предыдущий блок'); return false; }
    var api = window.DLBlocks, list = api && api.items || [], item = null, i; if (!api || typeof api.build !== 'function') { note('Каталог ещё загружается'); return false; }
    for (i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) { item = list[i]; break; }
    var label = item ? item.name : String(id || 'блок'), node = null; try { node = api.build(id); } catch (e) {}
    if (!node) { note('Не смог собрать блок «' + label + '»'); return false; }
    var d = preview(); if (!d) { note('Открой страницу в конструкторе и попробуй снова'); return false; }
    var mark = 'dlc' + Date.now().toString(36) + (++serial), holder = d.createElement('div'); holder.innerHTML = renderNode(node, mark, true); var el = holder.firstElementChild;
    if (!el) { note('Не смог подготовить блок «' + label + '»'); return false; }
    var to = destination(d, !!alt); try { to.parent.insertBefore(el, to.before || null); } catch (e) { note('Не смог добавить блок в страницу'); return false; }
    var page = '<!DOCTYPE html>' + d.documentElement.outerHTML; busy = true; last = { id: String(id), ok: false, error: '', place: to.label }; write(page); draw(page); log('вставляю «' + label + '»: ' + to.label); confirm(mark, label, page, 0); return true;
  }
  function stylePanel() {
    var legacy = document.getElementById('dl-blocks-fix-css'); if (legacy && legacy.parentNode) legacy.parentNode.removeChild(legacy);
    var old = document.getElementById(CSS); if (old && old.parentNode) old.parentNode.removeChild(old);
    var s = document.createElement('style'); s.id = CSS;
    s.textContent = '[data-dl-catalog]{display:none!important}[' + ROOT + ']{display:block!important;width:100%;margin:10px 0 12px;padding-bottom:12px;border-bottom:1px solid rgba(128,128,128,.22)}[' + ROOT + '] .dlx-head{display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;font:600 12px/1.2 inherit;text-transform:uppercase;letter-spacing:.06em;opacity:.75;margin:0 0 8px}[' + ROOT + '] .dlx-n{opacity:.55;font-size:11px;font-weight:600;letter-spacing:0;text-transform:none}[' + ROOT + '] .dlx-caret{margin-left:auto;opacity:.7;font-size:11px}[' + ROOT + '] .dlx-q{width:100%;box-sizing:border-box;padding:8px 10px;margin:0 0 8px;border-radius:9px;border:1px solid rgba(128,128,128,.28);background:rgba(128,128,128,.10);color:inherit;font:inherit;font-size:13px;outline:none}[' + ROOT + '] .dlx-cats{display:flex;flex-wrap:wrap;gap:5px;margin:0 0 10px}[' + ROOT + '] .dlx-cat{border:0;cursor:pointer;font:600 11px/1 inherit;padding:6px 9px;border-radius:999px;background:rgba(128,128,128,.14);color:inherit;opacity:.75}[' + ROOT + '] .dlx-cat.on{background:rgba(128,128,128,.34);opacity:1}[' + ROOT + '] .dlx-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;max-height:340px;overflow:auto}[' + ROOT + '] .dlx-i{display:block;width:100%;text-align:left;cursor:pointer;border:1px solid rgba(128,128,128,.20);background:rgba(128,128,128,.07);color:inherit;border-radius:9px;padding:9px 10px;font:500 12px/1.25 inherit}[' + ROOT + '] .dlx-i:hover{background:rgba(128,128,128,.18);border-color:rgba(128,128,128,.4)}@media(max-width:820px){[' + ROOT + '] .dlx-grid{grid-template-columns:1fr;max-height:300px}}';
    (document.head || document.documentElement).appendChild(s);
  }
  function catalog() { var all = document.querySelectorAll('[data-dl-catalog]'), i; for (i = 0; i < all.length; i++) if (visible(all[i])) return all[i]; for (i = 0; i < all.length; i++) if (visible(all[i].parentElement)) return all[i]; return all[0] || null; }
  function actionRow(old) {
    var host = old && old.parentElement, btns, i, row, t, d; if (!host) return null; btns = host.querySelectorAll('button');
    for (i = 0; i < btns.length; i++) { if (norm(btns[i].textContent).indexOf('применить') < 0) continue; row = btns[i].parentElement; for (d = 0; row && d < 6; d++, row = row.parentElement) { t = norm(row.textContent); if (t.indexOf('отмена') >= 0 && t.indexOf('вернуть') >= 0 && t.indexOf('применить') >= 0 && t.length < 520) return row; if (row === host) break; } }
    return null;
  }
  function commonParent(a, b) { for (var p = a && a.parentElement; p; p = p.parentElement) if (p.contains && p.contains(b)) return p; return null; }
  function directChild(parent, node) { while (node && node.parentElement && node.parentElement !== parent) node = node.parentElement; return node && node.parentElement === parent ? node : null; }
  function place(root, old) {
    var row = actionRow(old), host = old.parentElement, parent, slot;
    if (row) { parent = commonParent(old, row); slot = parent && directChild(parent, row); if (parent && slot && visible(parent)) { parent.insertBefore(root, slot); if (visible(root)) return; } }
    host.insertBefore(root, old);
  }
  function openState() { try { var v = localStorage.getItem(OPEN); return v === null || v === '1'; } catch (e) { return true; } }
  function setOpen(v) { try { localStorage.setItem(OPEN, v ? '1' : '0'); } catch (e) {} }
  function build(old) {
    var api = window.DLBlocks, list = api && api.items || [], cats = api && api.cats || []; if (!old || !old.parentNode || !list.length) return null;
    var root = document.createElement('div'); root.setAttribute(ROOT, '1');
    var head = document.createElement('div'); head.className = 'dlx-head'; head.innerHTML = '<span>Расширенное меню блоков</span><span class="dlx-n"></span><span class="dlx-caret"></span>'; root.appendChild(head);
    var body = document.createElement('div'); body.className = 'dlx-body'; root.appendChild(body);
    var q = document.createElement('input'); q.className = 'dlx-q'; q.type = 'search'; q.placeholder = 'Поиск: тариф, отзыв, форма, таблица…'; body.appendChild(q);
    var chips = document.createElement('div'); chips.className = 'dlx-cats'; body.appendChild(chips); var grid = document.createElement('div'); grid.className = 'dlx-grid'; body.appendChild(grid);
    var active = '', query = '';
    function open(v) { body.style.display = v ? '' : 'none'; head.querySelector('.dlx-caret').textContent = v ? '▾' : '▸'; setOpen(v); }
    function paint() { grid.textContent = ''; var shown = 0, i, it, words; for (i = 0; i < list.length; i++) { it = list[i]; words = norm((it.name || '') + ' ' + (it.tags || '') + ' ' + (it.id || '')); if ((active && it.cat !== active) || (query && words.indexOf(query) < 0)) continue; shown++; var b = document.createElement('button'); b.type = 'button'; b.className = 'dlx-i'; b.textContent = it.name; b.title = 'Вставить: ' + it.name; b.setAttribute('data-dlx-id', it.id); grid.appendChild(b); } head.querySelector('.dlx-n').textContent = shown + ' из ' + list.length; }
    function chip(id, title) { var b = document.createElement('button'); b.type = 'button'; b.className = 'dlx-cat'; b.textContent = title; b.setAttribute('data-dlx-cat', id || ''); chips.appendChild(b); }
    function markChips() { var cs = chips.querySelectorAll('.dlx-cat'); for (var i = 0; i < cs.length; i++) cs[i].classList.toggle('on', (cs[i].getAttribute('data-dlx-cat') || '') === active); }
    chip('', 'Все'); for (var i = 0; i < cats.length; i++) chip(cats[i][0], cats[i][1]); open(openState()); markChips(); paint();
    head.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); open(body.style.display === 'none'); }); q.addEventListener('input', function () { query = norm(q.value); paint(); }); q.addEventListener('keydown', function (e) { e.stopPropagation(); });
    chips.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('.dlx-cat'); if (!b) return; e.preventDefault(); e.stopPropagation(); active = b.getAttribute('data-dlx-cat') || ''; markChips(); paint(); });
    grid.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-dlx-id]'); if (!b) return; e.preventDefault(); e.stopPropagation(); insert(b.getAttribute('data-dlx-id'), !!e.altKey); });
    place(root, old); return root;
  }
  function clearLegacy() { var nodes = document.querySelectorAll('[data-dl-bf],[' + ROOT + ']'); for (var i = 0; i < nodes.length; i++) if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]); }
  function mount() { var old = catalog(); stylePanel(); clearLegacy(); var root = build(old); mounted = !!root && visible(root); return mounted; }
  function adopt() { var api = window.DLBlocks; if (api) api.insert = function (id) { return insert(id, false); }; }
  function boot() { adopt(); mount(); }
  var tries = 0; function retry() { boot(); if (!mounted && ++tries < 24) setTimeout(retry, 250); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', retry); else retry();
  window.addEventListener('load', function () { setTimeout(boot, 180); setTimeout(boot, 900); });
  document.addEventListener('click', function (e) { var t = e.target && e.target.closest && e.target.closest('button,[role="tab"]'); if (t && norm(t.textContent) === 'блоки') setTimeout(boot, 80); }, true);
  window.DLBlocksFix = { mount: boot, insert: function (id) { return insert(id, false); }, items: function () { return (window.DLBlocks && window.DLBlocks.items) || []; } };
  window.dlBlocksFix = function () { return { panel: mounted, visible: visible(document.querySelector('[' + ROOT + ']')), catalog: ((window.DLBlocks && window.DLBlocks.items) || []).length, frame: !!preview(), last: last }; };
})();
