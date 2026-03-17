import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { IAuthUser } from '@project/types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): IAuthUser => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: IAuthUser }>();
    return request.user;
  },
);
