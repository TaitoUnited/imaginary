import axios from 'axios';

const request = axios.create({
  baseURL: `${process.env.TEST_API_URL}`,
  responseType: 'json',
});

describe('infra', function infra() {
  // EXAMPLE: You can increase API timeout for slow API calls
  jest.setTimeout(5000);

  describe('infra API', () => {
    it('GET /config returns APP_VERSION', async () => {
      const response = await request.get('/config');
      expect(response.status).toBe(200);
      expect(typeof response.data.data.APP_VERSION).toBe('string');
    });

    it('GET /uptimez returns OK', async () => {
      const response = await request.get('/uptimez');
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('OK');
    });

    it('GET /healthz returns OK', async () => {
      const response = await request.get('/healthz');
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('OK');
    });
  });
});
