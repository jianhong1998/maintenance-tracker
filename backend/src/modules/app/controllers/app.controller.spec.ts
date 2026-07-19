import { AppController } from './app.controller';
import { AppService } from '../services/app.service';

describe('AppController', () => {
  describe('#getVersion', () => {
    it('wraps the service version in a VersionResDTO', () => {
      const appService = {
        getVersion: () => ({ version: '9.9.9' }),
      } as unknown as AppService;

      const controller = new AppController(appService);

      expect(controller.getVersion()).toEqual({ version: '9.9.9' });
    });
  });
});
