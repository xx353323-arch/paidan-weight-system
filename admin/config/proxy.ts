export default {
  dev: {
    '/api/': {
      target: 'http://127.0.0.1:8000',
      changeOrigin: true,
    },
  },
  test: {
    '/api/': {
      target: 'http://127.0.0.1:8000',
      changeOrigin: true,
    },
  },
  pre: {
    '/api/': {
      target: 'http://127.0.0.1:8000',
      changeOrigin: true,
    },
  },
};
