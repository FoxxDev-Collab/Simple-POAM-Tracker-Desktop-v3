#!/usr/bin/env node

/**
 * POAM Tracker Icon Generator
 * Generates all required Tauri icon formats from the master SVG
 * 
 * Usage: npm install sharp to-ico
 *        node scripts/generate-icons.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import toIco from 'to-ico';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import sharp
const sharp = (await import('sharp')).default;

const MASTER_SVG = path.join(__dirname, '../src-tauri/icons/icon-master.svg');
const ICONS_DIR = path.join(__dirname, '../src-tauri/icons');

// All the icon sizes Tauri needs
const iconSizes = [
  // Standard sizes
  { size: 32, name: '32x32.png' },
  { size: 128, name: '128x128.png' },
  { size: 128, name: '128x128@2x.png', scale: 2 },
  { size: 256, name: 'icon.png' },
  
  // Windows Store sizes
  { size: 30, name: 'Square30x30Logo.png' },
  { size: 44, name: 'Square44x44Logo.png' },
  { size: 71, name: 'Square71x71Logo.png' },
  { size: 89, name: 'Square89x89Logo.png' },
  { size: 107, name: 'Square107x107Logo.png' },
  { size: 142, name: 'Square142x142Logo.png' },
  { size: 150, name: 'Square150x150Logo.png' },
  { size: 284, name: 'Square284x284Logo.png' },
  { size: 310, name: 'Square310x310Logo.png' },
  { size: 50, name: 'StoreLogo.png' },
];

async function generateIcons() {
  console.log('🎨 Generating POAM Tracker icons...\n');

  // Ensure icons directory exists
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  // Check if master SVG exists
  if (!fs.existsSync(MASTER_SVG)) {
    console.error('❌ Master SVG not found at:', MASTER_SVG);
    process.exit(1);
  }

  // Read the master SVG
  const svgBuffer = fs.readFileSync(MASTER_SVG);

  console.log('📐 Generating PNG icons:');
  
  // Generate all PNG sizes
  for (const { size, name, scale = 1 } of iconSizes) {
    const actualSize = size * scale;
    try {
      await sharp(svgBuffer)
        .resize(actualSize, actualSize)
        .png({ quality: 95, compressionLevel: 9 })
        .toFile(path.join(ICONS_DIR, name));
      
      console.log(`  ✅ ${name} (${actualSize}x${actualSize})`);
    } catch (error) {
      console.error(`  ❌ Failed to generate ${name}:`, error.message);
    }
  }

  console.log('\n🖼️  Generating ICO file (Windows):');
  
  // Generate proper ICO file for Windows using to-ico
  try {
    // Create multiple PNG buffers for ICO
    const icoSizes = [16, 24, 32, 48, 64, 128, 256];
    const pngBuffers = [];
    
    for (const size of icoSizes) {
      const buffer = await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toBuffer();
      pngBuffers.push(buffer);
    }
    
    // Convert to ICO format
    const icoBuffer = await toIco(pngBuffers);
    fs.writeFileSync(path.join(ICONS_DIR, 'icon.ico'), icoBuffer);
    
    console.log('  ✅ icon.ico (multi-size ICO format)');
  } catch (error) {
    console.error('  ❌ Failed to generate ICO:', error.message);
  }

  console.log('\n🍎 Generating ICNS source (macOS):');
  
  try {
    await sharp(svgBuffer)
      .resize(1024, 1024)
      .png()
      .toFile(path.join(ICONS_DIR, 'icon-1024.png'));
    
    console.log('  ✅ icon-1024.png (for ICNS conversion)');
    console.log('  ℹ️  To generate ICNS on macOS, run:');
    console.log('     iconutil -c icns -o src-tauri/icons/icon.icns icon-1024.png');
  } catch (error) {
    console.error('  ❌ Failed to generate ICNS source:', error.message);
  }

  console.log('\n✨ Icon generation complete!');
  console.log('\n📋 Summary:');
  console.log(`   Generated ${iconSizes.length} PNG files`);
  console.log('   Generated proper Windows ICO file (multi-size)');
  console.log('   Generated PNG source for ICNS (macOS)');
  
  console.log('\n🔧 Next steps:');
  console.log('   1. Test the app build: npm run tauri:build');
  console.log('   2. Check that icons appear correctly in build output');
}

// Run the generator
generateIcons().catch(console.error); 