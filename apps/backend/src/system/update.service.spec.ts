import { UpdateService } from './update.service';

describe('UpdateService.checkForUpdate', () => {
  const saved = { ...process.env };
  const realFetch = global.fetch;

  afterEach(() => {
    process.env = { ...saved };
    global.fetch = realFetch;
  });

  it('makes no outside request when the host app is updated by a package (Windows app)', async () => {
    process.env.UPDATE_CHANNEL = 'package';
    process.env.APP_VERSION = '1.0.19.0';
    const fetchMock = jest.fn(() => {
      throw new Error('no network call expected');
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const info = await new UpdateService().checkForUpdate();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(info).toMatchObject({
      currentVersion: '1.0.19.0',
      latestVersion: null,
      updateAvailable: false,
      building: false,
      releaseUrl: null,
      managedBy: 'package',
    });
  });

  it('still looks up the latest release for other installs', async () => {
    delete process.env.UPDATE_CHANNEL;
    process.env.APP_VERSION = '1.0.0';
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => [{ name: 'v1.2.0' }],
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const info = await new UpdateService().checkForUpdate();

    expect(fetchMock).toHaveBeenCalled();
    expect(info.managedBy).toBeUndefined();
  });
});
