import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    full_buyer_page_test: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 1 },
        { duration: '1m', target: 5 },
        { duration: '1m', target: 10 },
        { duration: '1m', target: 20 },
        { duration: '30s', target: 0 }
      ],
      gracefulRampDown: '10s'
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.03'],
    http_req_duration: ['p(95)<2500', 'p(99)<5000']
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

  const clusteredRes = http.post(`${BASE_URL}/api/buyer/clustered-farmers`, payload, params);

  check(clusteredRes, {
    'clustered-farmers 200': (r) => r.status === 200
  });

  if (clusteredRes.status === 200) {
    let parsed = null;

    try {
      parsed = JSON.parse(clusteredRes.body);
    } catch {
      parsed = null;
    }

    const farmers = parsed?.allFarmers || [];
    const places = parsed?.allPlaces || [];

    const avatarTargets = farmers.slice(0, 5);
    const placeTargets = places.slice(0, 5);

    for (const farmer of avatarTargets) {
      if (farmer?.userid) {
        const avatarRes = http.get(`${BASE_URL}/api/supplier/avatar/${farmer.userid}`);
        check(avatarRes, {
          'avatar 200': (r) => r.status === 200
        });
      }
    }

    for (const place of placeTargets) {
      const placeId = place?.placeId || place?.id;
      if (placeId) {
        const placeRes = http.get(`${BASE_URL}/api/places/image/${placeId}`);
        check(placeRes, {
          'place image 200': (r) => r.status === 200
        });
      }
    }
  }

  sleep(1);
}