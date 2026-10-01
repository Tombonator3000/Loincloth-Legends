// Krediteringen bruker samme meny og kontroller som OPTIONS. Innhold og lisensbevis følger også enkeltfil-bygget.
import { CREDITS, type CreditEntry } from '../data/credits';
import type { Screens, Item } from './screens';

export function escapeCreditsHtml(value: string) {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Kildelista er data, ikke HTML. Eksterne kilder åpnes i egen fane uten tilgang til spillvinduet. */
function sourceLink(url?: string) {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    return `<a class="credits-source" href="${escapeCreditsHtml(u.href)}" target="_blank" rel="noopener noreferrer">SOURCE <span aria-hidden="true">↗</span><span class="credits-link-note"> (opens a new tab)</span></a>`;
  } catch { return ''; }
}

function entry(e: CreditEntry) {
  return `<div class="credits-entry"><dt>${escapeCreditsHtml(e.name)}</dt><dd>${escapeCreditsHtml(e.detail)} ${sourceLink(e.url)}</dd></div>`;
}

export function showCredits(screens: Screens, onBack: () => void, sectionIndex = 0, pageIndex = 0, selected = 0) {
  const index = ((sectionIndex % CREDITS.length) + CREDITS.length) % CREDITS.length;
  const section = CREDITS[index];
  const pageNo = ((pageIndex % section.pages.length) + section.pages.length) % section.pages.length;
  const page = section.pages[pageNo];
  const changeSection = (dir: number) => showCredits(screens, onBack, index + dir, 0, 0);
  const changePage = (dir: number) => showCredits(screens, onBack, index, pageNo + dir, 1);
  const items: Item[] = [
    { label: 'SECTION', value: escapeCreditsHtml(section.title), adjust: changeSection, action: () => changeSection(1) },
    { label: 'PAGE', value: `${pageNo + 1} / ${section.pages.length}`, adjust: changePage, action: () => changePage(1), disabled: section.pages.length === 1 },
    { label: 'BACK', action: onBack },
  ];
  screens.custom(`<div class="panel credits" tabindex="-1" data-credit-section="${section.id}" data-credit-page="${pageNo}">
    <header class="credits-heading"><h2>CREDITS</h2><p class="credits-subtitle">THE PEOPLE BEHIND THE BAD DECISIONS</p></header>
    <div class="credits-content" tabindex="0" role="region" aria-label="${escapeCreditsHtml(section.title)} credits, page ${pageNo + 1}">
      <article class="credits-section"><h3 class="credits-page">${escapeCreditsHtml(page.title)}</h3>
      ${page.text ? `<pre class="credits-license">${escapeCreditsHtml(page.text)}</pre>` : `<dl class="credits-list">${(page.entries ?? []).map(entry).join('')}</dl>`}
      </article>
    </div>
    <ul class="menu rows credits-menu" aria-label="Credits navigation"></ul>
  </div>`, items, selected, onBack);

  const panel = screens.root.querySelector<HTMLElement>('.credits')!;
  const content = panel.querySelector<HTMLElement>('.credits-content')!;
  // Vanlige menyer bruker W/S og piltaster. TAB skal også kunne nå tekst, kildelenker og navigering her.
  panel.addEventListener('keydown', e => {
    if (e.key === 'Tab') e.stopPropagation();
    if ((e.target as HTMLElement).closest('a') && (e.key === 'Enter' || e.key === ' ')) e.stopPropagation();
  });
  content.addEventListener('keydown', e => {
    if (!['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) return;
    e.stopPropagation();
    e.preventDefault();
    if (e.key === 'Home') content.scrollTop = 0;
    else if (e.key === 'End') content.scrollTop = content.scrollHeight;
    else content.scrollBy({ top: (e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey) ? -1 : 1) * (e.key.startsWith('Arrow') ? 48 : content.clientHeight * 0.8) });
  });
  panel.querySelectorAll<HTMLElement>('.menu li').forEach(li => {
    li.tabIndex = 0;
    li.setAttribute('role', 'button');
    li.setAttribute('aria-disabled', String(li.classList.contains('off')));
    li.addEventListener('focus', () => li.dispatchEvent(new MouseEvent('mouseenter')));
    li.addEventListener('keydown', e => {
      if (['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(e.code)) {
        e.preventDefault();
        e.stopPropagation();
        const rows = [...panel.querySelectorAll<HTMLElement>('.menu li')];
        const dir = e.code === 'ArrowUp' || e.code === 'KeyW' ? -1 : 1;
        rows[(rows.indexOf(li) + dir + rows.length) % rows.length].focus();
        return;
      }
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      e.stopPropagation();
      li.click();
    });
  });
  panel.focus({ preventScroll: true });
}
