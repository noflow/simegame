// chat/index.js (shim) — forward to unified runtime sender
export function sendCurrentMessage() {
  if (typeof window.sendCurrentMessage === 'function') {
    window.sendCurrentMessage();
  } else {
    console.warn('sendCurrentMessage not yet available.');
  }
}
