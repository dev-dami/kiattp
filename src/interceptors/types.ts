import type { Config, Response, HttpError } from '../types';

export type RequestInterceptor = (
  config: Config,
) => Config | Promise<Config>;

export type ResponseInterceptor = (
  response: Response,
) => Response | Promise<Response>;

export type ErrorInterceptor = (
  error: HttpError,
) => HttpError | Promise<HttpError>;
