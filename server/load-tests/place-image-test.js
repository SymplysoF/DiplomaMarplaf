import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    place_image_test: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 1 },
        { duration: '30s', target: 5 },
        { duration: '30s', target: 10 },
        { duration: '30s', target: 20 },
        { duration: '15s', target: 0 }
      ],
      gracefulRampDown: '5s'
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<1000']
  }
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const PLACE_ID = __ENV.PLACE_ID || '103';

export default function () {
  const res = http.get(`${BASE_URL}/api/places/image/${PLACE_ID}`);

  check(res, {
    'place image status 200': (r) => r.status === 200
  });

  sleep(1);
}