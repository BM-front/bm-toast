/*
 * bm-toast — простая библиотека тостов без зависимостей
 * Версия: 0.2
 */

// ===== Публичные типы =====
export type ToastType = 'success' | 'info' | 'warn' | 'error' | 'custom';
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

export type InsertAt = 'start' | 'end';

/** Параметры показа одного тоста */
export interface ShowToastOptions {
	/** Тип тоста */
	type?: ToastType;
	/** Заголовок (строка сверху) */
	title?: string;
	/** Описание (второстепенный текст) */
	description?: string;
	/** Позиция на экране (управляется классами CSS) */
	position?: ToastPosition;
	/** Кнопка закрытия: true/false или подпись/aria */
	closeButton?: boolean | { label?: string; ariaLabel?: string };
	/** Автозакрытие: миллисекунды или false, чтобы отключить */
	autoCloseMs?: number | false;
	/** Прогресс‑бар автозакрытия */
	progress?: boolean;
	/** Для кастомного типа: ключ, попадёт в класс bm-toast--custom-<key> */
	customKey?: string;
	/** Дополнительные классы для корневого элемента тоста */
	className?: string;
	/** Идентификатор — если нужен контролируемый id */
	id?: string;
	/** Место вставки в видимом контейнере: сверху (start) или снизу (end) */
	insertAt?: InsertAt;

	// ===== Колбэки (локальные, перекрывают глобальные) =====
	/** Вызывается при постановке в очередь */
	onEnqueue?: (id: string) => void;
	/** Вызывается после монтирования тоста в DOM */
	onShow?: (id: string, $el: HTMLElement) => void;
	/** Вызывается после удаления тоста из DOM */
	onHide?: (id: string) => void;
	/** Клик по тосту */
	onClick?: (id: string, ev: MouseEvent) => void;
	/** Клик по кнопке закрытия */
	onCloseClick?: (id: string, ev: MouseEvent) => void;
	/** Закрытие по таймеру */
	onTimeout?: (id: string) => void;
}

/** Параметры библиотеки (глобальные) */
export interface LibraryOptions {
	/** Максимум одновременно видимых тостов */
	maxVisible?: number;
	/** Базовый класс контейнеров */
	containerClassName?: string;
	/** Куда добавлять новые тосты: 'start' (сверху) или 'end' (снизу) */
	insertAt?: InsertAt;
	/** Куда класть новые элементы в очередь ожидания: в конец ('end'/FIFO) или в начало ('start'/LIFO) */
	queueInsert?: InsertAt;

	// ===== Глобальные колбэки (если не заданы локальные) =====
	/** Вызывается при постановке в очередь */
	onEnqueue?: (id: string) => void;
	/** Вызывается после монтирования тоста в DOM */
	onShow?: (id: string, $el: HTMLElement) => void;
	/** Вызывается после удаления тоста из DOM */
	onHide?: (id: string) => void;
	/** Клик по тосту */
	onClick?: (id: string, ev: MouseEvent) => void;
	/** Клик по кнопке закрытия */
	onCloseClick?: (id: string, ev: MouseEvent) => void;
	/** Закрытие по таймеру */
	onTimeout?: (id: string) => void;
}

/**
 * Устанавливает дефолтные параметры для библиотеки и для showToast. Передай `lib` (глобальные) и/или `show` (дефолты
 * для каждого тоста).
 */
export function setDefaultParameters(params: {
	lib?: Partial<LibraryOptions>;
	show?: Partial<ShowToastOptions>;
}): void {
	if (params.lib) Object.assign(defaults.lib, params.lib);
	if (params.show) Object.assign(defaults.show, params.show);
}

/** Альяс под возможное старое имя с опечаткой */
export const setDefaultParametrs = setDefaultParameters;

/** Показывает новый тост. При превышении лимита попадает в очередь. Возвращает идентификатор тоста. */
export function showToast(options: ShowToastOptions = {}): string {
	const id = options.id ?? uid();
	const merged = mergeOptions(options);
	const item: InternalToast = { id, opts: merged };

	if (active.size < defaults.lib.maxVisible) {
		mountToast(item);
	} else {
		// Настраиваемая вставка в очередь
		if (defaults.lib.queueInsert === 'start') {
			queue.unshift(item);
		} else {
			queue.push(item);
		}
		item.opts.onEnqueue?.(id);
	}
	return id;
}

/** Скрывает тост по идентификатору. Если id не задан — скрывает самый старый видимый. */
export function hideToast(id?: string): void {
	if (!id) {
		const first = active.keys().next();
		if (first.done) return;
		id = first.value;
	}
	const item = active.get(id);
	if (!item) return;
	beginHide(item, 'api');
}

// ===== Внутренности =====

type CbEnqueue = (id: string) => void;
type CbShow = (id: string, $el: HTMLElement) => void;
type CbHide = (id: string) => void;
type CbClick = (id: string, ev: MouseEvent) => void;

type Nullable<T> = T | null;

interface RequiredShowOptions {
	type: ToastType;
	title: string;
	description: string;
	position: ToastPosition;
	closeButton: boolean | { label?: string; ariaLabel?: string };
	autoCloseMs: number | false;
	progress: boolean;
	customKey: string;
	className: string;
	insertAt: InsertAt;
	onEnqueue: Nullable<CbEnqueue>;
	onShow: Nullable<CbShow>;
	onHide: Nullable<CbHide>;
	onClick: Nullable<CbClick>;
	onCloseClick: Nullable<CbClick>;
	onTimeout: Nullable<CbHide>;
}

interface DefaultsShape {
	show: RequiredShowOptions;
	lib: Required<Pick<LibraryOptions, 'maxVisible' | 'containerClassName' | 'insertAt' | 'queueInsert'>> &
		Partial<Omit<LibraryOptions, 'maxVisible' | 'containerClassName' | 'insertAt' | 'queueInsert'>>;
}

interface InternalToast {
	id: string;
	opts: RequiredShowOptions;
	$el?: HTMLElement;
	$progress?: HTMLElement;
	timeoutId?: number;
	startTs?: number; // время старта таймера
	deadlineTs?: number; // когда должен закрыться
}

const defaults: DefaultsShape = {
	show: {
		type: 'info',
		title: '',
		description: '',
		position: 'top-right',
		closeButton: true,
		autoCloseMs: 5000,
		progress: true,
		customKey: 'default',
		className: '',
		insertAt: 'start',
		onEnqueue: null,
		onShow: null,
		onHide: null,
		onClick: null,
		onCloseClick: null,
		onTimeout: null,
	},
	lib: {
		maxVisible: 3,
		containerClassName: 'bm-toast-container',
		insertAt: 'start',
		queueInsert: 'end', // FIFO по умолчанию
	},
};

const queue: InternalToast[] = [];
const active: Map<string, InternalToast> = new Map();
let visibilityHookAttached = false;

function uid(): string {
	return 't_' + Math.random().toString(36).slice(2, 10);
}

function mergeOptions(options: ShowToastOptions): RequiredShowOptions {
	const merged: RequiredShowOptions = {
		...defaults.show,
		...options,
		// колбэки: локальные > глобальные > null
		onEnqueue: options.onEnqueue ?? defaults.lib.onEnqueue ?? defaults.show.onEnqueue ?? null,
		onShow: options.onShow ?? defaults.lib.onShow ?? defaults.show.onShow ?? null,
		onHide: options.onHide ?? defaults.lib.onHide ?? defaults.show.onHide ?? null,
		onClick: options.onClick ?? defaults.lib.onClick ?? defaults.show.onClick ?? null,
		onCloseClick: options.onCloseClick ?? defaults.lib.onCloseClick ?? defaults.show.onCloseClick ?? null,
		onTimeout: options.onTimeout ?? defaults.lib.onTimeout ?? defaults.show.onTimeout ?? null,
		insertAt: options.insertAt ?? defaults.lib.insertAt ?? defaults.show.insertAt,
	};
	return merged;
}

function getContainer(position: ToastPosition): HTMLElement {
	const base = defaults.lib.containerClassName;
	const cls = `${base} ${base}--${position}`;
	let $container = document.querySelector<HTMLElement>(`.${base}--${position}`);
	if (!$container) {
		$container = document.createElement('div');
		$container.className = cls;
		$container.setAttribute('data-position', position);
		document.body.appendChild($container);
	}
	return $container;
}

// ===== FLIP-переход списков =====
function snapshot($container: HTMLElement): Map<HTMLElement, DOMRect> {
	const map = new Map<HTMLElement, DOMRect>();
	$container.querySelectorAll<HTMLElement>('.bm-toast').forEach($el => {
		map.set($el, $el.getBoundingClientRect());
	});
	return map;
}

function animateFromSnapshot($container: HTMLElement, prev: Map<HTMLElement, DOMRect>): void {
	$container.querySelectorAll<HTMLElement>('.bm-toast').forEach($el => {
		const rect = prev.get($el);
		if (!rect) return;
		const newRect = $el.getBoundingClientRect();
		const dx = rect.left - newRect.left;
		const dy = rect.top - newRect.top;
		if (dx || dy) {
			$el.style.transform = `translate(${dx}px, ${dy}px)`;
			// следующий кадр — вернуть в 0 с transition
			requestAnimationFrame(() => {
				$el.style.transition = 'transform 160ms ease';
				$el.style.transform = '';
				const cleanup = () => {
					$el.style.transition = '';
				};
				$el.addEventListener('transitionend', cleanup, { once: true });
			});
		}
	});
}

function withListAnimation($container: HTMLElement, mutate: () => void) {
	const snap = snapshot($container);
	mutate();
	requestAnimationFrame(() => animateFromSnapshot($container, snap));
}

// ===== Монтирование и скрытие =====
function mountToast(item: InternalToast) {
	const { id, opts } = item;
	const $container = getContainer(opts.position);

	ensureVisibilityHook();

	withListAnimation($container, () => {
		const $el = createToastElement(item);
		item.$el = $el;

		active.set(id, item);

		if (opts.insertAt === 'start' && $container.firstChild) {
			$container.insertBefore($el, $container.firstChild);
		} else {
			$container.appendChild($el);
		}

		// Входная анимация
		$el.classList.add('bm-toast--enter');
		$el.addEventListener('animationend', () => $el.classList.remove('bm-toast--enter'), { once: true });

		// Автозакрытие
		if (opts.autoCloseMs && opts.autoCloseMs > 0) {
			startAutoClose(item, opts.autoCloseMs);
		}

		opts.onShow?.(id, $el);
	});
}

function beginHide(item: InternalToast, reason: 'timeout' | 'close' | 'api') {
	const { id, $el, opts } = item;
	if (!$el) return;

	const $container = $el.parentElement as HTMLElement;
	if (!$container) return;

	pauseAutoClose(item); // останавливаем таймер, если был

	const snap = snapshot($container);

	$el.classList.add('bm-toast--leave');
	$el.addEventListener(
		'animationend',
		() => {
			$el.remove();
			active.delete(id);

			if (reason === 'timeout') opts.onTimeout?.(id);
			opts.onHide?.(id);

			// Подставляем следующий из очереди
			flushQueue();

			// Анимируем смещение оставшихся
			requestAnimationFrame(() => animateFromSnapshot($container, snap));
		},
		{ once: true },
	);
}

function flushQueue() {
	while (active.size < defaults.lib.maxVisible && queue.length) {
		const next = defaults.lib.queueInsert === 'start' ? queue.shift()! : queue.shift()!; // всегда shift: FIFO
		mountToast(next);
	}
}

// ===== Таймеры с паузой при скрытии вкладки =====
function startAutoClose(item: InternalToast, ms: number) {
	const now = Date.now();
	item.startTs = now;
	item.deadlineTs = now + ms;
	if (item.$progress) {
		item.$progress.style.setProperty('--bm-toast-progress-duration', `${ms}ms`);
		item.$el?.classList.remove('bm-toast--paused');
	}
	item.timeoutId = window.setTimeout(() => beginHide(item, 'timeout'), ms);
}

function pauseAutoClose(item: InternalToast) {
	if (!item.timeoutId || !item.deadlineTs) return;
	clearTimeout(item.timeoutId);
	item.timeoutId = undefined;
	const now = Date.now();
	const remaining = Math.max(0, item.deadlineTs - now);
	// переносим дедлайн относительно текущего времени (будет пересчитан при resume)
	item.deadlineTs = now + remaining;
	item.$el?.classList.add('bm-toast--paused');
}

function resumeAutoClose(item: InternalToast) {
	if (!item.deadlineTs) return;
	const now = Date.now();
	const remaining = Math.max(0, item.deadlineTs - now);
	if (remaining === 0) {
		beginHide(item, 'timeout');
		return;
	}
	startAutoClose(item, remaining);
}

function ensureVisibilityHook() {
	if (visibilityHookAttached) return;
	visibilityHookAttached = true;
	document.addEventListener('visibilitychange', () => {
		const hidden = document.visibilityState === 'hidden';
		active.forEach(item => {
			if (!item.opts.autoCloseMs || item.opts.autoCloseMs <= 0) return;
			if (hidden) pauseAutoClose(item);
			else resumeAutoClose(item);
		});
	});
}

// ===== Разметка тоста =====
function createToastElement(item: InternalToast): HTMLElement {
	const { id, opts } = item;
	const $el = document.createElement('div');
	$el.className = [
		'bm-toast',
		`bm-toast--${opts.type}`,
		opts.type === 'custom' ? `bm-toast--custom bm-toast--custom-${opts.customKey}` : '',
		opts.className,
	]
		.filter(Boolean)
		.join(' ');
	$el.setAttribute('data-id', id);
	$el.setAttribute('role', opts.type === 'error' || opts.type === 'warn' ? 'alert' : 'status');

	const $inner = document.createElement('div');
	$inner.className = 'bm-toast__inner';

	const $icon = document.createElement('span');
	$icon.className = 'bm-toast__icon';
	$icon.setAttribute('aria-hidden', 'true');
	$inner.appendChild($icon);

	const $body = document.createElement('div');
	$body.className = 'bm-toast__body';

	if (opts.title) {
		const $title = document.createElement('div');
		$title.className = 'bm-toast__title';
		$title.textContent = opts.title;
		$body.appendChild($title);
	}

	if (opts.description) {
		const $desc = document.createElement('div');
		$desc.className = 'bm-toast__desc';
		$desc.textContent = opts.description;
		$body.appendChild($desc);
	}

	$inner.appendChild($body);

	if (opts.closeButton) {
		const $btn = document.createElement('button');
		$btn.className = 'bm-toast__close';
		const label = typeof opts.closeButton === 'object' ? (opts.closeButton.label ?? '✕') : '✕';
		const aria = typeof opts.closeButton === 'object' ? (opts.closeButton.ariaLabel ?? 'Закрыть') : 'Закрыть';
		$btn.setAttribute('aria-label', aria);
		$btn.textContent = label;
		$btn.addEventListener('click', ev => {
			opts.onCloseClick?.(id, ev);
			beginHide(item, 'close');
		});
		$el.appendChild($btn);
	}

	$el.appendChild($inner);

	if (opts.progress && opts.autoCloseMs && opts.autoCloseMs > 0) {
		const $pr = document.createElement('div');
		$pr.className = 'bm-toast__progress';
		$pr.style.setProperty('--bm-toast-progress-duration', `${opts.autoCloseMs}ms`);
		item.$progress = $pr;
		$el.appendChild($pr);
	}

	$el.addEventListener('click', ev => opts.onClick?.(id, ev));

	return $el;
}
