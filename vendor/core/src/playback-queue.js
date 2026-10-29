'use strict';

const PLAYBACK_QUEUE_STATUSES = new Set([
  'idle',
  'ready',
  'playing',
  'paused',
  'complete',
  'error',
]);

function normalizeQueueItem(item, index) {
  if (typeof item === 'string') {
    return { id: `chunk-${index + 1}`, metadata: null, text: item };
  }
  const source = item && typeof item === 'object' ? item : {};
  return {
    id: String(source.id || `chunk-${index + 1}`),
    metadata: source.metadata === undefined ? null : source.metadata,
    text: String(source.text || ''),
  };
}

function normalizeQueueItems(items) {
  return (Array.isArray(items) ? items : [])
    .map(normalizeQueueItem)
    .filter((item) => item.text.trim());
}

function createPlaybackQueueState(items = []) {
  const normalizedItems = normalizeQueueItems(items);
  return {
    currentIndex: normalizedItems.length ? 0 : -1,
    error: '',
    items: normalizedItems,
    revision: 0,
    status: normalizedItems.length ? 'ready' : 'idle',
  };
}

function updateQueueState(state, changes) {
  return {
    ...state,
    ...changes,
    revision: state.revision + 1,
  };
}

function clampQueueIndex(index, itemCount) {
  if (!itemCount) {
    return -1;
  }
  return Math.max(0, Math.min(itemCount - 1, Math.floor(Number(index) || 0)));
}

function reducePlaybackQueueState(value, action = {}) {
  const state = value && PLAYBACK_QUEUE_STATUSES.has(value.status)
    ? value
    : createPlaybackQueueState();

  switch (String(action.type || '').toLowerCase()) {
    case 'load':
      return createPlaybackQueueState(action.items);
    case 'append': {
      const appended = normalizeQueueItems(action.items);
      if (!appended.length) {
        return state;
      }
      const items = state.items.concat(appended);
      return updateQueueState(state, {
        currentIndex: state.currentIndex < 0 ? 0 : state.currentIndex,
        items,
        status: state.status === 'idle' || state.status === 'complete' ? 'ready' : state.status,
      });
    }
    case 'play':
      return state.items.length
        ? updateQueueState(state, {
          currentIndex: clampQueueIndex(state.currentIndex, state.items.length),
          error: '',
          status: 'playing',
        })
        : state;
    case 'pause':
      return state.status === 'playing' ? updateQueueState(state, { status: 'paused' }) : state;
    case 'resume':
      return state.status === 'paused' ? updateQueueState(state, { status: 'playing' }) : state;
    case 'next': {
      if (!state.items.length || state.currentIndex >= state.items.length - 1) {
        return state.items.length ? updateQueueState(state, { status: 'complete' }) : state;
      }
      return updateQueueState(state, {
        currentIndex: state.currentIndex + 1,
        status: state.status === 'paused' ? 'paused' : 'playing',
      });
    }
    case 'previous':
      return state.items.length
        ? updateQueueState(state, {
          currentIndex: clampQueueIndex(state.currentIndex - 1, state.items.length),
          status: state.status === 'paused' ? 'paused' : 'playing',
        })
        : state;
    case 'select':
      return state.items.length
        ? updateQueueState(state, {
          currentIndex: clampQueueIndex(action.index, state.items.length),
          status: state.status === 'paused' ? 'paused' : 'ready',
        })
        : state;
    case 'fail':
      return updateQueueState(state, {
        error: String(action.error || 'Playback failed.'),
        status: 'error',
      });
    case 'stop':
      return updateQueueState(state, {
        currentIndex: state.items.length ? 0 : -1,
        error: '',
        status: state.items.length ? 'ready' : 'idle',
      });
    case 'clear':
      return createPlaybackQueueState();
    default:
      return state;
  }
}

function getCurrentPlaybackItem(state) {
  if (!state || !Array.isArray(state.items)) {
    return null;
  }
  return state.items[state.currentIndex] || null;
}

module.exports = {
  PLAYBACK_QUEUE_STATUSES,
  createPlaybackQueueState,
  getCurrentPlaybackItem,
  normalizeQueueItems,
  reducePlaybackQueueState,
};
