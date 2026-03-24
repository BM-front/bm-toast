# bm-toast

Маленькая библиотека тостов на TypeScript без зависимостей. Очередь, лимит видимых, автозакрытие с прогресс-баром,
колбэки и понятные стили (SCSS/CSS).

- 🚫 Zero deps (только `tslib`)
- 🧱 ESM + CJS + типы
- 🧵 Очередь с FIFO/LIFO и лимитом видимых
- ⏱️ Автозакрытие с анимированным прогресс-баром и паузой при скрытой вкладке
- ♿ `role="alert"/"status"`, `aria-label` на кнопке закрытия
- 🎯 Колбэки на все этапы (enqueue, show, hide, click, close, timeout)

## Установка

```bash
npm i @bm-front/bm-toast
# или pnpm add @bm-front/bm-toast
```

Подключите стили (любой вариант):

```ts
// CSS
import '@bm-front/bm-toast/style.css';

// или SCSS (если у вас есть пайплайн для scss)
import '@bm-front/bm-toast/style.scss';
```

## Быстрый старт

```ts
import { showToast } from '@bm-front/bm-toast';
import '@bm-front/bm-toast/style.css';

showToast({
	type: 'success',
	title: 'Сохранено',
	description: 'Ваши изменения применены',
});
```

## API

### `showToast(options?: ShowToastOptions): string`

Показывает новый тост. Возвращает `id`.

Ключевые опции:

- `type`: `'success' | 'info' | 'warn' | 'error' | 'custom'` (по умолчанию `'info'`)
- `title?: string`, `description?: string`
- `position`: `'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'` (по умолчанию
  `'top-right'`)
- `closeButton`: `boolean | { label?: string; ariaLabel?: string }` (по умолчанию `true`)
- `autoCloseMs`: `number | false` — автозакрытие, мс (по умолчанию `5000`)
- `progress`: `boolean` — рисовать прогресс-бар (по умолчанию `true`)
- `customKey`: `string` — для кастомного типа добавит класс `bm-toast--custom-<key>`
- `className`: `string` — дополнительные классы
- `id`: `string` — контролируемый идентификатор
- `insertAt`: `'start' | 'end'` — куда в контейнере вставлять (по умолчанию `'start'`)
- Колбэки: `onEnqueue`, `onShow`, `onHide`, `onClick`, `onCloseClick`, `onTimeout`

### `hideToast(id?: string): void`

Скрывает тост по `id`. Если `id` не передан — скрывает самый старый видимый.

### `setDefaultParameters({ lib?, show? }): void`

Устанавливает глобальные дефолты для библиотеки и для каждого тоста:

```ts
import { setDefaultParameters } from '@bm-front/bm-toast';

setDefaultParameters({
	lib: {
		maxVisible: 3, // максимум видимых тостов
		containerClassName: 'bm-toast-container',
		insertAt: 'start', // вставка в видимом контейнере
		queueInsert: 'end', // 'end' (FIFO) или 'start' (LIFO)
		// Глобальные колбэки: onEnqueue/onShow/onHide/onClick/onCloseClick/onTimeout
	},
	show: {
		position: 'top-right',
		autoCloseMs: 5000,
		progress: true,
		closeButton: true,
		// Любые поля ShowToastOptions → станут дефолтами
	},
});
```

> Есть алиас с опечаткой: `setDefaultParametrs` — оставлен для обратной совместимости.

## Примеры

### Очередь и лимит

```ts
setDefaultParameters({ lib: { maxVisible: 2, queueInsert: 'end' } });

for (let i = 1; i <= 5; i++) {
	showToast({ title: `Тост #${i}`, description: 'FIFO очередь' });
}
```

### Кастомный тип

```ts
showToast({
	type: 'custom',
	customKey: 'purple',
	title: 'Фиолетовый тост',
});

// style.css / style.scss
// .bm-toast--custom-purple { background: rebeccapurple; }
```

### Обработчики кликов/закрытия

```ts
showToast({
	title: 'Нажми меня',
	onClick: (id, ev) => console.log('click', id, ev),
	onCloseClick: id => console.log('close', id),
	onHide: id => console.log('hidden', id),
});
```

### Программное закрытие

```ts
const id = showToast({ title: 'Закроюсь через 1с программно', autoCloseMs: false });
setTimeout(() => hideToast(id), 1000);
```

## Стили и позиционирование

Контейнеры создаются автоматически с классами:

```
.bm-toast-container
.bm-toast-container--top-right | --top-left | --bottom-right | --bottom-left | --top-center | --bottom-center
```

Сами тосты имеют базовый класс `.bm-toast` и модификаторы типа:

```
.bm-toast--success | --info | --warn | --error | --custom --custom-<key>
```

Вы можете переопределить цвета, тени, шрифты и т.д. в своих стилях. Прогресс-бар — элемент `.bm-toast__progress` с
анимацией по CSS.

## A11y

- Для типов `error`/`warn` используется `role="alert"`, иначе — `role="status"`.
- Кнопка закрытия имеет `aria-label` (можно задать через `closeButton.ariaLabel`).

## SSR / безопасное подключение

Библиотека предназначена для браузера и использует `document`. Если рендерите на сервере — вызывайте API только на
клиенте (например, в `useEffect`).

## Разработка

### Установка зависимостей

```bash
npm install
```

### Режим разработки

```bash
npm run dev
```

Запускает Rollup в режиме watch, открывает браузер на `http://localhost:3000` с демо-страницей из папки `dev/`. При
изменении любого `.ts` или `.scss` файла страница перезагружается автоматически.

### Продакшен-сборка

```bash
npm run build
```

Собирает `dist/`:

- `dist/index.js` — ESM-бандл
- `dist/index.cjs` — CJS-бандл
- `dist/index.d.ts` — TypeScript-типы
- `dist/style.css` — скомпилированные стили
- `dist/style.scss` — исходные стили (для проектов с SCSS-пайплайном)

### Проверка типов

```bash
npm run typecheck
```

### Релиз

```bash
npm run release
```

Интерактивный скрипт: выбирает тип версии (patch / minor / major / custom), собирает проект, публикует на npm, создаёт
git-коммит, тег и пушит в репозиторий.

### Структура проекта

```
src/
  index.ts      # основной код библиотеки
  style.scss    # стили
  icons/        # SVG-иконки для типов тостов
dev/
  index.html    # демо-страница для локальной разработки
docs/
  index.html    # публичная демо-страница (GitHub Pages)
dist/           # собранные файлы (генерируется автоматически)
scripts/
  release.js    # скрипт релиза
```

## Лицензия

[MIT](./LICENSE)
