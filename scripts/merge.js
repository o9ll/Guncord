const fs = require('fs');
const current = {
  "1020801845490356245": [
    {
      "badge": "https://i.imgur.com/SxrexRu.png",
      "tooltip": "Early Verified Developer",
      "auto": true
    },
    {
      "badge": "https://i.imgur.com/YR1DCoB.png",
      "tooltip": "Early Supporter",
      "auto": true
    },
    {
      "badge": "https://i.imgur.com/Wyw0BqM.png",
      "tooltip": "Partner",
      "auto": true
    }
  ]
};

const old = {
  "1020801845490356245": [
    {
      "badge": "https://i.imgur.com/SxrexRu.png",
      "tooltip": "Early Verified Developer",
      "auto": true
    },
    {
      "badge": "https://i.imgur.com/YR1DCoB.png",
      "tooltip": "Early Supporter",
      "auto": true
    },
    {
      "badge": "https://i.imgur.com/Wyw0BqM.png",
      "tooltip": "Partner",
      "auto": true
    }
  ]
};

const result = { ...current };

// Merge arrays for duplicate IDs
for (const key in old) {
  if (result[key]) {
    // concatenate uniquely by comparing tooltip and badge
    const existing = result[key];
    const incoming = old[key];
    for (const badge of incoming) {
      if (!existing.some(e => e.badge === badge.badge && e.tooltip === badge.tooltip)) {
        existing.push(badge);
      }
    }
  } else {
    result[key] = old[key];
  }
}

fs.writeFileSync('merged_badges.json', JSON.stringify(result, null, 2));
console.log("MERGE SUCCESS");
