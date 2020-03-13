const request = require('request-promise');
const ENDPOINT = 'https://my.newmotion.com/api/map/v2/locations/2735712';
const STATUS = {
  AVAILABLE: 'Available',
  OCCUPIED: 'Occupied'
};
/*
 * Querying ("polling") the endpoint for an available charge point for any
 * interval less than 5 minutes will get us banned and blocked for overloading
 * their servers.
 */
const INTERVAL = 1000 * 60 * 5;

let currentStatus;

/*
 * The purpose of the function is to compute the right amount of minutes until
 * the next call is to made.
 *
 * Assumptions made:
 *  - the "response.evses[].updated" property is the timestamp of the last
 *    state change (Available <-> Occupied)
 *  - charge cycles are most likely to be increments of 5 minutes (30 min,
 *    45 min, 60 min, etc)
 *  - offset can never be lower than 5 minutes and higher than 10 minutes
 */
function compute_offset(last_updated) {
  let offset = 0;
  const updated = new Date(last_updated);
  const now = new Date();

  const x = updated.getMinutes() % 10;
  const y = now.getMinutes() % 10;
  const delta_miliseconds = (x - y) * 1000 * 60;

  if (delta_miliseconds >= 0) {
    offset = delta_miliseconds >= INTERVAL ? delta_miliseconds : INTERVAL + delta_miliseconds;
  } else {
    offset = (INTERVAL * 2) - Math.abs(delta_miliseconds);
  }

  return offset;
}

async function tick() {
  let response;
  let offset = INTERVAL;

  try {
    response = await request(ENDPOINT, {
      json: true
    });
  } catch (e) {
    console.error('request error', e);
  }

  if (response && response.evses && response.evses.length) {
    const evse = response.evses[0];

    if (currentStatus !== evse.status) {
      currentStatus = evse.status;

      console.log('new status:', currentStatus, '-', evse.updated);
    } else {
      console.log('no status change');
    }

    offset = compute_offset(evse.updated);
  } else {
    console.error('content error');
  }

  console.log('next tick:', offset / 60 / 1000, 'min');

  setTimeout(tick, offset);
}

tick();
