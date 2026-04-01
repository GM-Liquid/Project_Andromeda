import { FullSlug, resolveRelative } from '../util/path';
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from './types';
import {
  getRulebookFirstChapter,
  getRulebookHeaderEntries,
  isRulebookSlug
} from '../util/rulebook';
import style from './styles/rulebookHeader.scss';

function isActive(currentSlug: FullSlug, targetSlug: FullSlug) {
  return currentSlug === targetSlug || currentSlug.startsWith(`${targetSlug}/`);
}

export default (() => {
  const RulebookHeader: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
    const currentSlug = fileData.slug;
    if (!isRulebookSlug(currentSlug)) {
      return null;
    }

    const firstChapter = getRulebookFirstChapter();
    const navEntries = getRulebookHeaderEntries();
    const brandHref = resolveRelative(currentSlug, firstChapter?.slug ?? currentSlug);

    return (
      <div class="rulebook-header-shell">
        <div class="rulebook-header-brand">
          <a href={brandHref}>
            <span class="rulebook-header-kicker">Книга правил</span>
            <strong>Project Andromeda</strong>
          </a>
        </div>
        <nav class="rulebook-header-nav" aria-label="Основные разделы книги">
          {navEntries.map((entry) => (
            <a
              key={entry.slug}
              class={isActive(currentSlug, entry.slug) ? 'active' : ''}
              href={resolveRelative(currentSlug, entry.slug)}
            >
              {entry.navTitle}
            </a>
          ))}
        </nav>
      </div>
    );
  };

  RulebookHeader.css = style;
  return RulebookHeader;
}) satisfies QuartzComponentConstructor;
