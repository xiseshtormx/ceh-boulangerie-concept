import { writeFile, readFile } from 'node:fs/promises';
import { foodChapters, locations } from '../presentation.js';

const root = new URL('../', import.meta.url);
const media = JSON.parse(await readFile(new URL('site-media.json', root), 'utf8'));
const safe = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
// Unprovided photography is omitted. No stock images, synthetic images, or empty frames.
function suppliedPhoto(item, base = '') {
  return item?.src && item?.alt && /^assets\//.test(item.src) && (item.source === 'user-provided' || /^https:\/\/vk\.(com|ru)\//.test(item.source || ''))
    ? `<img src="${base + safe(item.src)}" alt="${safe(item.alt)}" loading="lazy" decoding="async">` : '';
}
const head = (title, description, base = '', extraStyles = '') => `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#000000">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="icon" href="${base}assets/favicon-black.svg" type="image/svg+xml">
  <link rel="preload" href="${base}assets/golos-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="${base}styles.css">
  <link rel="stylesheet" href="${base}header.css">${extraStyles ? '\n  ' + extraStyles : ''}
  <script type="module" src="${base}app.js"></script>
</head>`;
const brand = (base = '') => `<a class="brand" href="${base || './'}" aria-label="Цех — главная"><img src="${base}assets/brand-mark.png" alt="" width="25" height="35"><span>цех</span></a>`;
const header = (base = '', menu = false) => `<a class="skip-link" href="#main">К содержимому</a>
<header class="site-header${menu ? ' menu-header' : ''}">
  ${menu ? '' : `<div class="hero-header">${brand(base)}<nav class="hero-header-links" aria-label="Навигация на первом экране"><span class="hero-nav-surface" aria-hidden="true"></span><a href="menu/">Меню</a><a href="#places">Адреса</a></nav></div>`}
  <div class="edge-nav-flight"><button class="edge-nav-toggle" type="button" popovertarget="site-navigation" aria-controls="site-navigation" aria-label="Открыть навигацию"${menu ? '' : ' inert aria-hidden="true"'}>
    <svg class="edge-nav-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.15" aria-hidden="true"><path class="nav-diamonds" d="M3 12 12 3l9 9-9 9zM11 20l9-9 9 9-9 9z"/><path class="nav-cross" d="m8 8 16 16M24 8 8 24"/></svg>
    <span class="edge-nav-label">Меню</span>
  </button></div>
  <nav class="edge-navigation" id="site-navigation" popover="auto" aria-label="Основная навигация"><a href="${menu ? './' : 'menu/'}"${menu ? ' aria-current="page"' : ''} autofocus>Меню</a><a href="${base}#places">Адреса</a><a class="edge-nav-home" href="${base || './'}">На главную</a></nav>
</header>`;
const footer = (base = '') => `<footer class="site-footer page-width">
  <div class="footer-main">${brand(base)}<div class="footer-links"><a href="https://vk.com/cehperm" target="_blank" rel="noopener noreferrer">ВКонтакте</a><a href="mailto:cehperm@mail.ru">cehperm@mail.ru</a><button data-open-credits>О проекте</button></div></div>
  <p class="legal">Пермь · Неофициальная digital-концепция</p>
</footer>`;
const dialogs = () => `<dialog class="product-dialog" id="product-dialog" aria-labelledby="product-title"><button class="dialog-close" data-close-dialog aria-label="Закрыть карточку">×</button><div id="product-content"></div></dialog>
<dialog class="credits-dialog" id="credits-dialog" aria-labelledby="credits-title"><button class="dialog-close" data-close-dialog aria-label="Закрыть информацию">×</button><h2 id="credits-title">О проекте</h2><p>Независимая концепция сайта пекарни «Цех». Это не официальный сайт компании.</p><p>Фотографии блюд и знак предоставлены пользователем. Первоначальные кадры — из <a href="https://vk.com/cehperm" target="_blank" rel="noopener noreferrer">группы «Цеха» во ВКонтакте</a>. Готовые обработанные изображения круассанов, каш и сырников предоставлены пользователем отдельно. Права на оригиналы принадлежат правообладателям.</p><p>Данные — снимок <a href="https://vx553.menuquickresto.ru/" target="_blank" rel="noopener noreferrer">публичного меню</a> от 28.10.2026. Адреса — из <a href="https://2gis.ru/perm/branches/70000001051340507" target="_blank" rel="noopener noreferrer">2ГИС</a>. Актуальные цены, наличие и часы работы уточняйте у пекарни.</p><p>Заказ и оплата — в <a href="https://cehmarket.qrbooster.ru/" target="_blank" rel="noopener noreferrer">сервисе «Цеха»</a>.</p></dialog>
<div class="toast" role="status" aria-live="polite"></div>`;

function chapter(chapter) {
  const entry = chapter.entries[0];
  return `<section class="food-chapter chapter-${chapter.layout} page-width" id="${chapter.id}" aria-labelledby="${chapter.id}-title" data-chapter="${chapter.id}">
  <div class="food-copy" data-reveal><h2 id="${chapter.id}-title">${chapter.title}</h2><p>${chapter.description.replaceAll('\n', '<br>')}</p>
  ${chapter.entries.length > 1 ? `<div class="food-options" role="group" aria-label="Выбрать блюдо: ${chapter.title}">${chapter.entries.map((item, index) => `<button data-variant="${index}" aria-pressed="${index === 0}">${item.label}</button>`).join('')}</div>` : ''}
  <button class="quiet-link food-details" data-product="${entry.id}">О блюде</button></div>
  <div class="food-scene" data-reveal><img class="food-image" src="assets/dishes/${entry.image}" alt="${entry.alt}" width="${entry.width}" height="${entry.height}" loading="lazy" decoding="async"></div>
</section>`;
}
const glyphs = text => Array.from(text, character => `<span class="hero-char-mask"><span class="hero-glyph-ink">${safe(character)}</span></span>`).join('');
const typeHead = `<script>
    (() => {
      const root = document.documentElement;
      const type = new URLSearchParams(location.search).get('hero-type');
      root.dataset.heroType = /^[abc]$/.test(type || '') ? type : root.dataset.heroType || 'b';
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches && !location.hash) {
        root.classList.add('hero-type-pending');
        setTimeout(() => root.classList.remove('hero-type-pending'), 1800);
      }
      const font = document.createElement('link');
      font.rel = 'preload'; font.as = 'font'; font.type = 'font/ttf'; font.crossOrigin = '';
      font.href = root.dataset.heroType === 'c' ? 'assets/fonts/roboto-flex.ttf' : 'assets/fonts/noto-serif-display-italic-500.ttf';
      if (root.dataset.heroType !== 'a') document.head.append(font);
    })();
  </script>
  <link rel="stylesheet" href="hero-type.css">
  <script type="module" src="hero-type.js"></script>`;
const home = `${head('Цех', 'Круассаны, завтраки и кофе в Перми. Настоящие блюда «Цеха», меню и адреса пекарен.', '', '<link rel="stylesheet" href="coffee.css">\n  <link rel="stylesheet" href="about.css">\n  ' + typeHead)}
<body data-page="home">
${header()}
<main id="main">
  <section class="hero page-width" aria-labelledby="hero-title">
    <div class="hero-copy"><h1 id="hero-title" aria-label="ЗАКАЗАТЬ СЕЙЧАС"><span class="hero-type-line" aria-hidden="true"><span class="hero-word hero-word-order">${glyphs('ЗАКАЗАТЬ')}</span></span><span class="hero-type-line" aria-hidden="true"><span class="hero-word hero-word-now hero-now-roman">${glyphs('СЕЙЧАС')}</span><span class="hero-word hero-word-now hero-now-serif">${glyphs('сейчас.')}</span></span></h1><p>Выпечка, завтраки и кофе в Перми.</p></div>
    <div class="hero-visual"><img class="hero-croissant" alt="" width="3840" height="3158" fetchpriority="high" decoding="async" hidden><script src="hero.js"></script><noscript><img class="hero-croissant" src="assets/hero/croissant-salmon.png" alt="Круассан с лососем" width="3840" height="3163" fetchpriority="high" decoding="async"></noscript></div>
  </section>
  <section class="about-section" id="about" aria-labelledby="about-title">
    <div class="about-stage">
      <span class="about-letter about-letter-ts" data-about-motion aria-hidden="true">Ц</span>
      <span class="about-letter about-letter-e" data-about-motion aria-hidden="true">е</span>
      <span class="about-letter about-letter-kh" data-about-motion aria-hidden="true">х</span>
      <figure class="about-interior" data-about-motion>
        <img id="about-interior" src="assets/about/about-interior.jpg" alt="Интерьер «Цеха»: высокая входная дверь, жёлтые шторы и витрина с выпечкой" width="960" height="1280" loading="lazy" decoding="async" data-about-motion>
      </figure>
      <figure class="about-product" data-about-motion>
        <img id="about-product" src="assets/about/about-product.jpg" alt="Круассаны, печенье и две чашки кофе в жёлтой посуде на деревянном столе" width="960" height="1280" loading="lazy" decoding="async" data-about-motion>
      </figure>
      <div class="about-copy">
        <h2 id="about-title"><span class="about-line"><span data-about-motion>Не просто</span></span><span class="about-line"><span data-about-motion>булочная.</span></span></h2>
        <p class="about-italics"><span class="about-line"><span data-about-motion>Место, в которое</span></span><span class="about-line"><span data-about-motion>хочется вернуться.</span></span></p>
        <p class="about-note"><span class="about-line"><span data-about-motion>Выпечка, завтраки</span></span><span class="about-line"><span data-about-motion>и кофе в Перми.</span></span></p>
      </div>
    </div>
  </section>
  <div id="food">${foodChapters.map(chapter).join('\n')}</div>
  <section class="coffee-section coffee-cinematic" id="coffee" data-coffee-renderer="3d" aria-labelledby="coffee-title">
    <div class="coffee-story">
      <div class="coffee-pin"><div class="coffee-stage" role="img" aria-label="Белая керамическая чашка наклоняется и наполняется эспрессо."><picture><source media="(max-width: 760px)" srcset="assets/coffee/3d/poster-mobile.webp"><img class="coffee-poster" src="assets/coffee/3d/poster.webp" alt="" width="1280" height="1280" loading="lazy" decoding="async"></picture><canvas class="coffee-canvas" aria-hidden="true"></canvas></div></div>
      <div class="coffee-copy"><h2 id="coffee-title">И кофе.</h2><p>Взять с собой.<br>Или остаться ещё немного.</p><a class="quiet-link" href="menu/?category=drinks">Напитки в меню</a></div>
    </div>
    <noscript><style>#coffee .coffee-story{height:auto}#coffee .coffee-pin{position:relative;height:65svh}#coffee .coffee-stage{inset:0;transform:none}#coffee .coffee-poster{opacity:1}#coffee .coffee-copy{position:relative;opacity:1;transform:none;height:auto;min-height:280px}</style></noscript>
  </section>
  <section class="places-section page-width" id="places" aria-labelledby="places-title">
    <h2 id="places-title" data-reveal>Рядом с вами.</h2>
    <div class="locations-layout"><div class="location-preview-area" aria-hidden="true"><div class="location-preview"><img alt="" decoding="async"><img alt="" decoding="async"></div></div><div class="locations-list">${locations.map(place => {
      const photo = suppliedPhoto(media.places[place.id]);
      return `<details class="location" data-location="${place.id}"><summary><span class="location-address">${place.address}</span></summary><div class="location-content"><p>${place.description}</p><a class="quiet-link" href="${place.route}" target="_blank" rel="noopener noreferrer">Открыть в 2ГИС</a>${photo ? `<div class="location-photo">${photo}</div>` : ''}</div></details>`;
    }).join('\n')}</div></div>
  </section>
  <section class="closing page-width" aria-label="Полное меню"><h2 data-reveal><a href="menu/">Посмотреть<br>всё меню.</a></h2></section>
</main>
${footer()}
${dialogs()}
</body></html>`;

const menu = `${head('Цех', 'Выпечка, завтраки, десерты и напитки «Цеха». Поиск, составы блюд и избранное.', '../')}
<body data-page="menu">
${header('../', true)}
<main class="menu-main page-width" id="main">
  <section class="menu-intro" aria-labelledby="menu-title"><h1 id="menu-title">Меню</h1><p>Выберите то, чего хочется сегодня.</p></section>
  <div class="menu-tools"><div class="search-box"><input id="menu-search" type="search" placeholder="Найти блюдо" aria-label="Поиск по меню" autocomplete="off" maxlength="100"><button id="clear-search" aria-label="Очистить поиск" hidden>×</button></div><button id="filter-saved" class="saved-filter" aria-pressed="false">Избранное<span class="saved-count">0</span></button></div>
  <div class="menu-body"><nav class="category-nav" id="category-nav" aria-label="Категории меню"></nav><div class="menu-results"><div class="menu-results-meta" role="status" aria-live="polite" aria-atomic="true"><span id="results-label" class="sr-only">Всё меню</span><span id="results-count">Загружаем меню…</span></div><div id="menu-results"></div><noscript><p>Поиск работает с JavaScript. <a href="https://vx553.menuquickresto.ru/">Открыть меню пекарни</a>.</p></noscript><p class="menu-disclaimer">Цены из меню от 28.10.2026. Наличие и актуальную стоимость уточняйте в пекарне. Оформление заказа — в <a href="https://cehmarket.qrbooster.ru/" target="_blank" rel="noopener noreferrer">сервисе «Цеха»</a>.</p></div></div>
</main>
${footer('../')}
${dialogs()}
</body></html>`;

const tidy = html => html.replace(/[ \t]+$/gm, '');
await Promise.all([
  writeFile(new URL('index.html', root), tidy(home)),
  writeFile(new URL('menu/index.html', root), tidy(menu))
]);
// Review copies use the actual home markup and a single fixed photograph for fair A/B/C comparison.
// The live hero keeps its existing random photo selection and its untouched entrance controller.
await Promise.all(['a', 'b', 'c'].map(type => writeFile(new URL(`qa/hero-type-${type}.html`, root), tidy(home
  .replace('<html lang="ru">', `<html lang="ru" data-hero-type="${type}">`)
  .replace('<head>', '<head>\n  <base href="../">')
  .replace(/<div class="hero-visual">[\s\S]*?<\/div>/, '<div class="hero-visual"><img class="hero-croissant" data-hero-state="ready" src="assets/hero/croissant-salmon.png" alt="Круассан с лососем" width="3840" height="3163" fetchpriority="high" decoding="async"></div>')))));
console.log('Composed landing and menu');
