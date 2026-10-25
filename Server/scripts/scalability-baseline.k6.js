// Run against staging with k6, not against a production database.
// Example: k6 run -e API_BASE_URL=http://localhost:5000/api -e GROUND_ID=<uuid> scripts/scalability-baseline.k6.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const baseUrl = (__ENV.API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const groundId = __ENV.GROUND_ID;
const token = __ENV.PLAYER_TOKEN;
const availabilityDate = __ENV.AVAILABILITY_DATE || new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
const failedChecks = new Counter('baseline_failed_checks');
const routeLatency = new Trend('baseline_route_latency', true);

export const options = {
  scenarios: {
    discovery: { executor: 'constant-vus', vus: Number(__ENV.VUS || 10), duration: __ENV.DURATION || '2m' },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
    baseline_failed_checks: ['count==0'],
  },
};

function get(path, name, headers = {}) {
  const response = http.get(`${baseUrl}${path}`, { headers, tags: { route: name } });
  routeLatency.add(response.timings.duration, { route: name });
  if (!check(response, { [`${name} returns 200`]: (item) => item.status === 200 })) failedChecks.add(1, { route: name });
  return response;
}

export default function () {
  get('/grounds?page=1&limit=24', 'discovery');
  get(`/grounds?availability_date=${availabilityDate}&page=1&limit=24`, 'date_discovery');
  if (groundId) get(`/grounds/${groundId}`, 'ground_detail');
  if (token) {
    const headers = { Authorization: `Bearer ${token}` };
    get('/bookings/mine?page=1&limit=20', 'player_bookings', headers);
    get('/notifications?page=1&limit=20', 'notifications', headers);
  }
  sleep(1);
}
