const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'components/LandingPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace minHeight: '350px' with minHeight: '400px' and add height: '500px'
const oldPattern = "minHeight: '350px'";
const newText = "minHeight: '400px',\n                          height: '500px'";

content = content.replace(oldPattern, newText);

fs.writeFileSync(filePath, content);
console.log('Fixed map container height in LandingPage.tsx');
