import fs from 'fs'
import path from 'path'

// Path to your main domains JSON (the one with domains → sets → pieces)
const domainsPath = path.resolve('./src/data/relics.json')
const outputPath = path.resolve('./src/data/relicLookup.json')

// Read the domains JSON
const domainsData = JSON.parse(fs.readFileSync(domainsPath, 'utf-8'))

const relicLookup = {}

// Flatten domains → sets → pieces into relicLookup
for (const domain of domainsData.domains || []) {
  for (const set of domain.sets || []) {
    const pieces = set.pieces || {}
    for (const [slot, relicName] of Object.entries(pieces)) {
      relicLookup[relicName] = {
        name: relicName,
        set: set.name,
        slot,
        domain: domain.name,
        imagePath: set.imagePath || '',
      }
    }
  }
}

// Write the flattened lookup
fs.writeFileSync(outputPath, JSON.stringify(relicLookup, null, 2), 'utf-8')
console.log(`✅ relicLookup.json created with ${Object.keys(relicLookup).length} relics`)
