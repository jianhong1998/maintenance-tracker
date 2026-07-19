import { AppService } from './app.service';

describe('#healthCheck', () => {
  it('should return health check object', () => {
    const appService = new AppService();
    const result = appService.healthCheck();

    expect(result).toEqual({ isHealthy: true });
  });
});

describe('#getVersion', () => {
  const original = process.env.BACKEND_APP_VERSION;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.BACKEND_APP_VERSION;
    } else {
      process.env.BACKEND_APP_VERSION = original;
    }
  });

  it('returns the version from BACKEND_APP_VERSION when set', () => {
    process.env.BACKEND_APP_VERSION = '1.2.3';
    expect(new AppService().getVersion()).toEqual({ version: '1.2.3' });
  });

  it("falls back to 'unreleased' when BACKEND_APP_VERSION is unset", () => {
    delete process.env.BACKEND_APP_VERSION;
    expect(new AppService().getVersion()).toEqual({ version: 'unreleased' });
  });
});
