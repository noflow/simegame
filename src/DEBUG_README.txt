Debug build notes
=================
- Toggle debug on/off:
  • Add ?debug=1 to the page URL OR press the backtick (`) key to toggle persistent debug mode.
- What you get:
  • Console tables of character include loads (status/added).
  • Boot diagnostics: world passage count, character count, duplicate IDs, schedule locations not in WORLD.
  • Optional on-screen overlay with a quick summary when debug is enabled.
- Quick console helper:
  • window.printBootStatus()