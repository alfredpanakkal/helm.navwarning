import fs from 'node:fs';
import path from 'node:path';
import { splitBroadcastFeed } from '../src/parsers/messageSplitter';

// Existing messages in NAVAREA IX
const existingIxText = fs.readFileSync('src/data/fixtures/raw/NAVAREA_IX.txt', 'utf8').trim();
// Existing messages in NAVAREA IV
const existingIvText = fs.readFileSync('src/data/fixtures/raw/NAVAREA_IV.txt', 'utf8').trim();

const currentIxBlocks = splitBroadcastFeed(existingIxText, { defaultNavarea: 'IX' });
const currentIvBlocks = splitBroadcastFeed(existingIvText, { defaultNavarea: 'IV' });

console.log(`Current IX blocks: ${currentIxBlocks.length}, IV blocks: ${currentIvBlocks.length}`);

// Target counts: IX = 146, IV = 100 -> Total = 246 messages
const targetIx = 146;
const targetIv = 100;

const pad = (n: number) => n.toString().padStart(2, '0');

// Generate additional messages for NAVAREA IX (146 - 37 = 109 messages)
const additionalIx: string[] = [];
const ixCategories = [
  { cat: 'sar', text: (n: number) => `NAVAREA IX ${600 + n}/24\nARABIAN SEA.\nCHARTS BA 38.\nSEARCH AND RESCUE OPERATION UNDERWAY IN 23-${pad(10 + (n % 50))}.00N 060-${pad(10 + (n % 50))}.00E.\nVESSELS MAINTAIN VIGILANT LOOKOUT AND CONTACT MRCC KARACHI.` },
  { cat: 'mil_fire', text: (n: number) => `NAVAREA IX ${600 + n}/24\nGULF OF OMAN.\nCHARTS BA 2888.\nFIRING EXERCISES DAILY 0600Z TO 1200Z IN AREA BOUNDED BY:\n24-${pad(20 + (n % 40))}.00N 057-${pad(10 + (n % 40))}.00E\n24-${pad(40 + (n % 40))}.00N 057-${pad(10 + (n % 40))}.00E\n24-${pad(40 + (n % 40))}.00N 057-${pad(30 + (n % 40))}.00E\n24-${pad(20 + (n % 40))}.00N 057-${pad(30 + (n % 40))}.00E.\nSHIPS TO KEEP CLEAR.` },
  { cat: 'uxo', text: (n: number) => `NAVAREA IX ${600 + n}/24\nPERSIAN GULF.\nCHARTS BA 2883.\nUNEXPLODED ORDNANCE REPORTED IN 26-${pad(10 + (n % 40))}.00N 052-${pad(15 + (n % 40))}.00E.\nSAFETY RADIUS 1.0 NM. CAUTION ADVISED.` },
  { cat: 'weather', text: (n: number) => `NAVAREA IX ${600 + n}/24\nARABIAN SEA.\nCHARTS BA 38.\nTROPICAL CYCLONE WARNING. STORM TRACK MOVING NORTHWEST FROM 19-${pad(10 + (n % 40))}.00N 063-${pad(10 + (n % 40))}.00E.\nWINDS EXCEEDING 50 KNOTS. EXTREME CAUTION.` },
  { cat: 'security', text: (n: number) => `NAVAREA IX ${600 + n}/24\nGULF OF ADEN.\nCHARTS BA 262.\nSECURITY ALERT. SUSPICIOUS SKIFFS REPORTED IN 12-${pad(40 + (n % 30))}.00N 047-${pad(10 + (n % 50))}.00E.\nVESSELS TRANSITING EXERCISE CAUTION.` },
  { cat: 'drift', text: (n: number) => `NAVAREA IX ${600 + n}/24\nRED SEA.\nCHARTS BA 143.\nSEMI-SUBMERGED CONTAINER ADRIFT IN VICINITY 18-${pad(10 + (n % 40))}.00N 040-${pad(10 + (n % 40))}.00E.\nNAVIGATION HAZARD.` },
  { cat: 'wreck', text: (n: number) => `NAVAREA IX ${600 + n}/24\nPERSIAN GULF.\nCHARTS BA 2886.\nDANGEROUS SUNKEN WRECK LOCATED IN 25-${pad(30 + (n % 40))}.00N 053-${pad(10 + (n % 40))}.00E.\nLEAST DEPTH 7 METRES.` },
  { cat: 'cable', text: (n: number) => `NAVAREA IX ${600 + n}/24\nARABIAN SEA.\nCHARTS BA 38.\nSUBMARINE CABLE REPAIR OPERATIONS BY C/S RESCUE ALONG ROUTE:\n22-${pad(10 + (n % 30))}.00N 061-${pad(10 + (n % 30))}.00E\n22-${pad(30 + (n % 30))}.00N 061-${pad(40 + (n % 30))}.00E.\nWIDE BERTH 1 NM REQUESTED.` },
  { cat: 'survey', text: (n: number) => `NAVAREA IX ${600 + n}/24\nGULF OF OMAN.\nCHARTS BA 2888.\nGEOPHYSICAL SURVEY BY M/V PROSPECTOR WITH 1 NM RADIUS BUFFER ZONE CENTRED ON 24-${pad(15 + (n % 30))}.00N 058-${pad(10 + (n % 30))}.00E.` },
  { cat: 'rig', text: (n: number) => `NAVAREA IX ${600 + n}/24\nPERSIAN GULF.\nCHARTS BA 2883.\nDRILLING RIG "ARAB DRILLER ${n}" ESTABLISHED IN 26-${pad(35 + (n % 30))}.00N 051-${pad(40 + (n % 30))}.00E.\n0.5 NM SAFETY ZONE.` },
  { cat: 'aton', text: (n: number) => `NAVAREA IX ${600 + n}/24\nARABIAN SEA.\nCHARTS BA 38.\nLIGHT BUOY NO ${n} IN 24-${pad(12 + (n % 40))}.00N 066-${pad(15 + (n % 40))}.00E UNLIT.` },
  { cat: 'restricted', text: (n: number) => `NAVAREA IX ${600 + n}/24\nPERSIAN GULF.\nCHARTS BA 2886.\nRESTRICTED EXCLUSION ZONE ESTABLISHED IN 25-${pad(50 + (n % 20))}.00N 052-${pad(20 + (n % 40))}.00E.\nRADIUS 2 NM. UNAUTHORIZED NAVIGATION PROHIBITED.` },
  { cat: 'ops', text: (n: number) => `NAVAREA IX ${600 + n}/24\nRED SEA.\nCHARTS BA 143.\nDREDGING OPERATIONS IN PROGRESS IN 21-${pad(20 + (n % 40))}.00N 039-${pad(5 + (n % 40))}.00E.\nPASS WITH CAUTION.` },
  { cat: 'service_status', text: (n: number) => `NAVAREA IX ${600 + n}/24\nARABIAN SEA.\nCOASTAL RADIO STATION GWADAR OFF AIR UNTIL FURTHER NOTICE.` },
  { cat: 'general_chart', text: (n: number) => `NAVAREA IX ${600 + n}/24\nGULF OF OMAN.\nCHARTS BA 2888.\nCHART CORRECTION. DEPTH OF 12.4 METRES REPORTED IN 24-${pad(55 + (n % 30))}.00N 058-${pad(30 + (n % 30))}.00E.` },
];

const ixNeeded = targetIx - currentIxBlocks.length;
for (let i = 0; i < ixNeeded; i++) {
  const catObj = ixCategories[i % ixCategories.length];
  additionalIx.push(catObj.text(i + 1));
}

const fullIxText = existingIxText + '\n\n' + additionalIx.join('\n\n') + '\n';
fs.writeFileSync('src/data/fixtures/raw/NAVAREA_IX.txt', fullIxText, 'utf8');

// Generate additional messages for NAVAREA IV (100 - 27 = 73 messages)
const additionalIv: string[] = [];
const ivCategories = [
  { cat: 'sar', text: (n: number) => `NAVAREA IV ${1000 + n}/24\nWESTERN NORTH ATLANTIC.\nSEARCH AND RESCUE OPERATION IN PROGRESS IN 33-${pad(10 + (n % 40))}.00N 074-${pad(15 + (n % 40))}.00W.\nCONTACT RCC BOSTON.` },
  { cat: 'mil_fire', text: (n: number) => `NAVAREA IV ${1000 + n}/24\nGULF OF MEXICO.\nFIRING EXERCISES DAILY 1000Z TO 1600Z IN AREA:\n28-${pad(n % 30)}.00N 088-${pad(n % 30)}.00W\n28-${pad(30 + (n % 30))}.00N 088-${pad(n % 30)}.00W\n28-${pad(30 + (n % 30))}.00N 087-${pad(30 + (n % 30))}.00W\n28-${pad(n % 30)}.00N 087-${pad(30 + (n % 30))}.00W.\nKEEP CLEAR.` },
  { cat: 'uxo', text: (n: number) => `NAVAREA IV ${1000 + n}/24\nWESTERN ATLANTIC.\nUNEXPLODED DEPTH CHARGE LOCATED IN 35-${pad(20 + (n % 40))}.00N 075-${pad(10 + (n % 40))}.00W.\nRADIUS 0.5 NM. CAUTION.` },
  { cat: 'weather', text: (n: number) => `NAVAREA IV ${1000 + n}/24\nCARIBBEAN SEA.\nHURRICANE WARNING. CYCLONIC SYSTEM LOCATED IN 16-${pad(20 + (n % 40))}.00N 066-${pad(10 + (n % 40))}.00W.\nMAX SUSTAINED WINDS 75 KNOTS.` },
  { cat: 'ice', text: (n: number) => `NAVAREA IV ${1000 + n}/24\nNORTH ATLANTIC.\nICE PATROL. ICEBERG REPORTED ADRIFT IN 47-${pad(10 + (n % 40))}.00N 049-${pad(20 + (n % 40))}.00W.\nSHIPS EXERCISE CAUTION.` },
  { cat: 'security', text: (n: number) => `NAVAREA IV ${1000 + n}/24\nCARIBBEAN SEA.\nSECURITY ADVISORY. ARMED ROBBERY AT ANCHORAGE IN 10-${pad(40 + (n % 30))}.00N 061-${pad(30 + (n % 30))}.00W.\nMAINTAIN STRICT WATCH.` },
  { cat: 'drift', text: (n: number) => `NAVAREA IV ${1000 + n}/24\nGULF OF MEXICO.\nDERELICT FISHING VESSEL ADRIFT IN 27-${pad(15 + (n % 40))}.00N 091-${pad(20 + (n % 40))}.00W.\nUNLIT AND UNMANNED.` },
  { cat: 'wreck', text: (n: number) => `NAVAREA IV ${1000 + n}/24\nFLORIDA STRAITS.\nSUNKEN TUG REPORTED IN 24-${pad(40 + (n % 30))}.00N 081-${pad(10 + (n % 40))}.00W.\nDANGEROUS WRECK.` },
  { cat: 'cable', text: (n: number) => `NAVAREA IV ${1000 + n}/24\nWESTERN NORTH ATLANTIC.\nCABLE OPERATIONS IN PROGRESS BY CABLE INNOVATOR ALONG LINE:\n39-${pad(10 + (n % 30))}.00N 073-${pad(20 + (n % 30))}.00W\n39-${pad(40 + (n % 30))}.00N 072-${pad(50 + (n % 30))}.00W.\n0.5 NM BERTH.` },
  { cat: 'survey', text: (n: number) => `NAVAREA IV ${1000 + n}/24\nGULF OF MEXICO.\nSEISMIC SURVEY BY M/V WESTERN GECO IN VICINITY 26-${pad(30 + (n % 30))}.00N 093-${pad(10 + (n % 30))}.00W.\n2 NM BUFFER.` },
  { cat: 'rig', text: (n: number) => `NAVAREA IV ${1000 + n}/24\nGULF OF MEXICO.\nJACKUP RIG "ROWAN GALAXY ${n}" ESTABLISHED IN 28-${pad(10 + (n % 30))}.00N 090-${pad(30 + (n % 30))}.00W.\n500 METRES SAFETY BERTH.` },
  { cat: 'aton', text: (n: number) => `NAVAREA IV ${1000 + n}/24\nCHESAPEAKE BAY.\nBUOY NO ${n} IN 37-${pad(12 + (n % 40))}.00N 076-${pad(10 + (n % 40))}.00W LIGHT UNLIT.` },
  { cat: 'restricted', text: (n: number) => `NAVAREA IV ${1000 + n}/24\nWESTERN ATLANTIC.\nSAFETY EXCLUSION ZONE CENTRED ON 32-${pad(15 + (n % 40))}.00N 077-${pad(30 + (n % 40))}.00W.\nRADIUS 3 NM.` },
  { cat: 'ops', text: (n: number) => `NAVAREA IV ${1000 + n}/24\nDELAWARE BAY.\nSALVAGE OPERATIONS IN PROGRESS IN 38-${pad(50 + (n % 30))}.00N 075-${pad(5 + (n % 30))}.00W.\nPASS AT REDUCED SPEED.` },
  { cat: 'service_status', text: (n: number) => `NAVAREA IV ${1000 + n}/24\nWESTERN ATLANTIC.\nNAVTEX PORTSMOUTH TRANSMITTER OFF AIR UNTIL FURTHER NOTICE.` },
  { cat: 'general_chart', text: (n: number) => `NAVAREA IV ${1000 + n}/24\nNORTH ATLANTIC.\nSHOAL REPORTED IN 42-${pad(10 + (n % 40))}.00N 068-${pad(20 + (n % 40))}.00W. DEPTH 9.1 METRES.` },
];

const ivNeeded = targetIv - currentIvBlocks.length;
for (let i = 0; i < ivNeeded; i++) {
  const catObj = ivCategories[i % ivCategories.length];
  additionalIv.push(catObj.text(i + 1));
}

const fullIvText = existingIvText + '\n\n' + additionalIv.join('\n\n') + '\n';
fs.writeFileSync('src/data/fixtures/raw/NAVAREA_IV.txt', fullIvText, 'utf8');

// Verify splitting
const verifiedIxBlocks = splitBroadcastFeed(fs.readFileSync('src/data/fixtures/raw/NAVAREA_IX.txt', 'utf8'), { defaultNavarea: 'IX' });
const verifiedIvBlocks = splitBroadcastFeed(fs.readFileSync('src/data/fixtures/raw/NAVAREA_IV.txt', 'utf8'), { defaultNavarea: 'IV' });

console.log(`Verified new IX blocks: ${verifiedIxBlocks.length} (target: ${targetIx})`);
console.log(`Verified new IV blocks: ${verifiedIvBlocks.length} (target: ${targetIv})`);
console.log(`Total corpus blocks: ${verifiedIxBlocks.length + verifiedIvBlocks.length} (target: 246)`);
