import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    clustered_farmers_step_test: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 1 },
        { duration: '1m', target: 5 },
        { duration: '1m', target: 10 },
        { duration: '1m', target: 20 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 }
      ],
      gracefulRampDown: '10s'
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<2000', 'p(99)<4000']
  }
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const TOKEN = __ENV.TOKEN || '';

export default function () {
  const payload = JSON.stringify({
    lat: 55.7558,
    lng: 37.6173,
    filters: {
      calculateDistance: true,
      maxDistance: 100,
      minRating: 0,
      ecoOnly: false,
      includeUnripe: false
    }
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`
    }
  };

  const res = http.post(`${BASE_URL}/api/buyer/clustered-farmers`, payload, params);

  check(res, {
    'clustered-farmers status 200': (r) => r.status === 200,
    'clustered-farmers success true': (r) => {
      try {
        return JSON.parse(r.body).success === true;
      } catch {
        return false;
      }
    }
  });

  sleep(1);
}