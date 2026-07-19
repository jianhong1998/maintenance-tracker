import { IVersionResDTO } from '@project/types';

export class VersionResDTO implements IVersionResDTO {
  public version: string;

  constructor(params: { version: string }) {
    this.version = params.version;
  }
}
