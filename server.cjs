/**
 * Custom NextJS server in order to attach better logging
 *
 * @see https://nextjs.org/docs/advanced-features/custom-server
 * @see https://github.com/vercel/next.js/tree/canary/examples/custom-server
 */
const http = require('http');
const url = require('url');
const parse = url.parse;
const createServer = http.createServer;
const pino = require('pino');

const next = require('next');
const nextBuiltInLogger = require('next/dist/build/output/log');

const HOSTNAME = 'localhost';
const PORT = 3002;
const CWD = __dirname;

const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
  name: 'gstar-storefront-logger',
  level: 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      translateTime: 'yyyy-mm-dd HH:MM:ss.l o',
    },
  },
});

function flattenData(value) {
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value, undefined, 2);
  }

  return value;
}

function createLoggingFunction(levelName) {
  const baseLoggingFunction = (logger[levelName] || logger.info).bind(logger);
  return (...args) => {
    let data;
    let flattenedError;

    const nativeError = args.find(
      entry =>
        (entry && entry instanceof Error) ||
        (entry && typeof entry === 'object' && 'name' in entry && 'message' in entry)
    );

    if (nativeError) {
      flattenedError = flattenData(nativeError);
    }

    // If next is trying to log funky stuff, put it into the data object.
    if (args.length > 1) {
      data = {};
      data.args = args.map(part => flattenData(part));
    }

    const messages = nativeError && args.length === 1 ? [nativeError.toString()] : args;
    baseLoggingFunction({ data, flattenedError }, ...messages);
  };
}

// Patch Next.js logger.
Object.entries(nextBuiltInLogger).forEach(entry => {
  if (typeof entry[1] === 'function') {
    nextBuiltInLogger[entry[0]] = createLoggingFunction(entry[0]);
  }
});

// Patch console logger.
const loggingProperties = ['debug', 'log', 'info', 'warn', 'error'];
loggingProperties.forEach(entry => {
  global.console[entry] = createLoggingFunction(entry);
});

// Add general error logging.
process.on('unhandledRejection', (error, promise) => {
  logger.error(
    {
      type: 'unhandledRejection',
      error: flattenData(error),
      data: { promise: flattenData(promise) },
    },
    `${error}`
  );
});

process.on('uncaughtException', error => {
  logger.error({ type: 'uncaughtException', error: flattenData(error) }, `${error}`);
});

if (!process.env.NEXT_MANUAL_SIG_HANDLE) {
  process.on('SIGTERM', () => process.exit(0));
  process.on('SIGINT', () => process.exit(0));
}

logger.info(`Running in mode: ${isProduction ? 'production' : 'non-production'}`);

const app = next({
  dev: !isProduction,
  hostname: HOSTNAME,
  port: PORT,
  dir: CWD,
  customServer: true,
});
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer(async (req, res) => {
      const requestId = Math.random().toString(16).slice(2);
      const reqStart = Date.now();
      req.newrelic = newrelic;

      res.on('finish', () => {
        let logFunction = 'debug';
        if (res.statusCode >= 400 && res.statusCode < 600) {
          logFunction = 'error';
        }
        logger[logFunction](
          `${requestId} ${res.statusCode} ${req.method} ${req.url} (${Date.now() - reqStart}ms)`
        );
      });

      try {
        if (!req.url) {
          throw new Error('No URL to process');
        }
        const parsedUrl = parse(req.url, true);

        newrelic.setTransactionName(parsedUrl.pathname || '/*');

        await handle(req, res, parsedUrl);
      } catch (err) {
        logger.error('Error occurred handling', req.url, err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    })
      .once('error', err => {
        logger.error(err);
        process.exit(1);
      })
      .listen(PORT, () => {
        logger.info(`Ready on http://${HOSTNAME}:${PORT}`);
      });
  })
  .catch(reason => logger.error(reason));
