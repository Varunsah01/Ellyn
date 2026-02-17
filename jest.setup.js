import '@testing-library/jest-dom';

if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}

    unobserve() {}

    disconnect() {}
  };
}

if (typeof global.Response === 'undefined') {
  global.Response = class Response {
    constructor(body, init = {}) {
      this._body = body;
      this.status = init.status || 200;
      this.headers = init.headers || {};
    }

    get ok() {
      return this.status >= 200 && this.status < 300;
    }

    async json() {
      if (typeof this._body === 'string') {
        return JSON.parse(this._body);
      }
      return this._body;
    }

    async text() {
      if (typeof this._body === 'string') {
        return this._body;
      }
      return JSON.stringify(this._body);
    }
  };
}
