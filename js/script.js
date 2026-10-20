/* ===================================================================
   Общий скрипт сайта «Аквамарин» (все страницы; основа — delivery-eat) — версия на jQuery 3.7.1
   jQuery 3.7.1 подключается в каждой странице отдельным файлом js/jquery.min.js
   ПЕРЕД этим скриптом (оба с defer, поэтому выполняются строго по порядку).

   Всё запускается, когда разметка готова: $(function () { ... }) —
   это короткая запись $(document).ready(...), аналог
   document.addEventListener('DOMContentLoaded', ...).
   Каждый блок ищет свои элементы по классам js-* и ничего не делает,
   если на странице их нет (у jQuery пустой набор $() просто ничего не делает,
   поэтому многие проверки «if (element)» стали проверками «.length»).
   Никакие данные никуда не отправляются: формы только проверяются,
   корзина хранится в localStorage браузера.

   Шпаргалка «нативный JS -> jQuery», которая используется ниже:
     document.querySelector(sel)        -> $(sel).first()   (.first() — «только первый», как querySelector)
     document.querySelectorAll(sel)     -> $(sel)           (набор, с ним сразу можно работать целиком)
     root.querySelector(sel)            -> $root.find(sel).first()
     el.addEventListener('click', fn)   -> $el.on('click', fn)
     делегирование (e.target.closest)   -> $parent.on('click', '.selector', fn)  — работает и для
                                           элементов, созданных позже (карточки «Показать ещё», строки корзины)
     el.classList.add/remove/toggle/contains -> .addClass/.removeClass/.toggleClass/.hasClass
     el.textContent / el.innerHTML      -> .text() / .html()
     el.value                           -> .val()
     el.hidden / checked / disabled     -> .prop('hidden'|'checked'|'disabled')   (свойства DOM)
     el.setAttribute / getAttribute     -> .attr(name, value) / .attr(name)          (атрибуты HTML)
     el.dataset.x                       -> .data('x') — ТОЛЬКО ЧТЕНИЕ неизменяемых data-*.
                                           .data() один раз читает атрибут, превращает «1» в число 1
                                           и запоминает значение у себя (в атрибут обратно НЕ пишет).
                                           Поэтому data-*, которые меняются или нужны строкой, читаем
                                           и пишем через .attr('data-x').
     document.createElement + append    -> $('<li>', { class: '...' }).text('...'), .append(), .after()
     el.remove() / cloneNode(true)      -> .remove() / .clone()
     forEach по элементам               -> .each(function (i) { ... this ... })
                                           (вернуть false из .each = break; поэтому в .each пишем
                                           функции с фигурными скобками, чтобы случайно не вернуть false)
     el.dispatchEvent(new CustomEvent)  -> $el.trigger('имя', [данные])  (данные приходят в обработчик
                                           вторым аргументом: function (event, value) { ... })
     el.click() / el.focus() / blur()   -> .trigger('click') / .trigger('focus') / .trigger('blur')

   Почему показ/скрытие сделано через .prop('hidden', ...), а не .show()/.hide()/.fadeIn():
   .show()/.hide() пишут в style="display: ..." и не трогают атрибут hidden, а наш CSS и
   разметка завязаны именно на hidden. Плавные появления уже сделаны CSS-переходами и классами
   (is-fading, header__cart--bump, crud__row--removing), поэтому их оставляем — так страницы
   выглядят и ведут себя ровно как раньше.

   Что остаётся обычным JavaScript (у jQuery для этого нет замены, да она и не нужна):
   localStorage, JSON, setTimeout/clearTimeout, Math, Number/String, массивы (map, filter,
   find, some, reduce), URLSearchParams, document.fonts, focus({ preventScroll: true }),
   getBoundingClientRect и плавная прокрутка scrollIntoView (см. разделы 10, 13, 16).

   Содержание:
     1. Помощники (цены, склонения, localStorage, сообщения)
     2. Шрифты (пока системные — раздел пустой)
     3. Корзина: хранение в localStorage и значок в шапке
     4. Шапка: выпадающее меню «Еще...»
        4а. Шапка на узких экранах: кнопка-«бургер» (меню сворачивается)
     5. Всплывающие окна (открыть / закрыть по фону, крестику, Esc)
     6. Бронирование: выбор стола на плане зала
     7. Формы: проверка полей, маска телефона, сообщение об успехе
     8. Слайдер «Новости и акции» (Swiper) и окно акции
     9. Главная: слайдер «О нас» и «Читать больше»
    10. Меню и бар: категории, поиск, фильтры, «Подробнее», «Показать ещё»
    11. Страница корзины
    12. Страница заказа и отзыв
    13. Фото: просмотр на весь экран, страницы
    14. Личный кабинет
    15. CRUD
    16. Мелочи: «скоро появится»
   =================================================================== */

$(function () {
  'use strict';

  /* ================================================================
     1. Помощники
        Свои функции $ и $$ (обёртки над querySelector) больше не нужны —
        их заменяет сам jQuery: $('.класс'), $root.find('.класс').
        Переменные с jQuery-наборами по договорённости называем с $ в начале
        ($toast, $form), чтобы отличать их от обычных DOM-элементов и значений.
     ================================================================ */

  // 12154 -> «12 154₽» (обычный JS: Math и регулярное выражение)
  const formatPrice = (value) => Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + '₽';

  // склонение: plural(3, ['товар', 'товара', 'товаров']) -> «товара»
  const plural = (n, forms) => {
    const n10 = n % 10;
    const n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return forms[0];
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
    return forms[2];
  };

  // безопасная работа с localStorage (в приватном режиме он может быть недоступен).
  // У jQuery нет своего хранилища в браузере — localStorage используем напрямую.
  const storage = {
    get(key, fallback) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {   // ошибку не используем — просто ничего не делаем
        return fallback;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {   // ошибку не используем — просто ничего не делаем
        /* хранилище недоступно — просто ничего не сохраняем */
      }
    },
  };

  // короткое сообщение внизу экрана
  const $toast = $('.js-toast').first();
  let toastTimer = null;
  const toast = (message) => {
    if (!$toast.length) return;               // на странице нет блока — ничего не делаем
    $toast.text(message).prop('hidden', false);   // методы jQuery можно вызывать цепочкой
    // перезапуск CSS-анимации появления: снимаем animation, заставляем браузер
    // пересчитать раскладку (чтение offsetWidth у DOM-элемента $toast[0]) и возвращаем
    $toast.css('animation', 'none');
    void $toast[0].offsetWidth;
    $toast.css('animation', '');
    // таймеры — обычный JS (setTimeout/clearTimeout), в jQuery их нет
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $toast.prop('hidden', true); }, 2600);
  };

  /* ================================================================
     2. Шрифты: свой шрифт подключим в конце работы — пока системный, проверять нечего.
     ================================================================ */

  /* ================================================================
     3. Корзина: общий список товаров для всех страниц (localStorage)
        Товар: { id, name, price, unit, thumb, info, qty }
     ================================================================ */
  const CART_KEY = 'akvamarin-cart';
  const getCart = () => storage.get(CART_KEY, []);
  const cartListeners = [];

  const saveCart = (items) => {
    storage.set(CART_KEY, items);
    updateHeaderCart();
    cartListeners.forEach((listener) => listener(items));
  };

  // добавить товар (или увеличить количество, если он уже есть)
  const addToCart = (item, qty = 1) => {
    const items = getCart();
    const found = items.find((entry) => entry.id === item.id);   // обычный метод массива
    if (found) {
      found.qty += qty;
    } else {
      items.push({ ...item, qty });
    }
    saveCart(items);
    if ($headerCart.length) {
      // «подпрыгивание» значка — CSS-анимация по классу; чтобы она сыграла ещё раз,
      // снимаем класс, вызываем пересчёт раскладки и снова добавляем
      $headerCart.removeClass('header__cart--bump');
      void $headerCart[0].offsetWidth;
      $headerCart.addClass('header__cart--bump');
    }
  };

  // данные товара из data-атрибутов карточки ($el — jQuery-набор).
  // Читаем через .attr('data-...'), а не .data(): у раскрытой карточки эти атрибуты
  // переписываются (раздел 10), а .data() запомнил бы старые значения.
  const itemFromData = ($el) => ({
    id: $el.attr('data-id'),
    name: $el.attr('data-name'),
    price: Number($el.attr('data-price')),
    unit: $el.attr('data-unit') || '',
    thumb: $el.attr('data-thumb') || '',
    info: $el.attr('data-info') || '',
  });

  // значок корзины в шапке: виден, когда в корзине что-то есть
  const $headerCart = $('.js-header-cart').first();
  // на странице заказа кнопка видна всегда (в разметке у неё нет hidden)
  const headerCartAlways = $headerCart.length ? !$headerCart.prop('hidden') : false;
  function updateHeaderCart() {
    if (!$headerCart.length) return;
    const count = getCart().reduce((sum, item) => sum + item.qty, 0);
    $headerCart.find('.js-cart-count').first().text(count > 0 ? String(count) : '');
    $headerCart.prop('hidden', !headerCartAlways && count === 0);
    $headerCart.attr('aria-label', count > 0 ? `Корзина: ${count} ${plural(count, ['товар', 'товара', 'товаров'])}` : 'Корзина');
  }
  updateHeaderCart();

  // если корзину поменяли в другой вкладке — обновляем значок.
  // $(window).on(...) вместо window.addEventListener(...); у jQuery-события
  // исходное событие браузера лежит в event.originalEvent (там и есть key)
  $(window).on('storage', (event) => {
    if (event.originalEvent.key === CART_KEY) {
      updateHeaderCart();
      cartListeners.forEach((listener) => listener(getCart()));
    }
  });

  /* ================================================================
     4. Шапка: выпадающее меню «Еще...»
        .each перебирает набор; внутри this — текущий DOM-элемент, $(this) — он же в jQuery
     ================================================================ */
  $('.js-dropdown').each(function () {
    const $dropdown = $(this);
    const $toggle = $dropdown.find('.js-dropdown-toggle').first();
    const $menu = $dropdown.find('.js-dropdown-menu').first();
    const setOpen = (open) => {
      $menu.prop('hidden', !open);
      $toggle.attr('aria-expanded', String(open));
    };
    $toggle.on('click', (event) => {
      event.stopPropagation();   // клик по кнопке не должен дойти до document (там закрытие)
      setOpen($menu.prop('hidden'));
    });
    // клик в любом месте страницы вне меню — закрыть.
    // $(event.target).closest($dropdown).length === 0 — «клик был не внутри меню»
    // (нативно: !dropdown.contains(event.target))
    $(document).on('click', (event) => {
      if (!$(event.target).closest($dropdown).length) setOpen(false);
    });
    $dropdown.on('keydown', (event) => {
      if (event.key === 'Escape' && !$menu.prop('hidden')) {
        setOpen(false);
        $toggle.trigger('focus');   // нативно: toggle.focus()
      }
    });
  });

  /* ================================================================
     4а. Шапка на узких экранах (< 1024px): кнопка-«бургер»
         Кнопку создаём здесь, а не в HTML: на десктопе она скрыта (display: none в CSS),
         а без JS меню просто остаётся раскрытым — ничего не теряется.
         Состояние — класс header--nav-open у шапки и aria-expanded у кнопки.
     ================================================================ */
  $('.header').each(function () {
    const $header = $(this);
    const $nav = $header.find('.header__nav').first();
    if (!$nav.length) return;
    const navId = $nav.attr('id') || 'site-nav';
    $nav.attr('id', navId);
    const $burger = $(`<button class="header__burger" type="button" aria-expanded="false" aria-controls="${navId}" aria-label="Меню">
        <span class="header__burger-line"></span><span class="header__burger-line"></span><span class="header__burger-line"></span>
      </button>`);
    $header.find('.header__inner').first().append($burger);
    $header.addClass('header--has-burger');

    // открытое меню — слой во весь экран; страницу под ним блокируем (класс is-nav-open у <html>)
    const setOpen = (open) => {
      $header.toggleClass('header--nav-open', open);
      // если у страницы есть обычная полоса прокрутки (компьютер), место под неё сохраняем — шапка не сдвигается
      const hasScrollbar = window.innerWidth > document.documentElement.clientWidth;
      $('html').toggleClass('is-nav-open', open)
        .toggleClass('is-nav-open--gutter', open && hasScrollbar);
      $burger.attr('aria-expanded', String(open));
    };
    $burger.on('click', (event) => {
      event.stopPropagation();   // клик по кнопке не должен дойти до document (там закрытие)
      setOpen(!$header.hasClass('header--nav-open'));
    });
    // клик вне шапки — закрыть меню
    $(document).on('click', (event) => {
      if (!$(event.target).closest($header).length) setOpen(false);
    });
    // Esc — закрыть и вернуть фокус на кнопку
    $header.on('keydown', (event) => {
      if (event.key === 'Escape' && $header.hasClass('header--nav-open')) {
        setOpen(false);
        $burger.trigger('focus');
      }
    });
    // фокус с клавиатуры не уходит под слой меню: Tab за пределы шапки возвращает к первой ссылке
    $(document).on('focusin', (event) => {
      if ($header.hasClass('header--nav-open') && !$(event.target).closest($header).length) {
        $nav.find('a').first().trigger('focus');
      }
    });
    // экран стал широким (поворот планшета, окно браузера) — меню снова обычное
    const wide = window.matchMedia('(min-width: 1024px)');
    $(wide).on('change', () => { if (wide.matches) setOpen(false); });
  });

  /* ================================================================
     5. Всплывающие окна
        Открыть: openModal('booking'). Закрыть: крестик, клик по затемнению, Esc.
     ================================================================ */
  let $openedModal = null;
  let lastFocus = null;
  const modalCloseHandlers = {};

  const openModal = (name) => {
    const $modal = $(`.js-modal[data-modal="${name}"]`).first();
    if (!$modal.length) return null;
    if ($openedModal) closeModal();
    lastFocus = document.activeElement;
    $modal.prop('hidden', false);
    $('body').addClass('is-modal-open');
    $openedModal = $modal;
    // фокус на первое поле или кнопку закрытия.
    // focus({ preventScroll: true }) — опция есть только у нативного метода,
    // .trigger('focus') её не умеет, поэтому берём DOM-элемент: $focusTarget[0]
    const $focusTarget = $modal.find('input:not([type="hidden"]), textarea, .js-modal-close.modal__close').first();
    if ($focusTarget.length) setTimeout(() => $focusTarget[0].focus({ preventScroll: true }), 30);
    return $modal;
  };

  function closeModal() {
    if (!$openedModal) return;
    const name = $openedModal.data('modal');
    $openedModal.prop('hidden', true);
    $openedModal = null;
    $('body').removeClass('is-modal-open');
    if (modalCloseHandlers[name]) modalCloseHandlers[name]();
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  // один вызов .on навешивает обработчик сразу на все крестики и затемнения всех окон
  $('.js-modal').find('.js-modal-close').on('click', closeModal);

  // Esc на всей странице: $(document).on('keydown', ...)
  // Tab внутри открытого окна ходит по кругу (фокус не уходит на страницу под затемнением)
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  $(document).on('keydown', (event) => {
    if (!$openedModal) return;
    if (event.key === 'Escape') {
      closeModal();
      return;
    }
    if (event.key !== 'Tab') return;
    const $items = $openedModal.find(FOCUSABLE).filter(':visible');
    if (!$items.length) return;
    const first = $items[0];
    const last = $items[$items.length - 1];
    const inside = $openedModal[0].contains(document.activeElement);
    if (event.shiftKey && (document.activeElement === first || !inside)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !inside)) {
      event.preventDefault();
      first.focus();
    }
  });

  /* ================================================================
     6. Бронирование: кнопки «Забронировать» открывают план зала с формой.
        Кнопка с data-table-target (карандаш «Стол №2» в заказе) — только выбор стола.
     ================================================================ */
  const $bookingModal = $('.js-modal[data-modal="booking"]').first();
  let $tableTarget = null;   // куда записать номер стола (страница заказа)

  $('.js-open-booking').on('click', function () {
    const selector = $(this).data('tableTarget');   // атрибут data-table-target
    $tableTarget = selector ? $(selector).first() : null;
    if ($tableTarget && !$tableTarget.length) $tableTarget = null;
    if ($bookingModal.length) {
      $bookingModal.find('.booking__form').first().prop('hidden', Boolean($tableTarget));
      $bookingModal.find('.modal__title').first().text($tableTarget ? 'Выберите стол' : 'Бронирование столика');
    }
    openModal('booking');
  });
  modalCloseHandlers.booking = () => {
    $tableTarget = null;
    if ($bookingModal.length) $bookingModal.find('.booking__form').first().prop('hidden', false);
  };

  const $planTables = $('.js-plan-table');
  $planTables.on('click', function () {
    $planTables.removeClass('plan__table--selected');   // сразу со всех столов, без цикла
    $(this).addClass('plan__table--selected');
    const number = $(this).data('table');   // .data() вернёт число (data-table="5" -> 5)
    $('.js-plan-value').text(`№${number}`);
    $('.js-plan-input').val(number);
    if ($tableTarget) {
      $tableTarget.text(number);
      toast(`Стол изменён на №${number}`);
      closeModal();
    }
  });

  /* ================================================================
     7. Формы: проверка полей без отправки (preventDefault) и сообщение об успехе
     ================================================================ */
  // маска телефона: +7 (999) 999-99-99
  $('.js-phone').on('input', function () {
    const $input = $(this);
    let digits = $input.val().replace(/\D/g, '');
    if (digits.startsWith('8') || digits.startsWith('7')) digits = digits.slice(1);
    digits = digits.slice(0, 10);
    if (!digits) {
      $input.val('');
      return;
    }
    let result = '+7 (' + digits.slice(0, 3);
    if (digits.length >= 3) result += ') ' + digits.slice(3, 6);
    if (digits.length >= 6) result += '-' + digits.slice(6, 8);
    if (digits.length >= 8) result += '-' + digits.slice(8, 10);
    $input.val(result);
  });

  // проверка одного поля (DOM-элемента): возвращает текст ошибки или пустую строку.
  // Свойства поля (type, required, minLength, min, max...) читаем через .prop() —
  // это то же, что field.type, field.required и т.д. (.attr вернул бы строку из HTML или undefined)
  const checkField = (field) => {
    const $field = $(field);
    const value = String($field.val() ?? '').trim();
    const type = $field.prop('type');
    if (type === 'hidden' || $field.prop('disabled')) return '';
    if ($field.prop('required') && !value) return `Заполните поле «${$field.prop('placeholder') || $field.attr('aria-label') || $field.prop('name')}»`;
    if (!value) return '';
    const minLength = $field.prop('minLength');
    if (minLength > 0 && value.length < minLength) return `Слишком коротко: «${$field.prop('placeholder') || $field.prop('name')}»`;
    if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return 'Проверьте e-mail: например, name@mail.ru';
    if (type === 'tel' && value.replace(/\D/g, '').length < 11) return 'Введите телефон полностью: +7 (999) 999-99-99';
    if (type === 'number') {
      const number = Number(value);
      const min = $field.prop('min');
      const max = $field.prop('max');
      if (min && number < Number(min)) return `Минимум — ${min}`;
      if (max && number > Number(max)) return `Максимум — ${max}`;
    }
    if (type === 'date') {
      const today = new Date();   // даты — обычный JS
      today.setHours(0, 0, 0, 0);
      if (new Date(value) < today) return 'Дата уже прошла — выберите сегодня или позже';
    }
    return '';
  };

  // дополнительные проверки и действия после успешной проверки — по типу формы
  const formHooks = [];   // { match: '.js-...', validate($form) -> ошибка, success($form) }

  // показать сообщение об успехе вместо полей формы
  const showSuccess = ($form) => {
    // .children() — прямые потомки (нативно: form.querySelectorAll(':scope > *'))
    $form.children().each(function () {
      const $child = $(this);
      // пишем именно атрибут data-was-hidden (.attr), чтобы он был виден в разметке, как раньше
      $child.attr('data-was-hidden', $child.prop('hidden') ? '1' : '');
      $child.prop('hidden', true);
    });
    // $('<div>', { ... }) создаёт новый элемент сразу с атрибутами (нативно: document.createElement)
    const $box = $('<div>', { class: 'form-success js-form-success', role: 'status' });
    const $text = $('<p>').text($form.data('success') || 'Готово!');
    const $again = $('<button>', { type: 'button', class: 'form-success__again' })
      .text($form.closest('.js-modal').length ? 'Закрыть' : 'Заполнить ещё раз');
    $again.on('click', () => {
      if ($form.closest('.js-modal').length) {
        closeModal();
      } else {
        resetForm($form);
      }
    });
    $box.append($text, $again);
    $form.append($box);
  };

  // вернуть форму в исходное состояние
  function resetForm($form) {
    const $success = $form.find('.js-form-success').first();
    if (!$success.length) return;
    $success.remove();
    $form.children().each(function () {
      $(this).prop('hidden', $(this).attr('data-was-hidden') === '1');
    });
    $form.trigger('reset');   // вызывает нативный form.reset()
    $form.find('.is-invalid').removeClass('is-invalid');
  }

  $('.js-form').each(function () {
    const $form = $(this);
    const $errorBox = $form.find('.js-form-error').first();
    $form.on('submit', (event) => {
      event.preventDefault();   // ничего не отправляем
      let firstError = '';
      let $firstField = null;
      $form.find('input, textarea, select').each(function () {
        const error = checkField(this);
        $(this).toggleClass('is-invalid', Boolean(error))   // второй аргумент: true — добавить, false — убрать
          .attr('aria-invalid', error ? 'true' : 'false');
        if (error && !firstError) {
          firstError = error;
          $firstField = $(this);
        }
      });
      // .is(selector) — «подходит ли форма под селектор» (нативно: form.matches(...))
      const hook = formHooks.find((item) => $form.is(item.match));
      if (!firstError && hook && hook.validate) firstError = hook.validate($form) || '';
      if (firstError) {
        if ($errorBox.length) {
          $errorBox.text(firstError).prop('hidden', false);
        }
        if ($firstField) $firstField.trigger('focus');
        return;
      }
      if ($errorBox.length) $errorBox.prop('hidden', true);
      if (hook && hook.success) hook.success($form);
      showSuccess($form);
    });
    // ошибка поля пропадает, как только его начинают исправлять.
    // Делегирование: обработчик на форме, но срабатывает только для полей,
    // у которых СЕЙЧАС есть класс is-invalid (this — само поле)
    $form.on('input', '.is-invalid', function () {
      if (!checkField(this)) {
        $(this).removeClass('is-invalid').attr('aria-invalid', 'false');
      }
    });
  });

  // при повторном открытии окна форма снова пустая
  $('.js-modal').each(function () {
    const $modal = $(this);
    const name = $modal.data('modal');
    const previous = modalCloseHandlers[name];
    modalCloseHandlers[name] = () => {
      if (previous) previous();
      $modal.find('.js-form').each(function () {
        const $form = $(this);
        if ($form.find('.js-form-success').length) resetForm($form);
      });
    };
  });

  // бронирование: стол обязателен
  formHooks.push({
    match: '.booking__form',
    validate: ($form) => ($form.find('.js-plan-input').first().val() ? '' : 'Выберите стол на плане зала'),
    success: ($form) => { toast(`Стол №${$form.find('.js-plan-input').first().val()} забронирован`); },
  });

  /* ================================================================
     8. Слайдер «Новости и акции» (Swiper) и окно акции
     ================================================================ */
  // Слайдер — Swiper 11 (подключён с jsDelivr в index.html), стандартная разметка:
  // .swiper > .swiper-wrapper > .swiper-slide, стрелки .swiper-button-prev/next, точки .swiper-pagination.
  // Свайп пальцем на телефонах, стрелки и точки — на всех экранах; «по кругу» (rewind), как было раньше.
  // Видно столько афиш, сколько помещается по ширине из CSS: десктоп 4, планшет 2, телефон 1.
  // Если CDN недоступен, Swiper не запускается: афиши остаются видны и листаются обычной прокруткой (см. CSS).
  $('.js-promo-slider').each(function () {
    const $section = $(this);
    const $viewport = $section.find('.swiper').first();
    const $slides = $viewport.find('.swiper-slide');
    if (typeof window.Swiper !== 'function' || !$viewport.length) return;
    let visible = 4;
    const desktop = window.matchMedia('(min-width: 1024px)');

    // сколько афиш помещается в «окне»
    const countVisible = () => {
      const step = $slides.first().outerWidth() + 22;
      visible = Math.max(1, Math.round(($viewport.innerWidth() + 22) / step));
    };

    // доступность: видимые афиши можно «потрогать» с клавиатуры, скрытые — нет; у активной точки aria-current
    const mark = (swiper) => {
      const index = swiper.snapIndex;
      $slides.each(function (i) {
        const shown = i >= index && i < index + visible;
        $(this).attr('aria-hidden', String(!shown));
        $(this).find('button').first().prop('tabIndex', shown ? 0 : -1);
      });
      $section.find('.dots__item').each(function (i) {
        $(this).attr('aria-current', i === index ? 'true' : 'false');
      });
    };

    new window.Swiper($viewport[0], {
      slidesPerView: 'auto',             // ширина афиши — из CSS
      spaceBetween: 22,                  // тот же промежуток, что был (gap 22px)
      speed: 500,                        // та же скорость, что была (0,5 с)
      rewind: true,                      // с последней позиции стрелка «вперёд» возвращает к первой (и наоборот)
      simulateTouch: false,              // мышью ленту не тянем — на десктопе всё как раньше (стрелки, точки)
      a11y: { enabled: false },          // доступность настроена своими атрибутами (aria-label, aria-hidden, tabIndex)
      navigation: {
        // стрелки стоят вне .swiper (иначе «окно» их обрежет), поэтому передаём сами элементы
        prevEl: $section.find('.swiper-button-prev')[0],
        nextEl: $section.find('.swiper-button-next')[0],
      },
      pagination: {
        el: $section.find('.swiper-pagination')[0],
        clickable: true,
        // точки — кнопки с нашими классами (вид как раньше: активная — большая тёмная)
        bulletActiveClass: 'swiper-pagination-bullet-active dots__item--active',
        renderBullet: (i, className) =>
          `<button class="${className} dots__item js-carousel-dot" type="button" aria-label="Слайд ${i + 1}"></button>`,
      },
      on: {
        init(swiper) {
          $section.addClass('promo--swiper');   // стрелки показываются только у рабочего слайдера
          countVisible();
          mark(swiper);
        },
        // на десктопе сдвиг ленты — обычный 2D translateX, как у прежней карусели:
        // translate3d от Swiper выносит ленту в отдельный слой, и края афиш сглаживаются чуть иначе
        setTranslate(swiper, translate) {
          if (desktop.matches) swiper.wrapperEl.style.transform = `translateX(${translate}px)`;
        },
        // лента встала на новую позицию (стрелка, точка или свайп)
        snapIndexChange: mark,
        // поворот экрана / смена ширины: пересчитать, сколько афиш видно
        resize(swiper) {
          countVisible();
          mark(swiper);
        },
      },
    });
  });

  // окно с подробностями акции
  $('.js-open-promo').on('click', function () {
    const $button = $(this);
    const $modal = $('.js-modal[data-modal="promo"]').first();
    if (!$modal.length) return;
    $modal.find('.js-promo-title').first().text($button.data('title'));
    $modal.find('.js-promo-text').first().text($button.data('text'));
    // афиша в окне — копия афиши с карточки (тот же текст и тот же цвет)
    const $poster = $button.find('.promo-poster').first();
    $modal.find('.js-promo-poster').first()
      .attr('class', `${$poster.attr('class')} promo-modal__img js-promo-poster`)
      .html($poster.html());
    openModal('promo');
  });

  /* ================================================================
     9. Главная: слайдер «О нашем заведении» и «Читать больше»
     ================================================================ */
  $('.js-slider').each(function () {
    const $slider = $(this);
    const $img = $slider.find('.js-slider-img').first();
    // .prop('src') — полный адрес картинки, как img.src
    const slides = ($img.data('slides') || $img.prop('src')).split('|');
    const $dots = $slider.find('.js-slider-dot');
    let index = 0;
    const go = (next) => {
      index = (next + slides.length) % slides.length;
      // смена фото с затуханием: CSS-класс is-fading + таймер (setTimeout — обычный JS).
      // .fadeOut()/.fadeIn() не используем: затухание уже описано в CSS
      $img.addClass('is-fading');
      setTimeout(() => {
        $img.attr('src', slides[index]).removeClass('is-fading');
      }, 180);
      $dots.each(function (i) { $(this).toggleClass('lines__item--active', i === index); });
    };
    // если кнопки нет, набор пустой и .on() просто ничего не сделает — проверка if не нужна
    $slider.find('.js-slider-prev').first().on('click', () => go(index - 1));
    $slider.find('.js-slider-next').first().on('click', () => go(index + 1));
    $dots.on('click', function () { go($dots.index(this)); });
  });

  $('.js-more-toggle').each(function () {
    const $button = $(this);
    // .parent() — родитель кнопки (нативно: button.parentElement)
    const $text = $button.parent().find('.js-more-text').first();
    const moreLabel = $button.text();
    $button.on('click', () => {
      $text.prop('hidden', !$text.prop('hidden'));
      $button.text($text.prop('hidden') ? moreLabel : $button.data('less'));
      $button.attr('aria-expanded', String(!$text.prop('hidden')));
    });
  });

  /* ================================================================
     10. Меню и Барная карта
     ================================================================ */
  const TAG_LABELS = {
    veg: ['Фильтр 1', true],      // названия фильтров — заглушки
    chef: ['Фильтр 2', false],
    popular: ['Фильтр 3', false],
    under400: ['Фильтр 4', false],
    shots400: ['Фильтр 5', false],
  };

  // фото-слайдер карточки: точки переключают ракурс фото.
  // Делегирование на document: работает и в карточках, которые добавит «Показать ещё»
  const PHOTO_VIEWS = [
    { position: '50% 50%', zoom: false },
    { position: '25% 35%', zoom: true },
    { position: '75% 65%', zoom: true },
  ];
  $(document).on('click', '.js-photo-dot', function () {
    const $slider = $(this).closest('.js-photo-slider');
    const $img = $slider.find('.js-photo-slider-img').first();
    const $dots = $slider.find('.js-photo-dot');
    const i = $dots.index(this);
    $dots.each(function (j) { $(this).toggleClass('mini-dots__item--active', j === i); });
    $img.css('object-position', PHOTO_VIEWS[i].position)   // нативно: img.style.objectPosition = ...
      .toggleClass('is-zoomed', PHOTO_VIEWS[i].zoom);
  });

  // подсказка «?»: по наведению/фокусу её показывает CSS, тут — клик (для сенсорных экранов) и Esc.
  // Здесь нужен ЛЮБОЙ клик (чтобы закрыть открытые подсказки), поэтому без селектора-делегата
  $(document).on('click', (event) => {
    const $btn = $(event.target).closest('.js-tooltip-btn');
    const ownTip = $btn.length ? $btn.closest('.js-tooltip')[0] : null;
    $('.tooltip--open').each(function () {
      if (this !== ownTip) $(this).removeClass('tooltip--open');
    });
    if ($btn.length) $btn.closest('.js-tooltip').toggleClass('tooltip--open');
  });
  $(document).on('keydown', (event) => {
    if (event.key === 'Escape') {
      $('.tooltip--open').removeClass('tooltip--open');
      const $focused = $(document.activeElement);
      if ($focused.hasClass('js-tooltip-btn')) $focused.trigger('blur');
    }
  });

  $('.js-catalog').each(function () {
    const $catalog = $(this);
    const $grid = $catalog.find('.js-cards').first();
    const $dish = $catalog.find('.js-dish').first();
    const hasDish = $dish.length > 0;
    const $search = $catalog.find('.js-search').first();
    const $tagsList = $catalog.find('.js-tags').first();
    const $panel = $catalog.find('.js-filters-panel').first();
    const $panelToggle = $catalog.find('.js-filters-toggle').first();
    const $empty = $catalog.find('.js-empty').first();
    const $categories = $catalog.find('.js-category');
    const state = { category: null, query: '' };
    // карточки ищем каждый раз заново: «Показать ещё» открывает отложенные
    const $cards = () => $grid.find('.js-card');
    // .map(...).get() — собрать из набора обычный массив значений
    const activeTags = () => $tagsList.find('.js-tag').map(function () { return $(this).attr('data-tag'); }).get();

    // подсветка найденного текста в названии
    const highlight = ($card, query) => {
      const $title = $card.find('.card__title span, .drink__title').first();
      const name = $card.data('name');
      const at = query ? name.toLowerCase().indexOf(query) : -1;
      if (at < 0) {
        $title.text(name);
        return;
      }
      // куски названия добавляем как ТЕКСТ (document.createTextNode): строку .append()
      // jQuery мог бы разобрать как HTML. <mark> создаём через jQuery и заполняем .text()
      $title.empty().append(
        document.createTextNode(name.slice(0, at)),
        $('<mark>').text(name.slice(at, at + query.length)),
        document.createTextNode(name.slice(at + query.length)),
      );
    };

    // главная функция: кто из карточек виден
    const apply = () => {
      const tags = activeTags();
      let shown = 0;
      $cards().each(function () {
        const $card = $(this);
        const categories = ($card.attr('data-category') || '').split('|');
        const cardTags = ($card.attr('data-tags') || '').split('|');
        const okCategory = !state.category || categories.includes(state.category);
        const okQuery = !state.query || $card.data('name').toLowerCase().includes(state.query);
        // карточка подходит, если у неё есть хотя бы один из выбранных фильтров
        const okTags = tags.length === 0 || tags.some((tag) => cardTags.includes(tag));
        const isVisible = okCategory && okQuery && okTags && !$card.is('[data-more]');
        $card.prop('hidden', !isVisible);
        highlight($card, state.query);
        if (isVisible) shown += 1;
      });
      if ($empty.length) $empty.prop('hidden', shown > 0);
      // раскрытая карточка пропадает вместе со «своей» карточкой.
      // «Хозяина» раскрытой карточки храним через .data('owner', элемент) (нативно было dish.owner)
      const owner = hasDish ? $dish.data('owner') : null;
      if (hasDish && !$dish.prop('hidden') && owner && owner.hidden) closeDish();
    };

    // --- категории ---
    $categories.on('click', function () {
      const button = this;
      const category = $(button).data('category');
      const same = state.category === category;
      state.category = same ? null : category;
      $categories.each(function () {
        const on = this === button && !same;
        $(this).toggleClass('categories__link--active', on).attr('aria-pressed', String(on));
      });
      apply();
    });

    // --- поиск «на лету» ---
    if ($search.length) {
      $search.on('input', () => {
        state.query = $search.val().trim().toLowerCase();
        apply();
      });
      $catalog.find('.js-search-btn').first().on('click', () => { $search.trigger('focus'); });
    }

    // --- «таблетки» фильтров ---
    const makeTag = (key, label, green) => {
      const $remove = $('<button>', {
        type: 'button',
        class: 'tag__remove js-tag-remove',
        'aria-label': `Убрать фильтр «${label}»`,
      }).html('<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>');
      // .text() кладёт подпись как текст, .append() добавляет крестик после неё
      return $('<li>', { class: 'tag js-tag' + (green ? ' tag--green' : ''), 'data-tag': key })
        .text(label + ' ')
        .append($remove);
    };
    const syncPanel = () => {
      const tags = activeTags();
      $catalog.find('.js-filter-option').each(function () {
        $(this).prop('checked', tags.includes($(this).val()));
      });
    };
    // делегирование: крестики появляются и исчезают, а обработчик один — на списке
    $tagsList.on('click', '.js-tag-remove', function () {
      $(this).closest('.js-tag').remove();
      syncPanel();
      apply();
    });

    // --- панель «Фильтры» ---
    const setPanel = (open) => {
      $panel.prop('hidden', !open);
      $panelToggle.attr('aria-expanded', String(open));
    };
    $panelToggle.on('click', (event) => {
      event.stopPropagation();
      setPanel($panel.prop('hidden'));
    });
    $(document).on('click', (event) => {
      if (!$panel.prop('hidden') && !$(event.target).closest($panel).length) setPanel(false);
    });
    $(document).on('keydown', (event) => {
      if (event.key === 'Escape' && !$panel.prop('hidden')) setPanel(false);
    });
    $catalog.find('.js-filter-option').on('change', function () {
      const $option = $(this);
      const value = $option.val();
      const $existing = $tagsList.find(`.js-tag[data-tag="${value}"]`).first();
      // data-green="0"/"1" читаем .attr: .data('green') вернул бы число, и сравнение с '1' не сработало бы
      if ($option.prop('checked') && !$existing.length) {
        $tagsList.append(makeTag(value, $option.data('label'), $option.attr('data-green') === '1'));
      } else if (!$option.prop('checked') && $existing.length) {
        $existing.remove();
      }
      apply();
    });

    // «Сбросить» (в панели и в сообщении «Ничего не нашлось»)
    $catalog.find('.js-filters-reset').on('click', () => {
      $tagsList.empty();   // нативно: innerHTML = ''
      syncPanel();
      state.category = null;
      state.query = '';
      if ($search.length) $search.val('');
      $categories.removeClass('categories__link--active').attr('aria-pressed', 'false');
      setPanel(false);
      apply();
    });

    // --- раскрытая карточка «Подробнее» ---
    const $counter = hasDish ? $dish.find('.js-counter').first() : $();
    const updateDishPrice = () => {
      const qty = Number($counter.find('.js-counter-value').first().text());
      const price = Number($dish.attr('data-price'));
      $dish.find('.js-dish-price').first().text(formatPrice(price * qty));
      // вес порции — заглушка «/000г.», пока его не умножаем
      $dish.find('.js-dish-unit').first().text('/000г.');
    };

    const markActive = (card) => {
      $cards().removeClass('card--active drink--active');   // несколько классов через пробел
      if (card) {
        const $card = $(card);
        $card.addClass($card.hasClass('drink') ? 'drink--active' : 'card--active');
      }
    };

    function closeDish() {
      $dish.prop('hidden', true).data('owner', null);
      markActive(null);
    }

    const openDish = (card) => {
      const $card = $(card);
      // данные карточки -> в раскрытую карточку. Пишем именно атрибуты (.attr),
      // потому что потом их читает itemFromData и они должны быть видны в разметке
      $.each(['id', 'name', 'price', 'unit', 'thumb', 'info'], (i, key) => {
        $dish.attr('data-' + key, $card.attr('data-' + key) || '');
      });
      $dish.find('.js-dish-title').first().text($card.attr('data-name'));
      const $info = $dish.find('.js-dish-info').first().empty();
      ($card.attr('data-info') || '').split('|').forEach((part) => {
        $info.append($('<span>').text(part));
      });
      // фото: если у карточки есть настоящее фото (<img>) — показываем его,
      // иначе серая заглушка (фото этого блюда добавим позже).
      // .replaceWith() меняет старый элемент на новый (нативно: el.replaceWith(...))
      const $cardImg = $card.find('.js-photo-slider-img').first();
      const $newImg = $cardImg.is('img')
        ? $('<img>', {
          // модификатор обрезки (user-photo--crop-top) переносим с фото карточки
          class: 'dish__img js-dish-img js-photo-slider-img user-photo' + ($cardImg.hasClass('user-photo--crop-top') ? ' user-photo--crop-top' : ''),
          src: $cardImg.attr('src'),
          alt: $card.attr('data-name'),
        })
        // width/height ставим именно атрибутами (.attr): в $('<img>', {...}) jQuery превращает их
        // в .width()/.height(), то есть в style="width:960px", и фото вылезало за рамку карточки
        .attr({ width: $cardImg.attr('width'), height: $cardImg.attr('height') })
        : $('<span>', {
          class: 'ph dish__img js-dish-img js-photo-slider-img',
          role: 'img',
          'aria-label': 'Здесь будет фото',
          style: '--w:440px;--ar:440 / 550',
        });
      $dish.find('.js-dish-img').first().replaceWith($newImg);
      $dish.find('.js-photo-dot').each(function (i) { $(this).toggleClass('mini-dots__item--active', i === 0); });
      const tags = ($card.attr('data-tags') || '').split('|').filter((tag) => TAG_LABELS[tag]);
      // описание: data-text карточки, иначе её короткое описание (у напитков); нет текста — абзац скрыт,
      // а не остаётся описание другого блюда
      const text = $card.attr('data-text') || $card.find('.drink__desc').first().text() || '';
      $dish.find('.js-dish-text').first().text(text).prop('hidden', !text);
      const $tagList = $dish.find('.js-dish-tags').first().empty();
      tags.forEach((tag) => {
        $tagList.append($('<li>', { class: 'dish__tag' + (TAG_LABELS[tag][1] ? ' dish__tag--green' : '') }).text(TAG_LABELS[tag][0]));
      });
      $counter.find('.js-counter-value').first().text('1');
      updateDishPrice();

      // ставим раскрытую карточку после последней карточки того же ряда (3 в ряду).
      // .not('[hidden]') — только видимые (не путать с jQuery-фильтром :hidden — он смотрит на размеры)
      const $visibleCards = $cards().not('[hidden]');
      const position = $visibleCards.index(card);
      const $rowEnd = $visibleCards.eq(Math.min(Math.floor(position / 3) * 3 + 2, $visibleCards.length - 1));
      $rowEnd.after($dish);   // .after() переносит уже существующий элемент на новое место
      $dish.prop('hidden', false).data('owner', card);
      markActive(card);
      // положение на экране: getBoundingClientRect и плавный scrollIntoView остаются нативными.
      // $('html, body').animate({ scrollTop }) прокрутил бы с другой скоростью и без
      // выравнивания «по центру», поэтому поведение было бы уже не тем же самым
      const box = $dish[0].getBoundingClientRect();
      if (box.top < 0 || box.bottom > window.innerHeight) {
        $dish[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    if (hasDish) {
      // по умолчанию раскрыт «Название блюда 3» из первого ряда (как в макете)
      $dish.data('owner', $dish.prop('hidden') ? null : ($cards().filter('.card--active').get(0) || null));
      // делегирование: кнопки «Подробнее» есть и у карточек, добавленных позже
      $grid.on('click', '.js-card-more', function () {
        const card = $(this).closest('.js-card')[0];
        if (!$dish.prop('hidden') && $dish.data('owner') === card) {
          closeDish();
        } else {
          openDish(card);
        }
      });
      $dish.find('.js-dish-close').first().on('click', closeDish);
      $counter.on('counter:change', updateDishPrice);   // своё событие счётчика (см. ниже)
      $dish.find('.js-dish-add').first().on('click', () => {
        const qty = Number($counter.find('.js-counter-value').first().text());
        addToCart(itemFromData($dish), qty);
        toast(`«${$dish.attr('data-name')}» × ${qty} — в корзине`);
      });
    }

    // кнопка-тележка на карточке: +1 в корзину (делегирование на сетке)
    $grid.on('click', '.js-add-to-cart', function () {
      const $card = $(this).closest('.js-card');
      addToCart(itemFromData($card), 1);
      toast(`«${$card.attr('data-name')}» — в корзине`);
    });

    // --- «Показать ещё»: открывает карточки, отложенные в разметке атрибутом data-more.
    //     Раньше кнопка клонировала последние карточки — на странице появлялись дубли.
    //     Если отложенных карточек не осталось — сообщаем об этом и прячем кнопку ---
    const $moreBtn = $catalog.find('.js-show-more').first();
    if ($moreBtn.length) {
      const count = Number($moreBtn.data('moreCount') || 3);   // data-more-count
      const doneText = $moreBtn.attr('data-more-done') || 'Это все блюда раздела';
      $moreBtn.on('click', () => {
        $cards().filter('[data-more]').slice(0, count).removeAttr('data-more');
        apply();
        if (!$cards().filter('[data-more]').length) {
          $moreBtn.prop('hidden', true);
          toast(doneText);
        }
      });
    }

    apply();

    // переход из корзины «Подробнее» (menu.html?dish=caesar) — сразу раскрываем блюдо.
    // Разбор адреса — обычный JS (URLSearchParams), в jQuery такого нет
    const wanted = new URLSearchParams(window.location.search).get('dish');
    if (wanted && hasDish) {
      const card = $cards().filter(function () { return $(this).attr('data-id') === wanted; }).get(0);
      if (card) openDish(card);
    }
  });

  /* ---- Счётчик количества «− 1 +» (раскрытая карточка, корзина, заказ) ----
     Один делегированный обработчик на document — для всех счётчиков, в том числе
     созданных позже (строки корзины). Об изменении сообщает своим событием
     counter:change: $counter.trigger('counter:change', [новое значение])
     (нативно: dispatchEvent(new CustomEvent('counter:change', { detail }))) */
  $(document).on('click', '.js-counter-minus, .js-counter-plus', function () {
    const $btn = $(this);
    const $counter = $btn.closest('.js-counter');
    const $value = $counter.find('.js-counter-value').first();
    const min = Number($counter.data('min') || 1);
    const max = Number($counter.data('max') || 99);
    const current = Number($value.text());
    const next = Math.min(max, Math.max(min, current + ($btn.hasClass('js-counter-plus') ? 1 : -1)));
    if (next === current) return;
    $value.text(String(next));
    $counter.trigger('counter:change', [next]);   // событие «всплывает» к родителям, как bubbles: true
  });

  /* ================================================================
     11. Страница корзины: список, количество, удаление, промокод, итог
     ================================================================ */
  const $cartPage = $('.js-cart-page').first();
  if ($cartPage.length) {
    const PROMO_KEY = 'akvamarin-promo';
    const PROMO_CODES = { 'ПРОМОКОД': 10, PROMOCODE: 10 };   // промокод и скидка — заглушка
    const DELIVERY = 0;   // стоимость доставки — заглушка (пока 0)
    const $list = $cartPage.find('.js-cart-list').first();
    const $emptyBox = $cartPage.find('.js-cart-empty').first();
    const $summaryList = $cartPage.find('.js-summary-list').first();
    const $promoInput = $cartPage.find('.js-promo-input').first();
    const $promoMsg = $cartPage.find('.js-promo-msg').first();
    // id напитков барной карты: «Подробнее» в корзине ведёт на bar.html
    const BAR_IDS = /^(kaif|old-german|clover|kvas|sok-|pivo|vodka)/;

    // первый визит: корзина пустая (раньше сюда подкладывались 3 товара-заглушки из макета)

    // разметка одной строки корзины (как в макете) — обычная строка-шаблон
    const rowHtml = (item) => {
      const info = (item.info || '').split('|').map((part) => `<span>${part}</span>`).join('');
      const unit = item.unit ? `<small>${item.unit}</small>` : '';
      const isDish = !item.id.startsWith('sauce');
      const more = isDish ? `<a class="btn-small btn-small--red cart-item__more" href="${BAR_IDS.test(item.id) ? 'bar.html' : 'menu.html'}?dish=${encodeURIComponent(item.id)}">Подробнее</a>` : '';
      return `<li class="cart-item js-cart-item" data-id="${item.id}">
            <span class="ph cart-item__img" role="img" aria-label="Здесь будет фото" style="--w:226px;--ar:226 / 151"></span>
            <div class="cart-item__body">
              <h3 class="cart-item__title js-cart-item-name"></h3>
              <p class="cart-item__info">${info}</p>
              <p class="price cart-item__price">${formatPrice(item.price)}${unit}</p>
              <div class="counter counter--small js-counter" data-min="1">
                <button class="counter__btn counter__btn--minus js-counter-minus" type="button" aria-label="Меньше">-</button>
                <span class="counter__value js-counter-value">${item.qty}</span>
                <button class="counter__btn counter__btn--plus js-counter-plus" type="button" aria-label="Больше">+</button>
              </div>
              ${more}
              <button class="cart-item__remove js-cart-remove" type="button" aria-label="Убрать из корзины"><svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true" focusable="false"><path d="M1 1l9 9M10 1L1 10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
            </div>
          </li>`;
    };

    const renderSummary = (items) => {
      const count = items.length;
      $cartPage.find('.js-cart-total-count').first().text(String(count));
      $cartPage.find('.js-cart-total-word').first().text(plural(count, ['товар', 'товара', 'товаров']));
      $summaryList.empty();
      items.forEach((item) => {
        // строка итога: три <span>, текст кладём через .text() (без HTML)
        $('<li>', { class: 'summary__line' }).append(
          $('<span>', { class: 'summary__name' }).text(item.name),
          $('<span>', { class: 'summary__qty' }).text(`${item.qty}шт.`),
          $('<span>', { class: 'summary__price' }).text(formatPrice(item.price * item.qty)),
        ).appendTo($summaryList);   // .appendTo — то же, что $summaryList.append(...), но «наоборот»
      });
      const goods = items.reduce((sum, item) => sum + item.price * item.qty, 0);
      const delivery = count ? DELIVERY : 0;
      const code = storage.get(PROMO_KEY, '');
      const percent = PROMO_CODES[code] || 0;
      const full = goods + delivery;
      const total = full * (1 - percent / 100);
      $cartPage.find('.js-summary-delivery').first().text(formatPrice(delivery));
      $cartPage.find('.js-summary-discount').first()
        .text(`-${percent}%`)
        .toggleClass('summary__discount--off', !percent);
      $cartPage.find('.js-summary-old').first()
        .text(formatPrice(full))
        .prop('hidden', !percent || !count);
      $cartPage.find('.js-summary-total').first().text(formatPrice(total));
      $cartPage.attr('data-total', String(total));   // нативно: cartPage.dataset.total = ...
    };

    const render = () => {
      const items = getCart();
      $list.html(items.map(rowHtml).join(''));
      // названия вставляем как текст (без HTML)
      $list.find('.js-cart-item').each(function (i) {
        $(this).find('.js-cart-item-name').first().text(items[i].name);
      });
      $emptyBox.prop('hidden', items.length > 0);
      $list.prop('hidden', items.length === 0);
      renderSummary(items);
      filterRows();
    };

    // поиск по корзине
    const $cartSearch = $cartPage.find('.js-cart-search').first();
    function filterRows() {
      const query = $cartSearch.val().trim().toLowerCase();
      $list.find('.js-cart-item').each(function () {
        const $row = $(this);
        $row.prop('hidden', Boolean(query) && !$row.find('.js-cart-item-name').first().text().toLowerCase().includes(query));
      });
    }
    $cartSearch.on('input', filterRows);

    // количество и удаление — делегирование на списке: строки перерисовываются,
    // а обработчики остаются. Новое количество приходит вторым аргументом (value)
    $list.on('counter:change', '.js-cart-item', function (event, value) {
      const id = $(this).attr('data-id');
      const items = getCart();
      const item = items.find((entry) => entry.id === id);
      if (item) item.qty = value;
      storage.set(CART_KEY, items);
      updateHeaderCart();
      renderSummary(items);
    });
    $list.on('click', '.js-cart-remove', function () {
      const id = $(this).closest('.js-cart-item').attr('data-id');
      saveCart(getCart().filter((item) => item.id !== id));
    });
    $cartPage.find('.js-cart-clear').first().on('click', () => {
      if (!getCart().length) return;
      saveCart([]);
      toast('Корзина очищена');
    });

    // промокод
    const applyPromo = () => {
      const code = $promoInput.val().trim().toUpperCase();
      if (!code) return;
      $promoMsg.prop('hidden', false);
      if (PROMO_CODES[code]) {
        storage.set(PROMO_KEY, code);
        $promoMsg.text(`Промокод ${code} применён: скидка ${PROMO_CODES[code]}%`);
      } else {
        storage.set(PROMO_KEY, '');
        $promoMsg.text('Такого промокода нет. Попробуйте «ПРОМОКОД»');
      }
      $promoInput.val('');
      renderSummary(getCart());
    };
    $cartPage.find('.js-promo-apply').first().on('click', applyPromo);
    $promoInput.on('keydown', (event) => {
      if (event.key === 'Enter') applyPromo();
    });

    // «Оформить заказ» -> окно «Заполните данные для доставки»
    $cartPage.find('.js-checkout-open').first().on('click', () => {
      if (!getCart().length) {
        toast('Корзина пуста — добавьте блюда из меню');
        return;
      }
      openModal('checkout');
    });
    formHooks.push({
      match: '.js-checkout-form',
      validate: () => (getCart().length ? '' : 'Корзина пуста'),
      success: () => {
        saveCart([]);
        storage.set(PROMO_KEY, '');
        toast('Заказ оформлен!');   // короткое сообщение внизу экрана
      },
    });

    cartListeners.push(render);
    render();
  }

  // «Добавить к заказу» (соусы): в корзину или в текущий заказ
  $('.js-addon').on('click', function () {
    const $button = $(this);
    const item = itemFromData($button);
    if ($button.data('target') === 'order') {
      // своё событие на document; данные (товар) передаём массивом вторым аргументом trigger
      $(document).trigger('order:add', [item]);
    } else {
      addToCart(item, 1);
      toast(`«${item.name}» — в корзине`);
    }
    $button.addClass('addon__add--done');
    setTimeout(() => { $button.removeClass('addon__add--done'); }, 600);
  });

  /* ================================================================
     12. Страница заказа: количество, стол, оплата, официант, отзыв
     ================================================================ */
  const $orderPage = $('.js-order').first();
  if ($orderPage.length) {
    const $summary = $orderPage.find('.js-order-summary').first();
    const $lines = $summary.find('.summary__line');   // запоминаем строки, которые есть в разметке
    const $rows = $orderPage.find('.js-order-item');
    // строки «Ваш заказ» идут в том же порядке, что и блюда
    const extras = [];   // добавки, заказанные на этой странице

    const recalc = () => {
      let total = 0;
      $rows.each(function (i) {
        const $row = $(this);
        const qty = Number($row.find('.js-counter-value').first().text());
        const sum = Number($row.attr('data-price')) * qty;
        total += sum;
        if (i < $lines.length) {
          const $line = $lines.eq(i);
          $line.find('.summary__qty').first().text(`${qty}шт.`);
          $line.find('.summary__price').first().text(formatPrice(sum));
        }
      });
      extras.forEach((extra) => { total += extra.price * extra.qty; });
      $orderPage.find('.js-order-total').first().text(formatPrice(total));
      $('.js-pay-sum').first().text(formatPrice(total));   // нет элемента — jQuery просто ничего не сделает
    };
    $orderPage.on('counter:change', recalc);

    // товар приходит вторым аргументом обработчика (то, что передали в trigger)
    $(document).on('order:add', (event, item) => {
      let extra = extras.find((entry) => entry.id === item.id);
      if (extra) {
        extra.qty += 1;
      } else {
        extra = { ...item, qty: 1 };
        extras.push(extra);
        // новый элемент из HTML-строки (без текста пользователя — его ставим .text())
        extra.$line = $('<li class="summary__line"><span class="summary__name"></span><span class="summary__qty"></span><span class="summary__price"></span></li>');
        extra.$line.find('.summary__name').text(item.name);
        $summary.append(extra.$line);
      }
      extra.$line.find('.summary__qty').text(`${extra.qty}шт.`);
      extra.$line.find('.summary__price').text(formatPrice(extra.price * extra.qty));
      recalc();
      toast(`«${item.name}» добавлен к заказу`);
    });

    // «Дозаказать отмеченное»: блюда с галочкой — в корзину
    $orderPage.find('.js-reorder').first().on('click', () => {
      // .filter(функция) оставляет в наборе только строки, где функция вернула true
      const $checked = $rows.filter(function () { return $(this).find('.js-order-check').first().prop('checked'); });
      if (!$checked.length) {
        toast('Отметьте галочкой блюда, которые хотите дозаказать');
        return;
      }
      $checked.each(function () {
        addToCart(itemFromData($(this)), Number($(this).find('.js-counter-value').first().text()));
      });
      toast(`В корзину: ${$checked.length} ${plural($checked.length, ['блюдо', 'блюда', 'блюд'])}`);
    });

    $orderPage.find('.js-call-waiter').first().on('click', function () {
      const $button = $(this);   // this — нажатая кнопка; запоминаем её для setTimeout
      const table = $orderPage.find('.js-order-table').first().text();
      toast(`Официант подойдёт к столу №${table} через пару минут`);
      $button.prop('disabled', true);
      setTimeout(() => { $button.prop('disabled', false); }, 3000);
    });

    $orderPage.find('.js-pay-open').first().on('click', () => {
      recalc();
      openModal('pay');
    });
    formHooks.push({
      match: '.js-pay-form',
      success: () => { $orderPage.find('.js-order-status').first().text('оплачен'); },
    });

    // «Отзыв»: раскрыть форму, звёзды, проверка
    const $reviewToggle = $orderPage.find('.js-review-toggle').first();
    const $reviewForm = $orderPage.find('.js-review-form').first();
    $reviewToggle.on('click', () => {
      $reviewForm.prop('hidden', !$reviewForm.prop('hidden'));
      $reviewToggle.attr('aria-expanded', String(!$reviewForm.prop('hidden')));
    });
    $orderPage.find('.js-stars').each(function (groupIndex) {
      const $group = $(this);
      const $stars = $group.find('.js-star');
      const paint = (value) => {
        $stars.each(function (i) {
          $(this).toggleClass('stars__star--on', i < value).attr('aria-pressed', String(i < value));
        });
      };
      // как в макете: у групп по порядку 1, 2, 3, 4 и 5 звёзд.
      // Оценку храним в атрибуте data-value (.attr), чтобы она была видна в разметке
      $group.attr('data-value', String(groupIndex + 1));
      paint(groupIndex + 1);
      $stars.on('click', function () {
        const i = $stars.index(this);
        $group.attr('data-value', String(i + 1));
        paint(i + 1);
      });
      $stars.on('mouseenter', function () { paint($stars.index(this) + 1); });
      $group.on('mouseleave', () => { paint(Number($group.attr('data-value'))); });
    });
    formHooks.push({
      match: '.js-review-form',
      validate: ($form) => ($form.find('textarea').first().val().trim().length >= 10 ? '' : 'Напишите отзыв — хотя бы пару слов (от 10 символов)'),
    });

    recalc();
  }

  /* ================================================================
     13. Фото: просмотр на весь экран, страницы
     ================================================================ */
  const $lightbox = $('.js-modal[data-modal="lightbox"]').first();
  const box = { list: [], index: 0 };
  const showPhoto = () => {
    $lightbox.find('.js-lightbox-img').first()
      .attr('src', box.list[box.index])
      .attr('alt', `Фото ${box.index + 1}`);
    $lightbox.find('.js-lightbox-counter').first().text(`${box.index + 1} / ${box.list.length}`);
  };
  const openLightbox = (list, index) => {
    if (!$lightbox.length) return;
    box.list = list;
    box.index = index;
    showPhoto();
    openModal('lightbox');
  };
  if ($lightbox.length) {
    const $prev = $lightbox.find('.js-lightbox-prev').first();
    const $next = $lightbox.find('.js-lightbox-next').first();
    $prev.on('click', () => {
      box.index = (box.index - 1 + box.list.length) % box.list.length;
      showPhoto();
    });
    $next.on('click', () => {
      box.index = (box.index + 1) % box.list.length;
      showPhoto();
    });
    // стрелки на клавиатуре «нажимают» кнопки: .trigger('click') (нативно: button.click())
    $(document).on('keydown', (event) => {
      if ($lightbox.prop('hidden')) return;
      if (event.key === 'ArrowLeft') $prev.trigger('click');
      if (event.key === 'ArrowRight') $next.trigger('click');
    });
  }
  // открыть фото: делегирование на document для всех .js-lightbox-open.
  // data-src читаем .attr: на странице «Фото» переключатель страниц меняет этот атрибут,
  // а .data('src') вернул бы запомненное старое значение
  $(document).on('click', '.js-lightbox-open', function () {
    const $gallery = $(this).closest('.js-gallery');
    const $openers = ($gallery.length ? $gallery : $(document)).find('.js-lightbox-open');
    openLightbox($openers.map(function () { return $(this).attr('data-src'); }).get(), $openers.index(this));
  });

  // страницы 1–7: подсвечиваем номер и меняем порядок фото (пример, новых фото нет)
  $('.js-pagination').each(function () {
    const $pagination = $(this);
    const $section = $pagination.closest('section');
    const $grids = $section.find('.js-page-shuffle');
    // исходные адреса фото каждой сетки: массив массивов.
    // (Внимание: .map() у jQuery «расплющивает» вложенные массивы, поэтому собираем через .each)
    const originals = [];
    $grids.each(function () {
      originals.push($(this).find('img').map(function () { return $(this).attr('src'); }).get());
    });
    const $pages = $pagination.find('.js-page');
    $pages.on('click', function () {
      const button = this;
      const page = Number($(button).data('page'));
      $pages.each(function () {
        const $other = $(this);
        $other.toggleClass('pagination__link--active', this === button);
        if (this === button) $other.attr('aria-current', 'page'); else $other.removeAttr('aria-current');
      });
      $grids.each(function (g) {
        const srcs = originals[g];
        $(this).find('.js-lightbox-open').each(function (i) {
          const src = srcs[(i + (page - 1) * 3) % srcs.length];
          $(this).find('img').first().attr('src', src);
          $(this).attr('data-src', src);   // нативно: opener.dataset.src = src
        });
      });
      // плавная прокрутка к началу раздела — нативный scrollIntoView (см. комментарий в разделе 10)
      $section[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /* ================================================================
     14. Личный кабинет: данные профиля и «Показать ещё»
     ================================================================ */
  const $account = $('.js-account').first();
  if ($account.length) {
    const PROFILE_KEY = 'akvamarin-profile';
    const fields = {
      name: $account.find('.js-profile-name').first(),
      phone: $account.find('.js-profile-phone').first(),
      email: $account.find('.js-profile-email').first(),
    };
    const saved = storage.get(PROFILE_KEY, null);
    // $.each(объект, (ключ, значение) => ...) — перебор обычного объекта (нативно: Object.keys(...).forEach)
    if (saved) {
      $.each(fields, (key, $field) => {
        if (saved[key]) $field.text(saved[key]);
      });
    }

    // поле формы по имени: $form.find('[name="email"]') (нативно: form.elements.email)
    const formField = ($form, key) => $form.find(`[name="${key}"]`).first();

    $account.find('.js-profile-edit').first().on('click', () => {
      const $modal = openModal('profile');
      if (!$modal) return;
      const $form = $modal.find('.js-profile-form').first();
      $.each(fields, (key, $field) => {
        formField($form, key).val($field.text().trim());
      });
    });
    formHooks.push({
      match: '.js-profile-form',
      success: ($form) => {
        const data = {};
        $.each(fields, (key, $field) => {
          data[key] = formField($form, key).val().trim();
          $field.text(data[key]);
        });
        storage.set(PROFILE_KEY, data);
      },
    });

    const $moreBtn = $account.find('.js-history-more').first();
    $moreBtn.on('click', () => {
      $account.find('.js-history-extra').prop('hidden', false);   // сразу всем найденным карточкам
      $moreBtn.prop('hidden', true);
    });
  }

  /* ================================================================
     15. CRUD: правка строки и удаление с подтверждением.
         Два делегированных обработчика на <tbody>: для кнопок «Редактирование»
         и «Удалить» (нативно был один обработчик с event.target.closest(...))
     ================================================================ */
  const $crud = $('.js-crud').first();
  if ($crud.length) {
    const $body = $crud.find('.js-crud-body').first();
    $body.on('click', '.js-crud-edit', function () {
      const $edit = $(this);
      const $row = $edit.closest('.js-crud-row');
      const $cells = $row.find('[data-field]');
      if (!$row.hasClass('is-editing')) {
        // ячейки -> поля ввода
        $cells.each(function () {
          const $cell = $(this);
          const $input = $('<input class="crud__input">')
            .val($cell.text())
            .attr('aria-label', $cell.data('field'));
          if ($cell.data('field') === 'email') $input.attr('type', 'email');
          $cell.empty().append($input);
        });
        $row.addClass('is-editing');
        $edit.text('Сохранить');
        $row.find('input').first().trigger('focus');
      } else {
        // проверка и сохранение: ищем первую ячейку с ошибкой.
        // return false внутри .each останавливает перебор (как break или как Array.find)
        let $bad = null;
        $cells.each(function () {
          const $cell = $(this);
          const $input = $cell.find('input').first();
          const value = $input.val().trim();
          const wrong = !value || ($cell.data('field') === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value));
          $input.toggleClass('is-invalid', wrong);
          if (wrong) {
            $bad = $cell;
            return false;
          }
          return true;
        });
        if ($bad) {
          toast('Заполните все поля (e-mail — в формате name@mail.ru)');
          $bad.find('input').first().trigger('focus');
          return;
        }
        $cells.each(function () {
          $(this).text($(this).find('input').first().val().trim());
        });
        $row.removeClass('is-editing');
        $edit.html('Редактиро<wbr>вание');
        toast('Изменения сохранены');
      }
    });
    $body.on('click', '.js-crud-delete', function () {
      const del = this;
      const $del = $(del);
      const $row = $del.closest('.js-crud-row');
      if (!$del.hasClass('crud__btn--confirm')) {
        $del.addClass('crud__btn--confirm').text('Точно?');
        setTimeout(() => {
          // $.contains(document, элемент) — элемент ещё на странице? (нативно: del.isConnected)
          if ($.contains(document, del)) {
            $del.removeClass('crud__btn--confirm').text('Удалить');
          }
        }, 3000);
        return;
      }
      // строка плавно исчезает CSS-переходом по классу, потом удаляется из разметки
      $row.addClass('crud__row--removing');
      setTimeout(() => {
        $row.remove();
        $crud.find('.js-crud-empty').first().prop('hidden', $body.find('.js-crud-row').length > 0);
      }, 300);
    });
    // Enter в поле ввода = нажать «Сохранить» в этой строке
    $body.on('keydown', '.crud__input', function (event) {
      if (event.key === 'Enter') {
        $(this).closest('.js-crud-row').find('.js-crud-edit').first().trigger('click');
      }
    });
  }

  /* ================================================================
     16. Мелочи
     ================================================================ */
  // Ссылки подвала — заглушки без href (никуда не ведут, обработчик не нужен).
  // Позже сюда подключим всплывающие окна (попапы).

  // ссылки, для которых ещё нет страницы, — показываем сообщение
  $('.js-soon').on('click', function (event) {
    event.preventDefault();   // не переходим по ссылке
    toast($(this).data('soon') || 'Скоро появится');
  });
});
