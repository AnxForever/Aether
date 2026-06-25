/**
 * Stream Utils - Async stream utilities
 */

/**
 * Merge multiple async iterables
 */
export async function* mergeStreams<T>(
  ...streams: AsyncIterable<T>[]
): AsyncIterable<T> {
  const iterators = streams.map(s => s[Symbol.asyncIterator]());
  const pending = new Set(iterators);

  while (pending.size > 0) {
    const promises = Array.from(pending).map(async (iter) => {
      const result = await iter.next();
      return { iter, result };
    });

    const { iter, result } = await Promise.race(promises);

    if (result.done) {
      pending.delete(iter);
    } else {
      yield result.value;
    }
  }
}

/**
 * Map stream values
 */
export async function* mapStream<T, U>(
  stream: AsyncIterable<T>,
  fn: (value: T) => U | Promise<U>
): AsyncIterable<U> {
  for await (const value of stream) {
    yield await fn(value);
  }
}

/**
 * Filter stream values
 */
export async function* filterStream<T>(
  stream: AsyncIterable<T>,
  predicate: (value: T) => boolean | Promise<boolean>
): AsyncIterable<T> {
  for await (const value of stream) {
    if (await predicate(value)) {
      yield value;
    }
  }
}

/**
 * Take first N items from stream
 */
export async function* takeStream<T>(
  stream: AsyncIterable<T>,
  count: number
): AsyncIterable<T> {
  let taken = 0;
  for await (const value of stream) {
    if (taken >= count) break;
    yield value;
    taken++;
  }
}

/**
 * Collect stream to array
 */
export async function collectStream<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const results: T[] = [];
  for await (const value of stream) {
    results.push(value);
  }
  return results;
}

/**
 * Buffer stream chunks
 */
export async function* bufferStream<T>(
  stream: AsyncIterable<T>,
  size: number
): AsyncIterable<T[]> {
  let buffer: T[] = [];

  for await (const value of stream) {
    buffer.push(value);

    if (buffer.length >= size) {
      yield buffer;
      buffer = [];
    }
  }

  if (buffer.length > 0) {
    yield buffer;
  }
}

/**
 * Debounce stream
 */
export async function* debounceStream<T>(
  stream: AsyncIterable<T>,
  delayMs: number
): AsyncIterable<T> {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastValue: T | undefined;
  let resolve: ((value: T) => void) | null = null;

  const iterator = stream[Symbol.asyncIterator]();

  async function* generate() {
    while (true) {
      const result = await iterator.next();

      if (result.done) {
        if (lastValue !== undefined) {
          yield lastValue;
        }
        break;
      }

      lastValue = result.value;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      await new Promise<void>((res) => {
        timeoutId = setTimeout(() => {
          res();
        }, delayMs);
      });

      if (lastValue !== undefined) {
        yield lastValue;
        lastValue = undefined;
      }
    }
  }

  yield* generate();
}

/**
 * Batch stream by time window
 */
export async function* batchStreamByTime<T>(
  stream: AsyncIterable<T>,
  windowMs: number
): AsyncIterable<T[]> {
  let batch: T[] = [];
  let timeoutId: NodeJS.Timeout | undefined;

  const iterator = stream[Symbol.asyncIterator]();

  const emitBatch = async (batch: T[]): Promise<T[]> => {
    const result = [...batch];
    batch.length = 0;
    return result;
  };

  while (true) {
    const timeoutPromise = new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => resolve(null), windowMs);
    });

    const nextPromise = iterator.next();
    const result = await Promise.race([nextPromise, timeoutPromise]);

    if (result === null) {
      // Timeout - emit batch
      if (batch.length > 0) {
        yield await emitBatch(batch);
      }
      continue;
    }

    if (result.done) {
      if (timeoutId) clearTimeout(timeoutId);
      if (batch.length > 0) {
        yield await emitBatch(batch);
      }
      break;
    }

    batch.push(result.value);
  }
}

/**
 * Retry failed stream operations
 */
export async function* retryStream<T>(
  streamFactory: () => AsyncIterable<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): AsyncIterable<T> {
  let attempts = 0;

  while (attempts <= maxRetries) {
    try {
      const stream = streamFactory();
      for await (const value of stream) {
        yield value;
      }
      return;
    } catch (error) {
      attempts++;
      if (attempts > maxRetries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delayMs * attempts));
    }
  }
}
