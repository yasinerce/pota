const fs = require('fs');
const path = require('path');

const srcDir = __dirname;
const destDir = path.join(__dirname, 'www');

// Ensure www exists
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir);
}

// Files to copy
const files = [
  'index.html',
  'boot.js',
  'game.js',
  'mp.js',
  'sw.js',
  'manifest.json'
];

// Folders to copy
const folders = ['icons', 'tools', 'docs'];

// Copy files
files.forEach(file => {
  const src = path.join(srcDir, file);
  const dest = path.join(destDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
});

// Helper for copying directories recursively
function copyDirectoryRecursiveSync(source, target) {
  if (!fs.existsSync(source)) return;
  
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target);
  }

  const items = fs.readdirSync(source);
  items.forEach(item => {
    const curSource = path.join(source, item);
    const curTarget = path.join(target, item);
    if (fs.lstatSync(curSource).isDirectory()) {
      copyDirectoryRecursiveSync(curSource, curTarget);
    } else {
      fs.copyFileSync(curSource, curTarget);
    }
  });
}

// Copy folders
folders.forEach(folder => {
  const src = path.join(srcDir, folder);
  const dest = path.join(destDir, folder);
  if (fs.existsSync(src)) {
    copyDirectoryRecursiveSync(src, dest);
  }
});

console.log('Build completed! Files copied to www folder.');
