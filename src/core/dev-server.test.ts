import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { reloadWhenDevServerReturns } from './dev-server';

// A socket that opens or fails when the test says, like the dev server
// answering or not.
class FakeSocket extends EventTarget {
  static all: FakeSocket[] = [];
  constructor(
    readonly url: string,
    readonly protocol: string,
  ) {
    super();
    FakeSocket.all.push(this);
  }
  open() {
    this.dispatchEvent(new Event('open'));
  }
  close() {
    this.dispatchEvent(new Event('close'));
  }
}

const latest = () => FakeSocket.all.at(-1);

beforeEach(() => {
  fakeBrowser.reset();
  FakeSocket.all = [];
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', FakeSocket);
  vi.stubGlobal('__DEV_SERVER_ORIGIN__', 'ws://localhost:3000');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('reloadWhenDevServerReturns', () => {
  it('connects to the dev server as Vite expects', () => {
    reloadWhenDevServerReturns();
    expect(latest()?.url).toBe('ws://localhost:3000');
    expect(latest()?.protocol).toBe('vite-hmr');
  });

  it('leaves the extension alone while the server stays', () => {
    const reload = vi
      .spyOn(fakeBrowser.runtime, 'reload')
      .mockImplementation(() => {});
    reloadWhenDevServerReturns();
    latest()?.open();
    vi.advanceTimersByTime(60_000);
    expect(reload).not.toHaveBeenCalled();
    expect(FakeSocket.all).toHaveLength(1);
  });

  it('reloads the extension once the server answers again', () => {
    const reload = vi
      .spyOn(fakeBrowser.runtime, 'reload')
      .mockImplementation(() => {});
    reloadWhenDevServerReturns();
    latest()?.open();
    latest()?.close();

    // down for two tries
    for (let i = 0; i < 2; i++) {
      vi.advanceTimersByTime(2000);
      latest()?.close();
    }
    expect(reload).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2000);
    latest()?.open();
    expect(reload).toHaveBeenCalledOnce();
  });
});
