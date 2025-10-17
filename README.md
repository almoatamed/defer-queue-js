
# defer-queue-js

A tiny JavaScript/TypeScript utility for scheduling cleanup or teardown callbacks to run later — useful for running tasks at the end of a lifecycle step (for example: component unmount, request teardown, or end of a worker task).

This repository exposes a single class `DeferQueue` that collects two kinds of deferred callbacks and runs them when you call `defer()`.

## Features

- Append synchronous or asynchronous deferred callbacks
- Run all async callbacks in parallel and then run queued sync callbacks in order
- Lightweight and zero-dependency (implemented in TypeScript)

## Installation

Install from npm (example):

```bash
npm install defer-queue-js
# or
pnpm add defer-queue-js
yarn add defer-queue-js
```

If you prefer to use the source directly, you can still copy `index.ts` into your project.

If you use TypeScript, the exported `DeferQueue` class and `DeferredCallback` type are available from the package.

## Quick example

```ts
import DeferQueue from 'defer-queue-js';

const queue = new DeferQueue('my-queue');

// add an async cleanup
queue.appendAsync(async () => {
  await someAsyncCleanup();
});

// add a sync (fast) cleanup
queue.appendSync(() => {
  doFastCleanup();
});

// later, run all deferred callbacks
await queue.defer();
```

## API

- type DeferredCallback = () => Promise<void> | void

- class DeferQueue

	- constructor(name?: string)
		- name: optional name used when logging errors

	- appendSync(deferredCallback: DeferredCallback): void
		- Pushes a callback onto the synchronous queue. These callbacks are intended to be run in FIFO order.

	- appendAsync(deferredCallback: DeferredCallback): void
		- Pushes a callback onto the asynchronous queue. These callbacks will be executed in parallel when `defer()` is called.

	- defer(): Promise<void>
		- Executes all asynchronous callbacks in parallel (each awaited and errors are caught and logged). At the same time it runs through the synchronous queue by shifting items until none remain. The method resolves once all work is complete.

## Behavior details and notes

- Async callbacks: each function added via `appendAsync` is invoked and awaited. If a callback throws or rejects, the error is caught and logged with `console.error` including the queue `name`.

- Sync callbacks: functions added via `appendSync` are stored in an internal array and processed with `shift()` inside `defer()` until the array is empty. The intention is to process sync callbacks in order.

- Error handling: `defer()` traps errors from both kinds of callbacks and logs them. It does not rethrow, so callers should not expect an exception even if callbacks fail.

### When to use sync vs async

Use `appendSync` when the callbacks have ordering dependencies — for example resources that must be torn down in the opposite order they were started. A typical pattern:

- open DB connection
- start HTTP server (which depends on DB)

On shutdown you want to stop accepting requests before you close the DB. To express that ordering use the sync queue so callbacks run in FIFO order and are awaited one-by-one:

```ts
import DeferQueue from 'defer-queue-js';

const q = new DeferQueue('server-shutdown');

// start DB first
startDatabase();
q.appendSync(async () => {
	// on shutdown: close DB after server is stopped
	await db.close();
});

// then start server
startServer();
q.appendSync(async () => {
	// on shutdown: stop server first
	await server.stop();
});

// later on shutdown
await q.defer();
```

Because `appendSync` callbacks are shifted and awaited sequentially, you can rely on the order to express dependencies.

Use `appendAsync` for completely independent work that can run in parallel and doesn't depend on ordering — e.g. sending telemetry, clearing caches, or deleting temporary files. These run concurrently when `defer()` is called.

```ts
q.appendAsync(async () => {
	await sendTelemetry('shutdown');
});

q.appendAsync(() => {
	cleanupTempFiles();
});
```

Mixing both is supported: async callbacks run in parallel and the sync queue is processed (in order) as part of the overall `defer()` call.

## Known issue and suggested fix

While working with the source it is worth noting a subtle bug in `index.ts`:

- In the sync processing loop the code does `try { await cb; }` which awaits the callback function value itself, not the result of calling the callback. That means sync callbacks are never executed; instead the code awaits the function object (a no-op) and the intended cleanup won't run.

Suggested fix: call the callback and await its return value (so it supports both sync and async callbacks). Replace `await cb;` with `await cb();` inside the sync loop. Example patch:

```ts
while (this.syncList.length) {
	const cb = this.syncList.shift()!;
	try {
		await cb();
	} catch (error) {
		console.error(this.name, 'Failed to run sync deferred callback', error);
	}
}
```

This change keeps the behavior consistent: sync callbacks that return void will run immediately; if a sync callback returns a Promise it will be awaited.

## Tests & suggestions

- Minimal tests to add:
	- appendSync + appendAsync both run when `defer()` is called (happy path)
	- errors thrown in async and sync callbacks are caught and logged (verify `defer()` resolves)
	- order: sync callbacks run in FIFO order

- Consider renaming `appendSync` to `append` and `appendAsync` to `appendParallel` or similar if you want clearer semantics.

## License

This project contains no license file in the repository. Add a LICENSE if you want to publish the package.

## Changelog

- 2025-10-17: README added with API, examples and a suggested bug fix.
