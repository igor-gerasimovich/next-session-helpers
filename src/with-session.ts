import { withIronSession, Session } from 'next-iron-session';
import {
  GetServerSideProps,
  GetServerSidePropsContext,
  GetServerSidePropsResult,
  NextApiHandler,
  NextApiRequest
} from 'next';
import { NextApiResponse } from 'next/dist/next-server/lib/utils';
import { ParsedUrlQuery } from 'querystring';

type PropsBase = { [key: string]: any };

// Start shitty globals
const config = {
  NODE_ENV: '',

  // SESSION PARAMS
  SESSION_AUTH_COOKIE_PASSWORD: '',
  SESSION_AUTH_COOKIE_NAME: '',
  SESSION_AUTH_COOKIE_DOMAIN: '',
  SESSION_USER_PARAM: '',

  // When user unauthorized and trying to visit only private url
  UNAUTHORIZED_REDIRECT_URL: '',
  UNAUTHORIZED_REDIRECT_CALLBACK: undefined as (undefined | GetServerSidePropsWithSession<any, any>),

  // When user authorized and trying to visit only guest url
  AUTHORIZED_REDIRECT_URL: '',
};
type GlobalConfig = typeof config;

export const setConfig = (newConfig: Partial<GlobalConfig>) => {
  const keys = Object.keys(newConfig) as Array<keyof GlobalConfig>;
  keys.forEach(k => {
    const v = newConfig[k];
    if (v !== undefined) {
      // @ts-ignore
      config[k] = v;
    }
  })
};
// End shitty globals


export type IronSessionRequest = NextApiRequest & {
  session: Session;
};

export type NextApiHandlerWithSession<T = any> = (req: IronSessionRequest, res: NextApiResponse<T>) => void | Promise<void>;

export function withSessionApi<T>(handler: NextApiHandlerWithSession<T>): NextApiHandler<T> {
  return withIronSession(handler, {
    password: config.SESSION_AUTH_COOKIE_PASSWORD,
    cookieName: config.SESSION_AUTH_COOKIE_NAME,
    cookieOptions: {
      secure: config.NODE_ENV === "production",
      domain: config.SESSION_AUTH_COOKIE_DOMAIN,
    },
  });
}

export type GetServerSidePropsWithSession<
  P extends { [key: string]: any } = { [key: string]: any },
  Q extends ParsedUrlQuery = ParsedUrlQuery
> = (
  context: GetServerSidePropsContext<Q>,
  session: Session,
) => Promise<GetServerSidePropsResult<P>>

export type GetServerSidePropsWithSessionUser<
  UserModel,
  P extends { [key: string]: any } = { [key: string]: any },
  Q extends ParsedUrlQuery = ParsedUrlQuery
> = (
  context: GetServerSidePropsContext<Q>,
  session: Session,
  user: UserModel
) => Promise<GetServerSidePropsResult<P>>

export function withSessionSSR<
  Props extends PropsBase = PropsBase,
  Query extends ParsedUrlQuery = ParsedUrlQuery
>(handler: GetServerSidePropsWithSession<Props, Query>): GetServerSideProps<Props, Query> {
  return withIronSession((ctx => {
    return handler(ctx, ctx.req.session);
  }), {
    password: config.SESSION_AUTH_COOKIE_PASSWORD,
    cookieName: config.SESSION_AUTH_COOKIE_NAME,
    cookieOptions: {
      secure: config.NODE_ENV === "production",
      domain: config.SESSION_AUTH_COOKIE_DOMAIN,
    },
  });
}

export const guestRouteSSR = <
  Props extends PropsBase = PropsBase,
  Query extends ParsedUrlQuery = ParsedUrlQuery
>(
  handler: GetServerSidePropsWithSession<Props, Query>,
  redirectTo?: string,
): GetServerSideProps<Props, Query> => {
  return withSessionSSR<Props, Query>(async (ctx, ses) => {
    const user = ses.get<unknown>(config.SESSION_USER_PARAM);

    if (user) {
      return {
        redirect: {
          destination: !!redirectTo ? redirectTo : config.AUTHORIZED_REDIRECT_URL,
          permanent: false,
        }
      };
    }

    return handler(ctx, ses);
  });
};

export const privateRouteSSR = <
  UserSessionModel,
  Props extends PropsBase = PropsBase,
  Query extends ParsedUrlQuery = ParsedUrlQuery
>(
  handler: GetServerSidePropsWithSessionUser<UserSessionModel, Props, Query>,
  redirectTo?: string | GetServerSidePropsWithSession<Props, Query>,
): GetServerSideProps<Props, Query> => {
  return withSessionSSR<Props, Query>(async (ctx, ses) => {
    const user = ses.get<UserSessionModel>(config.SESSION_USER_PARAM);

    if (!user) {
      if (typeof redirectTo === 'function') {
        return redirectTo(ctx, ses);
      }

      if (config.UNAUTHORIZED_REDIRECT_CALLBACK !== undefined) {
        return config.UNAUTHORIZED_REDIRECT_CALLBACK(ctx, ses)
      }

      return {
        redirect: {
          destination: !!redirectTo ? redirectTo : config.UNAUTHORIZED_REDIRECT_URL,
          permanent: false,
        }
      };
    }

    return handler(ctx, ses, user);
  });
};
