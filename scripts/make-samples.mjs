// Generates the synthetic test datasets in samples/.
// The companies are invented. Each file has a different shape on purpose,
// to prove the generator copes with columns it has never seen.
// Run: node scripts/make-samples.mjs
import { writeFileSync, mkdirSync } from 'node:fs'

// Small seeded random generator so the files are the same on every run.
let seed = 20261104
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
const pick = (list) => list[Math.floor(rand() * list.length)]
const pickSome = (list, min, max) => {
  const count = min + Math.floor(rand() * (max - min + 1))
  return [...new Set(Array.from({ length: count }, () => pick(list)))]
}

const prefixes = ['Nova', 'Vita', 'Clear', 'Bright', 'Arc', 'Kin', 'Lumen', 'Tide', 'Fern', 'Orbit', 'Pulse', 'Quill', 'Sable', 'Torch', 'Verge', 'Wren', 'Zeal', 'Haven', 'Iris', 'Juno', 'Moss', 'Nimbus', 'Opal', 'Pike', 'Rook', 'Sol', 'Thorn', 'Umber', 'Vale', 'Yew']
const suffixes = ['ly', 'io', 'Labs', 'Health', 'Works', 'AI', 'Bio', 'Grid', 'Loop', 'Base', 'Mind', 'Path', 'Sense', 'Stack', 'Wave']
const names = new Set()
function companyName() {
  let name
  do { name = `${pick(prefixes)}${pick(suffixes)}` } while (names.has(name))
  names.add(name)
  return name
}

const ukRegions = ['London', 'London', 'London', 'London', 'South East', 'East of England', 'North West', 'Scotland', 'South West', 'West Midlands', 'Yorkshire and the Humber', 'Wales', 'North East', 'Northern Ireland', 'East Midlands']
const stages = ['Seed', 'Venture', 'Venture', 'Growth', 'Established']
const bands = ['1-4', '5-9', '10-24', '25-49', '50-99', '100-249', '250-499', '500-999']

// Fundraising totals follow a long tail, like the real fintech list.
const amounts = (count, top, bottom) =>
  Array.from({ length: count }, (_, i) => Math.round(top * Math.pow(bottom / top, i / (count - 1)) * (0.9 + rand() * 0.2)))
    .sort((a, b) => b - a)

const csvCell = (value, delimiter = ',') => {
  const text = String(value)
  return text.includes(delimiter) || text.includes('"') || text.includes('\n') ? `"${text.replace(/"/g, '""')}"` : text
}
const toCsv = (header, rows, delimiter = ',') =>
  [header, ...rows].map((row) => row.map((cell) => csvCell(cell, delimiter)).join(delimiter)).join('\n') + '\n'

mkdirSync('samples', { recursive: true })

// 1. Healthtech: same idea as the fintech file, different column names, top 50.
{
  const tags = ['Digital health', 'Diagnostics', 'Medical devices', 'Mental health', 'Telehealth', 'Genomics', 'Clinical software', 'Wearables', 'Drug discovery']
  const raised = amounts(50, 180_000_000, 3_000_000)
  const rows = raised.map((amount, i) => {
    const name = companyName()
    const area = pickSome(tags, 1, 3)
    return [i + 1, name, pick(ukRegions), pick(stages), pick(bands), amount, `${name} develops ${area[0].toLowerCase()} technology for the NHS and private clinics.`, `https://www.${name.toLowerCase()}.co.uk`, area.join(', ')]
  })
  writeFileSync('samples/healthtech-uk-top-50.csv', toCsv(['Position', 'Company Name', 'Location', 'Funding Stage', 'Headcount', 'Amount Raised (GBP)', 'About', 'URL', 'Sectors'], rows))
}

// 2. Cleantech: dollars written as "$2.5m", countries instead of UK regions, no rank column.
{
  const countries = ['Germany', 'France', 'Netherlands', 'Sweden', 'Denmark', 'Spain', 'Norway', 'Finland', 'Ireland', 'United Kingdom']
  const tags = ['Solar', 'Battery storage', 'Hydrogen', 'Carbon capture', 'EV charging', 'Grid software', 'Heat pumps', 'Recycling']
  const raised = amounts(80, 1_400_000_000, 1_500_000)
  const rows = raised
    .map((amount) => {
      const name = companyName()
      const money = amount >= 1e9 ? `$${(amount / 1e9).toFixed(2)}b` : `$${(amount / 1e6).toFixed(1)}m`
      return [name, pick(countries), pick(stages).toLowerCase(), 5 + Math.floor(rand() * 900), money, 2008 + Math.floor(rand() * 17), `${name.toLowerCase()}.eu`, pickSome(tags, 1, 3).join(' | ')]
    })
    .sort(() => rand() - 0.5) // shuffled, so the app has to rank by money itself
  writeFileSync('samples/cleantech-europe.csv', toCsv(['name', 'country', 'stage', 'employees', 'total_funding_usd', 'founded', 'website', 'tags'], rows))
}

// 3. AI startups: extra columns the app has never seen, and no location column at all.
{
  const focus = ['Foundation models', 'Computer vision', 'AI agents', 'Speech', 'MLOps', 'AI safety', 'Robotics', 'Legal AI']
  const investors = ['Northlight Ventures', 'Hollow Oak Capital', 'Seven Bridges VC', 'Mercer Point', 'Blue Kite Partners']
  const raised = amounts(30, 95_000_000, 2_200_000)
  const rows = raised.map((amount) => {
    const name = companyName()
    const year = 2016 + Math.floor(rand() * 9)
    const month = String(1 + Math.floor(rand() * 12)).padStart(2, '0')
    return [name, year, 3 + Math.floor(rand() * 240), `£${amount.toLocaleString('en-GB')}`, pick(investors), `${name} builds ${pick(focus).toLowerCase()} products for enterprise customers.`, pickSome(focus, 1, 2).join('; '), `https://${name.toLowerCase()}.ai`, `2026-${month}-01`]
  })
  writeFileSync('samples/ai-startups-uk.csv', toCsv(['Startup', 'Year Founded', 'Team Size', 'Total Equity Raised', 'Lead Investor', 'Description', 'Focus Areas', 'Website', 'Last Round'], rows))
}

// 4. Proptech, deliberately messy: semicolons, a byte order mark, stray spaces,
// "N/A" and blank cells, mixed money formats, a blank row and duplicate rows.
{
  const raised = amounts(40, 60_000_000, 500_000)
  const formats = [
    (n) => `£${(n / 1e6).toFixed(1)}m`,
    (n) => String(n),
    (n) => `£ ${n.toLocaleString('en-GB')}`,
    (n) => `${(n / 1e6).toFixed(2)} million`
  ]
  const rows = raised.map((amount, i) => {
    const name = companyName()
    const money = i % 11 === 7 ? 'N/A' : pick(formats)(amount)
    const region = i % 9 === 4 ? '' : `  ${pick(ukRegions)} `
    const staff = i % 7 === 3 ? 'n/a' : pick(bands)
    return [` ${name}`, money, region, pick(stages).toUpperCase(), staff, i % 6 === 2 ? '' : `www.${name.toLowerCase()}.com`, 'Property management; Lettings']
  })
  rows.splice(10, 0, ['', '', '', '', '', '', ''])
  rows.push(rows[3], rows[15], rows[22])
  const body = toCsv([' Company ', 'Raised', 'Region', 'Stage', 'Staff', 'Site ', 'Tags'], rows, ';')
  writeFileSync('samples/messy-proptech.csv', '﻿' + body.replace(/\n/g, '\r\n'))
}

console.log('Wrote 4 synthetic samples to samples/')
