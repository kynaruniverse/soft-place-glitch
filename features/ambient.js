/**
 * MAKÉ FEATURES — ambient.js
 * Time-of-day ambient sorting.  Runs once per hour to float the most
 * contextually relevant item type to the top of the card grid.
 *
 *   05:00–11:59  → notes first (morning planning)
 *   12:00–17:59  → links first (afternoon research / reading)
 *   18:00–04:59  → code first  (evening hacking)
 */

import { state } from '../core/state.js';

let _interval = null;

export function initAmbient()  { if (state.ambientEnabled) startAmbient(); }

export function startAmbient() {
  _sortByTime();
  clearInterval(_interval);
  _interval = setInterval(_sortByTime, 3_600_000); // re-sort every hour
}

export function stopAmbient() {
  clearInterval(_interval);
  _interval = null;
}

function _sortByTime() {
  const h = new Date().getHours();
  const priority = h >= 5 && h < 12 ? 'note'
                 : h >= 12 && h < 18 ? 'link'
                 : 'code';

  state._data.backgroundItems = [...state.backgroundItems].sort((a, b) => {
    if (a.type === priority && b.type !== priority) return -1;
    if (b.type === priority && a.type !== priority) return  1;
    return 0;
  });
  state._notify();
}
