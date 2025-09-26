// src/ai/policy.js
export const Policy = {
  maxHistory: 40,
  verbosity: localStorage.getItem('ai_verbosity') || 'descriptive', // CHANGED DEFAULT TO 'descriptive'
  loosenThresholds: {
    friendship: 30,
    romance: 50,
  },
  stylePrompt(level) {
    const v = level || this.verbosity;
    if (v === 'descriptive') return 'Be vivid but avoid unnecessary scene dressing.'; // Used for descriptive mode
    if (v === 'balanced') return 'Be clear and specific with brief descriptive touches.';
    return 'Keep replies focused, short, and conversational.';
  }
};
