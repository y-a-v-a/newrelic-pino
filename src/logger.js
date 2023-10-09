// import pino from 'pino';

// const options = {
//   name: 'gstar-storefront-logger',
//   level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
//   transport: {
//     target: 'pino-pretty',
//     options: {
//       translateTime: 'yyyy-mm-dd HH:MM:ss.l o',
//     },
//   },
// };

// const logger = pino(options);
const logger = console;

export default logger;
