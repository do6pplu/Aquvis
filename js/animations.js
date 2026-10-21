/* ===================================================================
   Анимации сайта «Аквамарин» — библиотека Motion (motion.dev), наследница Framer Motion
   без React. Подключается с jsDelivr в каждой странице ПЕРЕД этим файлом:
     <script src="https://cdn.jsdelivr.net/npm/motion@12.43.0/dist/motion.js" ...>
   и даёт глобальный объект window.Motion (animate, inView, stagger, hover, press).

   Почему отдельный файл, а не раздел в script.js:
   анимации — необязательное «украшение» поверх готового сайта. Если файл (или Motion с CDN)
   не загрузился, сайт работает и выглядит ровно так же, только без движения.
   Порядок: jquery → (swiper) → motion → script.js → animations.js, все с defer —
   выполняются строго по очереди. Код ниже запускается через $(function () { ... }) —
   ПОСЛЕ основного script.js (его обработчик готовности стоит в очереди раньше),
   поэтому «бургер», корзина и окна уже настроены.

   Главные правила:
   1) Ничего не прячем, пока не убедились, что Motion загрузился и пользователь не просил
      «уменьшить движение» (prefers-reduced-motion) — иначе всё сразу видно без анимаций.
      Признак «анимации включены» — класс js-motion у <html>.
   2) Двигаем только transform и opacity (и blur для заголовков — только на десктопе) — это дёшево
      для видеокарты и не сдвигает раскладку (нет «прыжков» страницы, CLS = 0).
      На телефонах и планшетах (< 1024px или экран без мыши) размытие НЕ анимируем: filter: blur()
      перерисовывается каждый кадр и на телефоне давал заметные подтормаживания (r16).
   5) При загрузке сначала всё ИЗМЕРЯЕМ, потом всё МЕНЯЕМ (без чередования «прочитал — записал»,
      иначе браузер пересчитывает стили на каждом элементе), один наблюдатель inView на все блоки,
      а то, что нужно только после касания (кнопки, окна, меню), настраиваем, когда браузер свободен.
   3) После окончания анимации стираем всё, что записали в style="...": конечный вид
      страницы — ровно тот же, что без анимаций (до пикселя), а :hover из CSS снова работает.
   4) Не трогаем transform у слайдов Swiper и у элементов, у которых transform уже задан в CSS
      (иначе сломали бы их положение) — им достаётся только плавное появление (opacity).

   Содержание:
     1. Помощники
     2. Появление страницы: шапка, первый экран (главная), заголовки страниц
     3. Появление блоков при прокрутке (один раз)
     4. Слайдер «Новости и акции»: мягкое появление афиш
     5. Мобильное меню: ссылки появляются по очереди и так же уходят
     6. Всплывающие окна: появление и исчезновение (масштаб + прозрачность)
     7. Корзина: счётчик в шапке «подпрыгивает» при добавлении товара
     8. Кнопки: пружинка при наведении (мышь) и нажатии (палец), «волна» по кнопке
   =================================================================== */
$(function () {
  const M = window.Motion;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // нет библиотеки (CDN недоступен) или пользователь просит без анимаций — ничего не делаем
  if (!M || typeof M.animate !== 'function' || reduce) return;
  const { animate, inView, stagger, hover, press } = M;
  // телефон/планшет: узкий экран или экран без мыши — там без размытия (см. правило 2)
  const lite = window.matchMedia('(max-width: 1023.98px), (hover: none)').matches;
  // «когда браузер свободен» (но не позже чем через 0,4 с): requestIdleCallback, в Safari его нет — setTimeout
  const idle = (fn) => (window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout: 400 }) : setTimeout(fn, 1));
  const root = document.documentElement;
  root.classList.add('js-motion');

  /* ================================================================
     1. Помощники
     ================================================================ */
  // «морская» кривая: быстрый старт и долгое мягкое торможение (как волна, накатывающая на берег)
  const EASE = [0.22, 1, 0.36, 1];

  // у элемента уже есть transform в CSS (например, translateX(-50%) для центровки)?
  const hasOwnTransform = (el) => getComputedStyle(el).transform !== 'none';

  // стереть всё, что анимация оставила в style="..." — вернуть элемент под управление CSS.
  // Motion записывает конечные значения в style уже ПОСЛЕ того, как обещание анимации выполнено,
  // поэтому чистим кадром позже (requestAnimationFrame)
  const clean = (el) => {
    requestAnimationFrame(() => {
      ['opacity', 'transform', 'filter', 'will-change'].forEach((prop) => el.style.removeProperty(prop));
    });
  };

  // сыграть анимацию и по окончании убрать следы; возвращает обещание (then)
  const play = (el, keyframes, options) => {
    const controls = animate(el, keyframes, options);
    return controls.then(() => clean(el));
  };

  // элемент уже на экране (хотя бы частично)?
  // inView смотрит только по вертикали: при ширине окна 1024–1239 десктопная вёрстка шире экрана,
  // и правый край (например, контакты в подвале) иначе никогда бы не «заехал» в окно
  const SIDE = '0px 10000px';

  const onScreen = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;
  };

  // «проявление» элемента: снизу вверх, из прозрачности; у кого свой transform — только opacity
  // ownTransform уже измерен заранее (раздел 3) — тогда браузеру не нужно пересчитывать стили
  const ownTransform = new WeakMap();
  const reveal = (el, delay, y = 28) => {
    const frames = { opacity: [0, 1] };
    const own = ownTransform.has(el) ? ownTransform.get(el) : hasOwnTransform(el);
    if (!own) frames.y = [y, 0];
    return play(el, frames, { duration: 0.6, delay, ease: EASE });
  };

  // размытие → резкость (только десктоп: на телефоне {} — без filter);
  // если у элемента уже есть filter (неоновое свечение) — добавляем blur к нему
  const blurFrames = (el, px) => {
    if (lite) return {};
    const base = getComputedStyle(el).filter;
    const own = base && base !== 'none' ? `${base} ` : '';
    return { filter: [`${own}blur(${px}px)`, `${own}blur(0px)`] };
  };

  // Кнопки: измеряем заранее, ДО анимаций появления. Иначе к моменту настройки (раздел 8,
  // «когда браузер свободен») у кнопок первого экрана ещё идёт своя анимация с transform,
  // и они ошибочно считались бы кнопками «со своим transform» — без пружинки
  const BUTTONS = '.btn, .btn-small, .cart-btn, .crud__btn, .counter__btn, .menu__tab, .filters__btn';
  const buttons = [...document.querySelectorAll(BUTTONS)].filter((b) =>
    !b.closest('.swiper, .header__nav') && !hasOwnTransform(b));

  /* ================================================================
     2. Появление страницы
     ================================================================ */
  // шапка: логотип, пункты меню, иконки и «бургер» по очереди спускаются сверху.
  // Саму шапку и .header__inner не двигаем: transform у них сделал бы шапку «рамкой»
  // для полноэкранного меню (position: fixed внутри) и сломал бы его
  const headerParts = [];
  document.querySelectorAll('.header').forEach((header) => {
    header.querySelectorAll('.header__logo, .header__nav > .nav > li, .header__actions > *, .header__burger')
      .forEach((el) => { if (el.getClientRects().length && !el.hidden) headerParts.push(el); });
  });
  if (headerParts.length) {
    animate(headerParts, { opacity: [0, 1], y: [-14, 0] }, { duration: 0.45, delay: stagger(0.04), ease: EASE })
      .then(() => headerParts.forEach(clean));
  }

  // главная: большой логотип-вывеска проявляется из размытия, кнопки «выпрыгивают» на пружинке
  const heroTitle = document.querySelector('.hero__title');
  if (heroTitle) {
    // на десктопе вывеска центрируется через transform: translateX(-50%) — масштаб дописываем
    // к её собственному transform, иначе на время анимации она уезжала бы вправо
    const own = getComputedStyle(heroTitle).transform;
    const zoom = own && own !== 'none'
      ? { transform: [own + ' scale(1.04)', own + ' scale(1)'] }
      : { scale: [1.04, 1] };
    play(heroTitle, { opacity: [0, 1], ...zoom, ...blurFrames(heroTitle, 14) },
      { duration: 0.7, delay: 0.1, ease: EASE });
  }
  const heroButtons = [...document.querySelectorAll('.hero__buttons > .btn')];
  heroButtons.forEach((btn, i) => {
    btn.style.opacity = '0';
    const delay = 0.4 + i * 0.1;
    animate(btn, { opacity: [0, 1] }, { duration: 0.3, delay });
    animate(btn, { y: [26, 0], scale: [0.9, 1] }, { type: 'spring', stiffness: 260, damping: 17, delay })
      .then(() => clean(btn));
  });

  // заголовки страниц («Меню», «Корзина»…) — тоже из лёгкого размытия
  // (сначала измеряем все заголовки, потом запускаем — без чередования чтения и записи)
  [...document.querySelectorAll('.page-head__title')].filter(onScreen).forEach((title) => {
    play(title, { opacity: [0, 1], y: [18, 0], ...blurFrames(title, 8) },
      { duration: 0.6, delay: 0.15, ease: EASE });
    title.dataset.motionDone = '1';
  });

  /* ================================================================
     3. Появление блоков при прокрутке
     ================================================================ */
  // что «проявляется» при прокрутке (все страницы; чего нет на странице — просто не найдётся)
  const REVEAL = [
    // главная
    '.about__content > *', '.about__gallery', '.album__item', '.promo__title',
    '.eat__content > *', '.eat__photo', '.contacts__title', '.contacts__info > *', '.contacts__map-wrap',
    // меню и бар
    '.menu__controls', '.card', '.drink',
    // корзина и заказ
    '.cart__toolbar', '.cart-item', '.summary', '.addons__title', '.addon', '.order-item', '.review',
    // личный кабинет, CRUD
    '.profile', '.history__title', '.history__card', '.crud__table',
    // фото
    '.album__head', '.report__item', '.pagination',
    // заголовки разделов ниже первого экрана и подвал
    '.page-head__title', '.footer__inner > *',
  ].join(', ');

  // не анимируем дважды вложенные друг в друга элементы, элементы шапки/окон и слайды Swiper
  const targets = [...document.querySelectorAll(REVEAL)].filter((el) =>
    !el.dataset.motionDone && !el.closest('.header, .js-modal, .swiper-slide') &&
    !(el.parentElement && el.parentElement.closest(REVEAL)));

  // элементы, которые попали на экран в одном кадре, появляются «лесенкой» (stagger)
  let batch = [];
  const flush = () => {
    const items = batch;
    batch = [];
    items.forEach((el, i) => reveal(el, Math.min(i, 6) * 0.07));
  };
  const queue = (el) => {
    if (!batch.length) requestAnimationFrame(flush);
    batch.push(el);
  };

  // 1) только чтение: что видно сейчас, что ниже экрана, у кого свой transform
  const measured = targets.map((el) => ({
    el,
    // скрытые сейчас блоки («Читать больше», «Показать ещё») не трогаем: их показывает script.js
    shown: el.getClientRects().length > 0,
    now: onScreen(el),
    own: hasOwnTransform(el),
  })).filter((m) => m.shown);
  // 2) только запись: уже видимое — «интро» (появляется сразу после шапки), остальное прячем
  const later = [];
  let introIndex = 0;
  measured.forEach((m) => {
    ownTransform.set(m.el, m.own);
    if (m.now) {
      reveal(m.el, 0.2 + Math.min(introIndex, 6) * 0.07, 20);
      introIndex += 1;
      return;
    }
    m.el.style.opacity = '0';
    if (!m.own) m.el.style.transform = 'translateY(28px)';
    later.push(m.el);
  });
  // 3) ОДИН наблюдатель inView на все блоки: Motion сам перестаёт следить за блоком после
  // первого появления (обработчик ничего не возвращает) — анимация один раз
  if (later.length) {
    inView(later, (el) => { queue(el); }, { amount: 0.15, margin: SIDE });
  }

  /* ================================================================
     4. Слайдер «Новости и акции»
     ================================================================ */
  // Слайды двигает Swiper (transform у .swiper-slide и ленты) — их не трогаем.
  // Анимируем «картинку» афиши внутри кнопки: прозрачность и лёгкое увеличение
  document.querySelectorAll('.js-promo-slider').forEach((section) => {
    const posters = [...section.querySelectorAll('.promo-poster')].filter((p) => !hasOwnTransform(p));
    if (!posters.length || onScreen(section)) return;   // (чтение закончено — дальше только запись)
    posters.forEach((p) => { p.style.opacity = '0'; p.style.transform = 'scale(0.94)'; });
    const stop = inView(section.querySelector('.swiper') || section, () => {
      stop();
      animate(posters, { opacity: [0, 1], scale: [0.94, 1] }, { duration: 0.55, delay: stagger(0.08), ease: EASE })
        .then(() => posters.forEach(clean));
    }, { amount: 0.25, margin: SIDE });
  });

  /* Разделы 5–8 нужны только после касания/клика — настраиваем их, когда браузер свободен
     (не в одной длинной задаче с появлением страницы) */
  idle(() => {
    /* ================================================================
       5. Мобильное меню (полноэкранное, см. script.js раздел 4а)
       ================================================================ */
    // script.js сам открывает и закрывает меню (класс header--nav-open); мы только смотрим
    // за этим классом (MutationObserver) и добавляем движение.
    // Закрытие: настоящее меню скрывается сразу (как и раньше — для доступности и клавиатуры),
    // а исчезает его «призрак» — копия без id и без фокуса, которую потом удаляем
    document.querySelectorAll('.header').forEach((header) => {
      const nav = header.querySelector('.header__nav');
      const burger = header.querySelector('.header__burger');
      if (!nav || !burger) return;
      const visibleLinks = (box) => [...box.querySelectorAll('.nav__link, .dropdown__link')]
        .filter((a) => a.getClientRects().length && getComputedStyle(a).display !== 'none');
      let wasOpen = header.classList.contains('header--nav-open');

      new MutationObserver(() => {
        const open = header.classList.contains('header--nav-open');
        if (open === wasOpen) return;
        wasOpen = open;
        if (getComputedStyle(burger).display === 'none') return;   // десктоп: «бургера» нет

        if (open) {
          // ссылки «всплывают» снизу по очереди; телефон и «Забронировать» внизу — следом
          const links = visibleLinks(nav);
          animate(links, { opacity: [0, 1], y: [18, 0] }, { duration: 0.34, delay: stagger(0.03, { startDelay: 0.04 }), ease: EASE })
            .then(() => links.forEach(clean));
          const extras = [...header.querySelectorAll('.header__actions > .icon-btn--dark, .btn--header')]
            .filter((el) => getComputedStyle(el).position === 'fixed');
          if (extras.length) {
            animate(extras, { opacity: [0, 1], y: [14, 0] }, { duration: 0.3, delay: stagger(0.05, { startDelay: 0.18 }), ease: EASE })
              .then(() => extras.forEach(clean));
          }
          return;
        }

        // закрытие: «призрак» меню поверх страницы — ссылки уходят вверх, слой тает
        const ghost = nav.cloneNode(true);
        ghost.removeAttribute('id');
        ghost.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
        ghost.classList.add('header__nav--ghost');
        ghost.setAttribute('aria-hidden', 'true');
        ghost.inert = true;
        nav.after(ghost);
        const links = visibleLinks(ghost).reverse();
        animate(links, { opacity: [1, 0], y: [0, -10] }, { duration: 0.16, delay: stagger(0.015), ease: 'easeIn' });
        animate(ghost, { opacity: [1, 0] }, { duration: 0.2, delay: 0.06, ease: 'easeIn' })
          .then(() => ghost.remove());
      }).observe(header, { attributes: true, attributeFilter: ['class'] });
    });

    /* ================================================================
       6. Всплывающие окна
       ================================================================ */
    // script.js показывает окно, снимая атрибут hidden, и прячет, ставя его обратно.
    // Появление: затемнение проявляется, само окно «выплывает» с пружинкой.
    // Исчезновение: окно прячется сразу (фокус и Esc работают как раньше), тает его «призрак»
    const modalParts = (modal) => ({
      overlay: modal.querySelector('.modal__overlay'),
      box: modal.querySelector('.modal__window') || modal.querySelector(':scope > :not(.modal__overlay)'),
    });
    document.querySelectorAll('.js-modal').forEach((modal) => {
      new MutationObserver((records) => {
        const record = records[records.length - 1];
        const wasHidden = records[0].oldValue !== null;
        const isHidden = modal.hidden;
        if (wasHidden === isHidden || !record) return;
        if (!isHidden) {
          const { overlay, box } = modalParts(modal);
          if (overlay) play(overlay, { opacity: [0, 1] }, { duration: 0.22 });
          if (box) {
            animate(box, { opacity: [0, 1] }, { duration: 0.2 });
            animate(box, { scale: [0.94, 1], y: [16, 0] }, { type: 'spring', stiffness: 320, damping: 26 })
              .then(() => clean(box));
          }
          return;
        }
        const ghost = modal.cloneNode(true);
        ghost.hidden = false;
        ghost.removeAttribute('data-modal');
        ghost.classList.remove('js-modal');
        ghost.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
        ghost.removeAttribute('id');
        ghost.setAttribute('aria-hidden', 'true');
        ghost.inert = true;
        ghost.style.pointerEvents = 'none';
        document.body.append(ghost);
        const { overlay, box } = modalParts(ghost);
        if (box) animate(box, { opacity: [1, 0], scale: [1, 0.96], y: [0, 8] }, { duration: 0.18, ease: 'easeIn' });
        animate(overlay || ghost, { opacity: [1, 0] }, { duration: 0.22, ease: 'easeIn' })
          .then(() => ghost.remove());
      }).observe(modal, { attributes: true, attributeFilter: ['hidden'], attributeOldValue: true });
    });

    /* ================================================================
       7. Корзина: счётчик в шапке
       ================================================================ */
    // script.js пишет новое число в .js-cart-count; если число выросло — «подпрыгивание» на пружинке
    document.querySelectorAll('.js-cart-count').forEach((count) => {
      let last = Number(count.textContent) || 0;
      new MutationObserver(() => {
        const now = Number(count.textContent) || 0;
        if (now > last && !hasOwnTransform(count)) {
          animate(count, { scale: [1, 1.55, 1] }, { duration: 0.45, ease: EASE }).then(() => clean(count));
        }
        last = now;
      }).observe(count, { childList: true, characterData: true, subtree: true });
    });

    /* ================================================================
       8. Кнопки: пружинка и «волна»
       ================================================================ */
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const springy = { type: 'spring', stiffness: 420, damping: 22 };
    // (список кнопок измерен в начале — см. «Кнопки: измеряем заранее»)

    // пружина возвращает кнопку к scale 1 и потом стирает style — снова работает чистый CSS
    const settle = (el) => animate(el, { scale: 1 }, springy).then(() => {
      if (!el.matches(':hover') || !canHover) clean(el);
    });

    buttons.forEach((btn) => {
      // наведение мышью (только устройства с настоящей мышью): кнопка чуть «надувается»
      if (canHover) {
        hover(btn, () => {
          animate(btn, { scale: 1.035 }, springy);
          return () => settle(btn);
        });
      }
      // нажатие (мышь или палец): кнопка «проседает» и пружинит обратно
      press(btn, () => {
        animate(btn, { scale: 0.95 }, { duration: 0.12, ease: 'easeOut' });
        return () => settle(btn);
      });
    });

    // «волна» — светлый круг расходится от места касания по большим кнопкам (как круги на воде)
    document.querySelectorAll('.btn').forEach((btn) => {
      if (btn.closest('.swiper')) return;
      btn.addEventListener('pointerdown', (event) => {
        const rect = btn.getBoundingClientRect();
        const ownPosition = getComputedStyle(btn).position;
        if (ownPosition === 'static') btn.style.position = 'relative';   // рамка для слоя волны
        const layer = document.createElement('span');
        layer.className = 'ripple';
        layer.setAttribute('aria-hidden', 'true');
        const dot = document.createElement('span');
        dot.className = 'ripple__dot';
        const size = Math.max(rect.width, rect.height) * 2.2;
        dot.style.width = `${size}px`;
        dot.style.height = `${size}px`;
        dot.style.left = `${event.clientX - rect.left - size / 2}px`;
        dot.style.top = `${event.clientY - rect.top - size / 2}px`;
        layer.append(dot);
        btn.append(layer);
        animate(dot, { scale: [0, 1], opacity: [0.45, 0] }, { duration: 0.6, ease: EASE }).then(() => {
          layer.remove();
          if (ownPosition === 'static' && !btn.querySelector('.ripple')) btn.style.removeProperty('position');
        });
      }, { passive: true });
    });
  });   // idle — конец разделов 5–8
});
