import type { Config, Response } from '../types';

export type RequestInterceptor = (
  config: Config,
) => Config | Promise<Config>;

export type ResponseInterceptor = (
  response: Response,
) => Response | Promise<Response>;
