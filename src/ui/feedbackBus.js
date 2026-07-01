const _activeBlobs = new Set();

export function markFeedbackActive(blobName) { _activeBlobs.add(blobName); }

export function consumeFeedbackActive() {
  if (_activeBlobs.size === 0) return null;
  const snap = new Set(_activeBlobs);
  _activeBlobs.clear();
  return snap;
}
