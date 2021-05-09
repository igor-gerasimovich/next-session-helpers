import {GetServerSideProps, GetServerSidePropsResult} from 'next';

export class NotFoundError extends Error {}

export const safeHttpCall = <P>(h: () => Promise<GetServerSidePropsResult<P>>): Promise<GetServerSidePropsResult<P>> => {
  try {
    return h()
  } catch (e) {
    if (e instanceof NotFoundError) {
      return Promise.resolve({
        notFound: true,
      });
    }

    throw e
  }
};

export const withSafeHTTP = (h: GetServerSideProps): GetServerSideProps => {
  return async (req) => {
    try {
      return await h(req);
    } catch (e) {
      if (e instanceof NotFoundError) {
        return {
          notFound: true,
        };
      }

      throw e
    }
  };
}
