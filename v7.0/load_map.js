/*
    Node.js version of osu! map file loader

 */

// load node_modules
const fs = require('fs')
const Polynomial = require('polynomial')

/* init global data chunks */
/*
let generalData = "";
let editorData = "";
let metaData = "";
let diffData = "";
let timingSectionData = "";
let colorsData = "";
let eventsData = "";
let objectsData = "";
let hitObjs = [];
let hitObjectArray = [];
let sliderMultiplier = 3.6;
let diffSettings = {};
let _source = ''
let _tags = ''
let _titleUnicode = ''
let _artistUnicode = ''
*/

/* functions */

let diffSettings = {}
let sliderBaseLength = 100
let timingSections = []
let uninheritedSections = []

// emm

function parseGeneral (generalLines) {
  let o = {}
  const intSet = ['AudioLeadIn', 'PreviewTime', 'Countdown', 'Mode',
    'LetterboxInBreaks', 'WidescreenStoryboard', 'StoryFireInFront', 'SpecialStyle',
    'EpilepsyWarning', 'UseSkinSprites']; const floatSet = ['StackLeniency']
  for (let line of generalLines) {
    let a = line.split(':')
    let key = a[0].trim(); let value = (a[1] || '').trim()
    if (intSet.indexOf(key) !== -1) {
      o[key] = parseInt(value, 10)
    } else if (floatSet.indexOf(key) !== -1) {
      o[key] = parseFloat(value)
    } else {
      o[key] = value
    }
  }
  return o
}

function reparseGeneral (obj) {
  let o = ''
  for (let key in obj) {
    let value = obj[key]
    o += key + ': ' + value + '\r\n'
  }
  return o.trim()
}

function parseDiffdata (diffData) {
  diffSettings = {}
  diffSettings.HD = Math.min(parseFloat(diffData.match(/HPDrainRate:([0-9.]+)/i)[1]), 10)
  diffSettings.CS = parseFloat(diffData.match(/CircleSize:([0-9.]+)/i)[1])
  diffSettings.OD = parseFloat(diffData.match(/OverallDifficulty:([0-9.]+)/i)[1])
  diffSettings.SV = parseFloat(diffData.match(/SliderMultiplier:([0-9.]+)/i)[1])
  diffSettings.STR = Math.min(parseInt(diffData.match(/SliderTickRate:([0-9]+)/i)[1]), 8)
  let AR = diffData.match(/ApproachRate:([0-9.]+)/i)
  if (AR !== null) {
    AR = parseFloat(AR[1])
  } else {
    AR = diffSettings.OD
  }
  diffSettings.AR = AR
  let arBaseTime = AR > 5 ? 1950 - 150 * AR : 1800 - 1200 * AR
  diffSettings.APC_ScaleTime = arBaseTime
  diffSettings.HC_StandingTime = arBaseTime
  diffSettings.APC_FadeInTime = Math.round(arBaseTime / 3)
  diffSettings.HC_FadeInTime = Math.round(arBaseTime / 3)
  diffSettings.HC_FadeIn2Time = Math.round(arBaseTime / 3)
  diffSettings.HC_FadeIn2Dur = Math.round(arBaseTime / 15)
  // HC_ExplosionTime = Math.round(AR_BaseTime / 8);
  // HC_FadeOutTime = Math.round(AR_BaseTime / 4);
  diffSettings.circleScaling = (128 - 10 * diffSettings.CS) / 128 * (0.85)
  return diffSettings
}

function reparseDiffdata (ds) {
  let o = ''
  o += 'HPDrainRate:' + ds.HD
  o += '\r\nCircleSize:' + ds.CS
  o += '\r\nOverallDifficulty:' + ds.OD
  o += '\r\nApproachRate:' + ds.AR
  o += '\r\nSliderMultiplier:' + ds.SV
  o += '\r\nSliderTickRate:' + ds.STR
  return o
}

function parseHitObjects (hitObjs, gameMode) {
  gameMode = gameMode || 0
  let hitObjectArray = []
  for (let i = 0; i < hitObjs.length; i++) {
    let j = hitObjs[i].split(',')
    let v = {}
    v.x = parseInt(j[0])
    v.y = parseInt(j[1])
    v.time = parseInt(j[2])
    v.type = parseInt(j[3])
    v.hitsounds = parseInt(j[4])
    if (v.type & 2) { // cannot decide with v.sliderPoints
      let _sliderPoints = j[5]
      let _rawSliderPoints = _sliderPoints.split('|')
      v.sliderReverses = parseInt(j[6])
      v.sliderLength = parseFloat(j[7])
      let _sliderSingleHitsounds = j[8]
      if (_sliderSingleHitsounds) {
        v.sliderSingleHitsounds = _sliderSingleHitsounds.split('|')
      } else {
        v.sliderSingleHitsounds = []
      }
      let _sliderExtHitsounds = j[9]
      if (_sliderExtHitsounds) {
        v.sliderExtHitsounds = _sliderExtHitsounds.split('|')
      } else {
        v.sliderExtHitsounds = []
      }
      v.extHitsounds = j[10]

      // extra facts about sliders
      v.sliderData = analyzeSlider({
        x: v.x,
        y: v.y,
        type: v.type,
        time: v.time,
        sliderPoints: _rawSliderPoints,
        sliderLength: v.sliderLength,
        sliderReverses: v.sliderReverses
      })
    } else if (v.type & 8) {
      v.spinnerEndTime = parseInt(j[5], 10)
      v.extHitsounds = j[6]
    } else if (gameMode === 3 && v.type & 128) {
      let maniaHoldData = j[5].split(':')
      v.holdEndTime = parseInt(maniaHoldData[0], 10)
      v.extHitsounds = maniaHoldData.slice(1).join(':')
    } else {
      v.extHitsounds = j[5]
    }
    v.index = i
    hitObjectArray.push(v)
  }
  return hitObjectArray
}

function stringifySliderPoints (st, points) {
  let o = []
  for (let p of points) {
    if (p.type === 'start') {
      continue
    }
    o.push(p.c)
    if (p.type === 'node' && st === 'B') {
      o.push(p.c)
    }
  }
  return o.map(a => a.join(':')).join('|')
}

function reparseHitObjects (hitObjectArray) {
  let o = ''
  for (let i = 0; i < hitObjectArray.length; i++) {
    let v = hitObjectArray[i]
    let j = ''
    j += v.x + ',' + v.y + ',' + v.time + ',' + v.type + ',' + v.hitsounds
    if (v.type & 2) {
      // if sliderData exist, use it instead of sliderPoints
      if (v.sliderData) {
        let st = v.sliderData.type
        let sp = stringifySliderPoints(st, v.sliderData.points)
        j += ',' + st + '|' + sp
      } else {
        j += ',' + v.sliderPoints.join('|')
      }
      j += ',' + v.sliderReverses
      j += ',' + v.sliderLength
      if (v.sliderSingleHitsounds && v.sliderSingleHitsounds.length) {
        j += ',' + v.sliderSingleHitsounds.join('|')
      } else if (v.sliderExtHitsounds && v.sliderExtHitsounds.length) {
        j += ',' + '0'
        for (let s = 0; s < v.sliderReverses; s++) {
          j += '|0'
        }
      }
      if (v.sliderExtHitsounds && v.sliderExtHitsounds.length) {
        j += ',' + v.sliderExtHitsounds.join('|')
        if (v.extHitsounds) {
          j += ',' + v.extHitsounds
        }
      }
    } else if (v.type & 8) {
      j += ',' + v.spinnerEndTime
      if (v.extHitsounds) {
        j += ',' + v.extHitsounds
      }
    } else if (v.type & 128) {
      if (v.extHitsounds) {
        if (v.holdEndTime) {
          j += ',' + v.holdEndTime + ':' + v.extHitsounds
        } else {
          j += ',' + v.extHitsounds
        }
      }
    } else {
      if (v.extHitsounds) {
        j += ',' + v.extHitsounds
      }
    }
    o += j
    if (i !== hitObjectArray.length - 1) {
      o += '\r\n'
    }
  }
  return o
}

function reparseTimeSections (timingSections, diffSettings) {
  let o = ''
  let tsa = timingSections.ts
  let sliderBaseLength = 100
  let tl
  for (let i = 0; i < tsa.length; i++) {
    let ts = tsa[i]
    if (ts.isInherited) {
      tl = -sliderBaseLength * diffSettings.SV * (100 / ts.sliderLength)
    } else {
      tl = ts.tickLength
    }
    let sp = ts.sampleSet === 'normal' ? 1 : (ts.sampleSet === 'drum' ? 3 : 2)
    o += ts.beginTime + ',' + tl + ',' + ts.whiteLines + ',' + sp + ',' + ts.customSet +
      ',' + ts.volume + ',' + (+!ts.isInherited) + ',' + (+ts.isKiai) + '\n'
  }
  return o.trim()
}

function parseTimeSections (timeData) {
  let curTL = 1
  // let curMP = 1
  let a = timeData.replace(/\t/ig, ',').replace(/^(\r?\n)+/ig, '').replace(/(\r?\n)+$/ig, '').split(/\r?\n/i)
  for (let i = 0; i < a.length; i++) {
    let ts = {}
    let j = a[i].split(',')
    let tl = parseFloat(j[1])
    ts.beginTime = Math.round(parseFloat(j[0]))
    ts.whiteLines = parseInt(j[2])
    ts.sampleSet = j[3] === 1 ? 'normal' : (j[3] === 3 ? 'drum' : 'soft')
    ts.customSet = parseInt(j[4])
    ts.volume = parseInt(j[5])
    ts.isKiai = (j[7] === '1')
    if (tl < 0 && curTL > 0) {
      ts.isInherited = true
      ts.tickLength = curTL
      ts.sliderLength = sliderBaseLength * diffSettings.SV * (100 / (-tl)) / 1
      // curMP = 100 / (-tl)
    } else {
      ts.isInherited = false
      curTL = tl
      ts.tickLength = tl
      ts.sliderLength = sliderBaseLength * diffSettings.SV * 1 / 1
      // curMP = 1
    }
    ts.bpm = Math.max(12, 60000 / ts.tickLength)
    timingSections.push(ts)
    if (tl > 0) {
      uninheritedSections.push(ts)
    }
  }
  return {
    ts: timingSections,
    uts: uninheritedSections
  }
}

function getSliderLen (t) {
  let n = 0
  for (let k = 0; k < timingSections.length; k++) {
    if (t >= timingSections[k].beginTime) {
      n = k
    } else {
      return timingSections[n].sliderLength
    }
  }
  return timingSections[n].sliderLength
}

function getTickLen (t) {
  let n = 0
  for (let k = 0; k < timingSections.length; k++) {
    if (t >= timingSections[k].beginTime) {
      n = k
    } else {
      return timingSections[n].tickLength
    }
  }
  return timingSections[n].tickLength
}

function parseMeta (metaData) {
  let artist = ''
  let title = ''
  let _artist = metaData.match(/(^|\n)Artist:([^\r\n]*)(\r?\n|$)/i) || ''
  if (_artist.length) {
    artist = _artist[2].replace(/^[ \t]+/ig, '').replace(/[ \t]+$/ig, '')
  }
  let artist2 = metaData.match(/(^|\n)ArtistUnicode:([^\r\n]*)(\r?\n|$)/i) || _artist
  if (artist2.length) {
    artist2 = artist2[2].replace(/^[ \t]+/ig, '').replace(/[ \t]+$/ig, '')
  }
  let creator = metaData.match(/(^|\n)Creator:([^\r\n]*)(\r?\n|$)/i) || ''
  if (creator.length) {
    creator = creator[2].replace(/^[ \t]+/ig, '').replace(/[ \t]+$/ig, '')
  }
  let _title = metaData.match(/(^|\n)Title:([^\r\n]*)(\r?\n|$)/i) || ''
  if (_title.length) {
    title = _title[2].replace(/^[ \t]+/ig, '').replace(/[ \t]+$/ig, '')
  }
  let title2 = metaData.match(/(^|\n)TitleUnicode:([^\r\n]*)(\r?\n|$)/i) || _title
  if (title2.length) {
    title2 = title2[2].replace(/^[ \t]+/ig, '').replace(/[ \t]+$/ig, '')
  }
  let diffname = metaData.match(/(^|\n)Version:([^\r\n]*)(\r?\n|$)/i) || ''
  if (diffname.length) {
    diffname = diffname[2].replace(/^[ \t]+/ig, '').replace(/[ \t]+$/ig, '')
  }
  let source = metaData.match(/(^|\n)Source:([^\r\n]*)(\r?\n|$)/i) || ''
  if (source.length) {
    source = source[2].replace(/^[ \t]+/ig, '').replace(/[ \t]+$/ig, '')
  }
  let tags = metaData.match(/(^|\n)Tags:([^\r\n]*)(\r?\n|$)/i) || ''
  if (tags.length) {
    tags = tags[2].replace(/^[ \t]+/ig, '').replace(/[ \t]+$/ig, '')
  }
  return {
    artist: artist,
    artist2: artist2,
    diffname: diffname,
    creator: creator,
    title: title,
    title2: title2,
    source: source,
    tags: tags
  }
}

function reparseMeta (w) {
  let o = ''
  o += 'Title:' + w.title + '\r\n'
  if ((w.title2 || '').length) {
    o += 'TitleUnicode:' + w.title2 + '\r\n'
  }
  o += 'Artist:' + w.artist + '\r\n'
  if ((w.artist2 || '').length) {
    o += 'ArtistUnicode:' + w.artist2 + '\r\n'
  }
  o += 'Creator:' + w.creator + '\r\n'
  o += 'Version:' + w.diffname + '\r\n'
  o += 'Source:' + w.source + '\r\n'
  o += 'Tags:' + w.tags
  return o
}

function isWhiteLine (t, err, ext) {
  err = err || 3
  ext = ext || 0
  let us = uninheritedSections
  if (!us.length) {
    return false
  }
  if (t < us[0].beginTime) {
    return false
  }
  for (let i = 0; i < us.length; i++) {
    if (t > us[i].beginTime && ((i === us.length - 1) || t < us[1 + i].beginTime)) {
      t -= ext * us[i].tickLength
      if (Math.abs((t - us[i].beginTime) % us[i].tickLength) <= err) {
        return 1 + (Math.round(Math.abs(t - us[i].beginTime) / us[i].tickLength) % us[i].whiteLines)
      } else if (Math.abs((t - us[i].beginTime) % us[i].tickLength - us[i].tickLength) <= err) {
        return 1 + (Math.round(Math.abs(t - us[i].beginTime) / us[i].tickLength) % us[i].whiteLines)
      } else {
        return false
      }
    }
  }
}

function isWhiteLine2 (t, divisor, err, ext) { // eslint-disable-line no-unused-vars
  err = err || 3
  ext = ext || 0
  let us = uninheritedSections
  if (!us.length) {
    return false
  }
  if (t < us[0].beginTime) {
    return false
  }
  for (let i = 0; i < us.length; i++) {
    if (t > us[i].beginTime && ((i === us.length - 1) || t < us[1 + i].beginTime)) {
      let tkl = us[i].tickLength / divisor
      t -= ext * tkl
      if (Math.abs((t - us[i].beginTime) % tkl) <= err) {
        return 1 + (Math.round(Math.abs(t - us[i].beginTime) / tkl))
      } else if (Math.abs((t - us[i].beginTime) % tkl - tkl) <= err) {
        return 1 + (Math.round(Math.abs(t - us[i].beginTime) / tkl))
      } else {
        return false
      }
    }
  }
}

function output (str) {
  console.log(str)
}

function loadMap (txt) {
  let inputdata
  if (txt) {
    inputdata = txt
  } else {
    output('No map data or cannot load file!')
    return
  }

  let generalData = []
  let editorData = []
  let metaData = []
  let diffData = []
  let timingSectionData = []
  let colorsData = []
  let eventsData = []
  let objectsData = []
  let hitObjs = []
  timingSections = []
  uninheritedSections = []

  let linesepar = inputdata.split(/\r?\n/i)

  let firstLine = linesepar[0]
  if (!/osu file format v[0-9]+/i.test(firstLine)) throw new Error('away the pain')
  let fileVersion = firstLine.match(/osu file format v([0-9]+)/i)[1]

  for (let i = 0; i < linesepar.length; i++) {
    if (linesepar[i].indexOf('[General]') === 0) {
      while (linesepar[i + 1] && !linesepar[i + 1].match(/^\[[a-z]+\]/i)) {
        i++
        generalData.push(linesepar[i])
      }
      continue
    } else if (linesepar[i].indexOf('[Editor]') === 0) {
      while (linesepar[i + 1] && !linesepar[i + 1].match(/^\[[a-z]+\]/i)) {
        i++
        editorData.push(linesepar[i])
      }
      continue
    } else if (linesepar[i].indexOf('[Metadata]') === 0) {
      while (linesepar[i + 1] && !linesepar[i + 1].match(/^\[[a-z]+\]/i)) {
        i++
        metaData.push(linesepar[i])
      }
      continue
    } else if (linesepar[i].indexOf('[Difficulty]') === 0) {
      while (linesepar[i + 1] && !linesepar[i + 1].match(/^\[[a-z]+\]/i)) {
        i++
        diffData.push(linesepar[i])
      }
      continue
    } else if (linesepar[i].indexOf('[TimingPoints]') === 0) {
      while (linesepar[i + 1] && !linesepar[i + 1].match(/^\[[a-z]+\]/i)) {
        i++
        timingSectionData.push(linesepar[i])
      }
      continue
    } else if (linesepar[i].indexOf('[Colours]') === 0) {
      while (linesepar[i + 1] && !linesepar[i + 1].match(/^\[[a-z]+\]/i)) {
        i++
        colorsData.push(linesepar[i])
      }
      continue
    } else if (linesepar[i].indexOf('[Events]') === 0) {
      while (linesepar[i + 1] && !linesepar[i + 1].match(/^\[[a-z]+\]/i)) {
        i++
        eventsData.push(linesepar[i])
      }
      continue
    } else if (linesepar[i].indexOf('[HitObjects]') === 0) {
      while (linesepar[i + 1] && !linesepar[i + 1].match(/^\[[a-z]+\]/i)) {
        i++
        objectsData.push(linesepar[i])
      }
      continue
    }
  }

  let generalLines = generalData
  generalData = generalLines.join('\r\n').replace(/^(\r?\n)+/ig, '').replace(/(\r?\n)+$/ig, '')
  editorData = editorData.join('\r\n').replace(/^(\r?\n)+/ig, '').replace(/(\r?\n)+$/ig, '')
  metaData = metaData.join('\r\n').replace(/^(\r?\n)+/ig, '').replace(/(\r?\n)+$/ig, '')
  diffData = diffData.join('\r\n').replace(/^(\r?\n)+/ig, '').replace(/(\r?\n)+$/ig, '')
  timingSectionData = timingSectionData.join('\r\n').replace(/^(\r?\n)+/ig, '').replace(/(\r?\n)+$/ig, '')
  colorsData = colorsData.join('\r\n').replace(/^(\r?\n)+/ig, '').replace(/(\r?\n)+$/ig, '')
  eventsData = eventsData.join('\r\n').replace(/^(\r?\n)+/ig, '').replace(/(\r?\n)+$/ig, '')
  objectsData = objectsData.join('\r\n').replace(/^(\r?\n)+/ig, '').replace(/(\r?\n)+$/ig, '')

  hitObjs = objectsData.replace(/(\r?\n)+$/, '').split(/\r?\n/i)

  let generalParsed = parseGeneral(generalLines)
  let gameMode = generalParsed.Mode || 0

  let mapObj = {
    fileVersion: fileVersion,
    general: generalParsed,
    editor: editorData,
    meta: parseMeta(metaData),
    diff: parseDiffdata(diffData),
    evt: eventsData,
    timing: parseTimeSections(timingSectionData),
    color: colorsData,
    obj: parseHitObjects(hitObjs, gameMode)
  }
  return mapObj
}

function pDist (a, b) {
  return Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]))
}

// calculates circle center
// stackoverflow#32861804, edited
function calculateCircleCenter (A, B, C) {
  let yDeltaA = B[1] - A[1]
  let xDeltaA = B[0] - A[0]
  let yDeltaB = C[1] - B[1]
  let xDeltaB = C[0] - B[0]

  // somehow this has a bug where denominator gets to 0
  if (xDeltaA === 0) {
    return vecMulNum(vecAdd(
      calculateCircleCenter([A[0] + 0.0001, A[1]], B, C),
      calculateCircleCenter([A[0] - 0.0001, A[1]], B, C)
    ), 0.5)
  }
  if (xDeltaB === 0) {
    return vecMulNum(vecAdd(
      calculateCircleCenter(A, [B[0] + 0.0001, B[1]], C),
      calculateCircleCenter(A, [B[0] - 0.0001, B[1]], C)
    ), 0.5)
  }
  if (yDeltaA === 0) {
    return vecMulNum(vecAdd(
      calculateCircleCenter([A[0], A[1] + 0.0001], B, C),
      calculateCircleCenter([A[0], A[1] - 0.0001], B, C)
    ), 0.5)
  }
  if (yDeltaB === 0) {
    return vecMulNum(vecAdd(
      calculateCircleCenter(A, [B[0], B[1] + 0.0001], C),
      calculateCircleCenter(A, [B[0], B[1] - 0.0001], C)
    ), 0.5)
  }
  let center = []

  let aSlope = yDeltaA / xDeltaA
  let bSlope = yDeltaB / xDeltaB

  center[0] = (aSlope * bSlope * (A[1] - C[1]) + bSlope * (A[0] + B[0]) - aSlope * (B[0] + C[0])) / (2 * (bSlope - aSlope))
  center[1] = -1 * (center[0] - (A[0] + B[0]) / 2) / aSlope + (A[1] + B[1]) / 2
  return center
}

function buildOsuFile (obj) {
  let filedata = ''
  filedata += 'osu file format v14\r\n\r\n[General]\r\n' + reparseGeneral(obj.general) + '\r\n\r\n[Editor]\r\n' + obj.editor
  filedata += '\r\n\r\n[Metadata]\r\n' + reparseMeta(obj.meta) + '\r\n\r\n'
  filedata += '[Difficulty]\r\n' + reparseDiffdata(obj.diff) + '\r\n\r\n[TimingPoints]\r\n' + reparseTimeSections(obj.timing, obj.diff) + '\r\n\r\n'
  filedata += '[Colours]\r\n' + obj.color + '\r\n\r\n'
  filedata += '[Events]\r\n' + obj.evt + '\r\n\r\n'
  filedata += '[HitObjects]\r\n' + reparseHitObjects(obj.obj) + '\r\n'
  return filedata
}

// polynomial utils
function polyCurveIntegration (polys, l, h, dt) {
  // sqrt((dx/dt)^2 + (dy/dt)^2)
  let polyX = polys[0]; let polyY = polys[1]
  dt = dt || 0.001
  let dxDt = polyX.derive()
  let dyDt = polyY.derive()
  let basePoly = dxDt.mul(dxDt).add(dyDt.mul(dyDt))
  let t = 0
  for (let k = l; k < h; k += dt) {
    t += (Math.sqrt(basePoly.eval(k)) + Math.sqrt(basePoly.eval(k + dt))) * dt / 2
  }
  return t
}
function polyLineLengthTable (polyX, polyY, dt) {
  dt = dt || 0.001
  let dxDt = polyX.derive()
  let dyDt = polyY.derive()
  let basePoly = dxDt.mul(dxDt).add(dyDt.mul(dyDt))
  let t = []
  for (let k = 0; k < 1; k += dt) {
    t.push((Math.sqrt(basePoly.eval(k)) + Math.sqrt(basePoly.eval(k + dt))) * dt / 2)
  }
  return t
}
// @param points [[x1, y1], [x2, y2], ..., [xi, yi]]
function getBezierPoly (points) {
  let p0 = new Polynomial(1)

  // coeffs
  for (let i = 0; i < points.length - 1; i++) {
    p0 = p0.mul(new Polynomial([1, 1]))
  }
  p0.coeff.length = points.length
  let coeff = [].slice.call(p0.coeff)

  // x, 1-x; create every polynomial and add up
  const _p = new Polynomial([0, 1]); const _q = new Polynomial([1, -1])
  let px = new Polynomial([0]); let py = new Polynomial([0])
  for (let i = 0; i < points.length; i++) {
    let ptimes = i; let qtimes = points.length - i - 1; let co = coeff[i]
    let pCur = new Polynomial([co])
    for (let k = 0; k < ptimes; k++) {
      pCur = pCur.mul(_p)
    }
    for (let k = 0; k < qtimes; k++) {
      pCur = pCur.mul(_q)
    }
    px = px.add(pCur.mul(points[i][0]))
    py = py.add(pCur.mul(points[i][1]))
  }
  return [px, py]
}

function getPolyTangent (polys, t) {
  let polyX = polys[0]; let polyY = polys[1]
  let dxDt = polyX.derive()
  let dyDt = polyY.derive()
  return [dxDt.eval(t), dyDt.eval(t)]
}

// cut a bezier to length k, return {
//     t: t-value
//     c: coords
//     l: integration
// }
// prec is t-value precision not length precision
// you can simply omit it
function cutBezier (polys, target, prec) {
  prec = prec || 0.001
  let table = polyLineLengthTable(polys[0], polys[1], prec)
  if (target > table.reduce((t, a) => t + a, 0) + 0.5) {
    return null
  }
  let tot = 0
  let s
  for (let i = 0; i < table.length; i++) {
    if (tot === target) {
      s = i * prec
      return { t: s, c: [polys[0].eval(s), polys[1].eval(s)], l: tot }
    } else if (tot + table[i] > target) {
      s = Math.min(1, (i + 1 / 2) * prec)
      return { t: s, c: [polys[0].eval(s), polys[1].eval(s)], l: tot + table[i] / 2 }
    }
    tot += table[i]
  }
  return { t: 1, c: [polys[0].eval(1), polys[1].eval(1)], l: target }
}

// some simple vector functions
const vecAdd = (c1, c2) => [c1[0] + c2[0], c1[1] + c2[1]]
const vecSub = (c1, c2) => [c1[0] - c2[0], c1[1] - c2[1]]
const vecMulNum = (c1, n) => [c1[0] * n, c1[1] * n]
const vecRound = (c1) => [Math.round(c1[0]), Math.round(c1[1])]
const vecLen = (c1) => Math.sqrt(c1[0] * c1[0] + c1[1] * c1[1])

function calculateBezierData (beziers, totalLen) {
  let curves = []; let remlen = totalLen; let lastTangent = []
  let firstTangent = vecSub(beziers[0][1], beziers[0][0])
  let partLen
  for (let bezier of beziers) {
    if (bezier.length === 2) { // line
      partLen = pDist(bezier[0], bezier[1])
      if (remlen > partLen - 0.5) {
        curves.push({
          type: 'line',
          from: bezier[0],
          to: bezier[1],
          points: bezier,
          len: partLen
        })
        lastTangent = vecSub(bezier[1], bezier[0])
        remlen -= partLen
      } else {
        let endPoint = vecRound(vecAdd(bezier[0], vecMulNum(vecSub(bezier[1], bezier[0]), remlen / partLen)))
        curves.push({
          type: 'line',
          from: bezier[0],
          to: endPoint,
          points: bezier,
          len: remlen
        })
        lastTangent = vecSub(bezier[1], bezier[0])
        remlen = -99
        break
      }
    } else { // bezier
      let bezierPoly = getBezierPoly(bezier)
      partLen = polyCurveIntegration(bezierPoly, 0, 1)
      if (remlen > partLen - 0.5) {
        curves.push({
          type: 'bezier',
          from: bezier[0],
          to: bezier[bezier.length - 1],
          points: bezier,
          len: partLen
        })
        remlen -= partLen
        if (remlen < 0.5) {
          lastTangent = getPolyTangent(bezierPoly, 1)
        }
      } else {
        let cutted = cutBezier(bezierPoly, remlen, 0.001)
        curves.push({
          type: 'bezier',
          from: bezier[0],
          to: vecRound(cutted.c),
          points: bezier,
          len: remlen
        })
        if (partLen > 0) {
          lastTangent = getPolyTangent(bezierPoly, remlen / partLen)
        } else {
          lastTangent = getPolyTangent(bezierPoly, 1)
        }
        remlen = -99
        break
      }
    }
  }
  firstTangent = vecMulNum(firstTangent, 1 / vecLen(firstTangent))
  lastTangent = vecMulNum(lastTangent, 1 / vecLen(lastTangent))
  return {
    curves: curves,
    firstTangent: firstTangent,
    lastTangent: lastTangent
  }
}

/*
 * @param note: single slider note
 *
 * returns {
 *     c: coords
 *     type: type
 *     and stuff like that
 * }
 */
function analyzeSlider (note) {
  if ((note.type & 2) === 0) {
    output('Error in analyzeSlider at ' + note.time + ': Not a slider')
    return {}
  }
  let beginPoint = [note.x, note.y]
  let pts = note.sliderPoints
  let len = note.sliderLength
  let remlen = len // Remaining Length
  let prevPoint = beginPoint
  let sliderType = pts[0]
  let outPoints = []
  let outCurves = []
  let outEndPoint = null
  let outFirstTangent = null
  let outLastTangent = null
  let outEndTime = Math.floor(note.time + note.sliderReverses * len / getSliderLen(note.time) * getTickLen(note.time))

  if (pts.length === 2) {
    sliderType = 'L' // Fix bug in 66929
  }

  switch (sliderType) {
    case 'L': // linear
    case 'C': { // parse it as if it were linear; no one uses it anyways
      outPoints.push({ c: beginPoint, type: 'start' })
      for (let i = 1; i < pts.length; i++) {
        let c0 = pts[i].split(':')
        let c = [+c0[0], +c0[1]]
        outPoints.push({ c: c, type: (i === pts.length - 1) ? 'end' : 'node' })

        if (remlen > -0.5) {
          let partLen = pDist(prevPoint, c)
          if (partLen <= remlen + 0.5) {
            outCurves.push({
              type: 'line',
              from: prevPoint,
              to: c,
              points: [prevPoint, c],
              len: partLen
            })
            remlen -= partLen
          } else {
            let endPoint = vecRound(vecAdd(prevPoint, vecMulNum(vecSub(c, prevPoint), remlen / partLen)))
            outCurves.push({
              type: 'line',
              from: prevPoint,
              to: endPoint,
              points: [prevPoint, endPoint],
              len: remlen
            })
            remlen = -99
          }
        }
        prevPoint = c
      }
      let firstLine = outCurves[0]
      let lastLine = outCurves[outCurves.length - 1]
      outEndPoint = lastLine.to
      outFirstTangent = vecSub(firstLine.to, firstLine.from)
      outLastTangent = vecSub(lastLine.to, lastLine.from)
      outFirstTangent = vecMulNum(outFirstTangent, 1 / vecLen(outFirstTangent))
      outLastTangent = vecMulNum(outLastTangent, 1 / vecLen(outLastTangent))

      break
    }
    case 'P': { // circular 3pt
      let c0 = beginPoint
      let d1 = pts[1].split(':')
      let c1 = [+d1[0], +d1[1]]
      let d2 = pts[2].split(':')
      let c2 = [+d2[0], +d2[1]]
      outPoints.push({ c: beginPoint, type: 'start' })
      outPoints.push({ c: c1, type: 'curl' })
      outPoints.push({ c: c2, type: 'end' })
      let center = calculateCircleCenter(c0, c1, c2)

      // fix degenerate circle bug
      if (!isFinite(center[0]) || !isFinite(center[1])) {
        // skip the middle point and change type to linear!
        note.sliderPoints = ['L', note.sliderPoints[2]]
        return analyzeSlider(note)
      }
      let radius = pDist(center, c0)

      // calculate the angles to get to where the slider actually ends
      let reqAngle = remlen / radius
      let dirAngle = Math.atan2.apply(null, vecSub(c1, c0).reverse())
      dirAngle /= -(Math.abs(dirAngle) || 1)

      let startAngle = Math.atan2.apply(null, vecSub(c0, center).reverse())
      let endAngle = startAngle + dirAngle * reqAngle
      let endCoord = vecAdd(center, [Math.cos(endAngle) * radius, Math.sin(endAngle) * radius])

      outEndPoint = vecRound(endCoord)
      outFirstTangent = [Math.cos(startAngle + dirAngle * Math.PI / 2), Math.sin(startAngle + dirAngle * Math.PI / 2)]
      outLastTangent = [Math.cos(endAngle + dirAngle * Math.PI / 2), Math.sin(endAngle + dirAngle * Math.PI / 2)]

      outCurves.push({
        type: 'arc',
        from: beginPoint,
        to: outEndPoint,
        center: center,
        radius: radius,
        len: remlen
      })
      remlen = 0
      break
    }
    case 'B': { // bezier
      outPoints.push({ c: beginPoint, type: 'start' })
      let beziers = []; let bez = [beginPoint]
      for (let i = 1; i < pts.length; i++) {
        let c0 = pts[i].split(':')
        let c = [+c0[0], +c0[1]]
        if (i === pts.length - 1) { // last point
          bez.push(c)
          beziers.push(bez)
          bez = []
          outPoints.push({ c: c, type: 'end' })
          break
        } else {
          // find next point and check if equal
          let nc0 = pts[i + 1].split(':')
          let nc = [+nc0[0], +nc0[1]]
          if (nc[0] === c[0] && nc[1] === c[1]) { // is node (red)
            // open a new bez
            bez.push(c)
            beziers.push(bez)
            bez = [c]
            outPoints.push({ c: c, type: 'node' })

            // skip "nc"
            i++
          } else { // is not node (white)
            bez.push(c)
            outPoints.push({ c: c, type: 'curl' })
          }
        }
        prevPoint = c
      }

      let bezierData = calculateBezierData(beziers, remlen)
      remlen = 0
      outCurves = bezierData.curves
      outFirstTangent = bezierData.firstTangent
      outLastTangent = bezierData.lastTangent
      outEndPoint = outCurves[outCurves.length - 1].to
      break
    }
  }

  let outFinalPoint = null
  if (note.sliderReverses % 2 === 0) {
    outLastTangent = vecMulNum(outFirstTangent, -1)
    outFinalPoint = beginPoint
  } else {
    outFinalPoint = outEndPoint
  }

  // changed name to make it a little smaller

  return {
    type: sliderType,
    points: outPoints,
    curves: outCurves,
    dIn: outFirstTangent,
    dOut: outLastTangent,
    endpoint: outEndPoint,
    to: outFinalPoint,
    endTime: outEndTime
  }
}

/*
 * This needs to be consistent with the definition in (#7).
 * Name is irrelevant, just to give a hint what it is.
 * There are a few more shapes in RND5, but I doubt if that's anywhere useful.
 */
function getAllSliderTypes () {
  return [{
    index: 0,
    name: 'linear',
    type: 'L',
    vecLength: 1,
    repeats: 1,
    angle: 0,
    points: [[1, 0]]
  }, {
    index: 1,
    name: 'arc-ccw',
    type: 'P',
    vecLength: 0.97,
    repeats: 1,
    angle: -0.40703540572409336,
    points: [[0.5, 0.1], [0.97, 0]]
  }, {
    index: 2,
    name: 'arc-cw',
    type: 'P',
    vecLength: 0.97,
    repeats: 1,
    angle: 0.40703540572409336,
    points: [[0.5, -0.1], [0.97, 0]]
  }, {
    index: 3,
    name: 'angle-ccw',
    type: 'B',
    vecLength: 0.97,
    repeats: 1,
    angle: -0.20131710837464062,
    points: [[0.48, 0.1], [0.48, 0.1], [0.97, 0]]
  }, {
    index: 4,
    name: 'angle-cw',
    type: 'B',
    vecLength: 0.97,
    repeats: 1,
    angle: 0.20131710837464062,
    points: [[0.48, -0.1], [0.48, -0.1], [0.97, 0]]
  }, {
    index: 5,
    name: 'wave-cw',
    type: 'B',
    vecLength: 0.97,
    repeats: 1,
    angle: -0.46457807316944644,
    points: [[0.38, -0.2], [0.58, 0.2], [0.97, 0]]
  }, {
    index: 6,
    name: 'wave-ccw',
    type: 'B',
    vecLength: 0.97,
    repeats: 1,
    angle: 0.46457807316944644,
    points: [[0.38, 0.2], [0.58, -0.2], [0.97, 0]]
  }, {
    index: 7,
    name: 'halfcircle-cw',
    type: 'P',
    vecLength: 0.64,
    repeats: 1,
    angle: 1.5542036732051032,
    points: [[0.32, -0.32], [0.64, 0]]
  }, {
    index: 8,
    name: 'halfcircle-ccw',
    type: 'P',
    vecLength: 0.64,
    repeats: 1,
    angle: -1.5542036732051032,
    points: [[0.32, 0.32], [0.64, 0]]
  }, {
    index: 9,
    name: 'haneru-cw',
    type: 'B',
    vecLength: 0.94,
    repeats: 1,
    angle: 0,
    points: [[0.24, -0.08], [0.44, -0.04], [0.64, 0.1], [0.64, 0.1], [0.76, 0], [0.94, 0]]
  }, {
    index: 10,
    name: 'haneru-ccw',
    type: 'B',
    vecLength: 0.94,
    repeats: 1,
    angle: 0,
    points: [[0.24, 0.08], [0.44, 0.04], [0.64, -0.1], [0.64, -0.1], [0.76, 0], [0.94, 0]]
  }, {
    index: 11,
    name: 'elbow-cw',
    type: 'B',
    vecLength: 0.94,
    repeats: 1,
    angle: 0.23783592745745077,
    points: [[0.28, -0.16], [0.28, -0.16], [0.94, 0]]
  }, {
    index: 12,
    name: 'elbow-ccw',
    type: 'B',
    vecLength: 0.94,
    repeats: 1,
    angle: -0.23783592745745077,
    points: [[0.28, 0.16], [0.28, 0.16], [0.94, 0]]
  }, {
    index: 13,
    name: 'ankle-cw',
    type: 'B',
    vecLength: 0.94,
    repeats: 1,
    angle: 0.5191461142465229,
    points: [[0.66, -0.16], [0.66, -0.16], [0.94, 0]]
  }, {
    index: 14,
    name: 'ankle-ccw',
    type: 'B',
    vecLength: 0.94,
    repeats: 1,
    angle: -0.5191461142465229,
    points: [[0.66, 0.16], [0.66, 0.16], [0.94, 0.0]]
  }, {
    index: 15,
    name: 'bolt-cw',
    type: 'B',
    vecLength: 0.96,
    repeats: 1,
    angle: -0.16514867741462683,
    points: [[0.34, -0.06], [0.34, -0.06], [0.6, 0.06], [0.6, 0.06], [0.96, 0.0]]
  }, {
    index: 16,
    name: 'bolt-ccw',
    type: 'B',
    vecLength: 0.96,
    repeats: 1,
    angle: 0.16514867741462683,
    points: [[0.34, 0.06], [0.34, 0.06], [0.6, -0.06], [0.6, -0.06], [0.96, 0.0]]
  }, {
    index: 17,
    name: 'linear-reverse',
    type: 'L',
    vecLength: 0,
    repeats: 2,
    angle: 3.141592653589793,
    points: [[0.0, 0.0], [0.5, 0.0]]
  }]
}

function globalizeMap (map) {
  diffSettings = map.diff
  timingSections = map.timing.ts
  uninheritedSections = map.timing.uts
}

function generateSlider (slider) {
  const sliderTypes = getAllSliderTypes()

  if (!slider.sliderGenerator) {
    return slider
  }

  let g = slider.sliderGenerator
  let st = sliderTypes[g.type]

  g.len /= st.repeats

  let dOutAngle = Math.atan2(g.dOut[1], g.dOut[0])
  let targetAngle = dOutAngle - st.angle
  let points = []
  for (let k = 0; k < st.points.length; k++) {
    let p = vecMulNum(st.points[k], g.len)

    /* cos(x+a) = cosx cosa - sinx sina
         * sin(x+a) = cosx sina + sinx cosa
         */
    let rotP = [p[0] * Math.cos(targetAngle) - p[1] * Math.sin(targetAngle), p[0] * Math.sin(targetAngle) + p[1] * Math.cos(targetAngle)]
    points.push(vecAdd(rotP, [slider.x, slider.y]).map(n => Math.round(n)))
  }
  let _rsp = [st.type].concat(points.map(a => a.join(':')))

  slider.sliderReverses = st.repeats
  slider.sliderLength = g.len
  slider.sliderSingleHitsounds = []
  slider.sliderExtHitsounds = []
  slider.sliderData = analyzeSlider({
    x: slider.x,
    y: slider.y,
    type: slider.type,
    time: slider.time,
    sliderPoints: _rsp,
    sliderLength: Math.round(g.len),
    sliderReverses: st.repeats
  })
  slider.sliderPoints = _rsp

  // delete the generator
  delete slider.sliderGenerator

  return slider
}

function generateSliders (map) {
  let objArray = map.obj
  for (let i = 0; i < objArray.length; i++) {
    let obj = objArray[i]
    if (obj.type & 2) { // is slider
      objArray[i] = generateSlider(obj)
    }
  }
  map.obj = objArray
}

function newComboEvery2Metronome (hsa, uts) {
  const comboEngine = require('./newcombo.js')
  comboEngine.setHitObjectsAndUTS(hsa, uts)
  comboEngine.setComboWL(8)
  comboEngine.getHitObjects(hsa)
  return hsa
}

/*
 * I compressed this code because it was too spaghetti...
 * The param is like
 * 1 - 24clap, 2 - 13clap, 3 - redline clap, 4 - 23clap, 5 - 24whistle, 6 - owoc, 7 - ocow, 8 - remove all
 * 9 - taiko reverse, 10 - metronome finish, 11 - random whistle, 12 - o c occ, 13 - 1clap, 14 - 2clap, 15 - 3 clap, 16 - 4 clap
 * really amazing code I wrote that time (#grassland)
 *
 */
function makeClaps (param, hoa, dts, dte) {
  let dTimeStart = dts || 0
  let dTimeEnd = dte || 19911123
  let w = 0
  let w2 = 0
  for (let i in hoa) {
    if (!(hoa[i].time < dTimeStart || hoa[i].time > dTimeEnd)) {
      if (1 & hoa[i].type) {
        switch (param) {
          case 1: {
            w = isWhiteLine(hoa[i].time)
            w === 2 || w === 4 ? hoa[i].hitsounds |= 8 : hoa[i].hitsounds &= 23
            break
          }
          case 2: {
            w = isWhiteLine(hoa[i].time)
            w === 1 || w === 3 ? hoa[i].hitsounds |= 8 : hoa[i].hitsounds &= 23
            break
          }
          case 3: {
            w = isWhiteLine(hoa[i].time, 3, 0.5)
            w ? hoa[i].hitsounds |= 8 : hoa[i].hitsounds &= 23
            break
          } case 4: {
            w = isWhiteLine(hoa[i].time)
            w === 2 || w === 3 ? hoa[i].hitsounds |= 8 : hoa[i].hitsounds &= 23
            break
          } case 5: {
            w = isWhiteLine(hoa[i].time)
            w === 2 || w === 4 ? hoa[i].hitsounds |= 2 : hoa[i].hitsounds &= 29
            break
          } case 6: {
            w = isWhiteLine(hoa[i].time)
            if (w === 2) {
              hoa[i].hitsounds |= 2
              hoa[i].hitsounds &= 23
            } else if (w === 4) {
              hoa[i].hitsounds |= 8
              hoa[i].hitsounds &= 29
            } else {
              hoa[i].hitsounds &= 21
            }
            break
          } case 7: {
            w = isWhiteLine(hoa[i].time)
            if (w === 4) {
              hoa[i].hitsounds |= 2
              hoa[i].hitsounds &= 23
            } else if (w === 2) {
              hoa[i].hitsounds |= 8
              hoa[i].hitsounds &= 29
            } else {
              hoa[i].hitsounds &= 21
            }
            break
          } case 8: {
            hoa[i].hitsounds = 0
            hoa[i].extHitsounds = '0:0:0'
            break
          } case 9: {
            8 & hoa[i].hitsounds || 2 & hoa[i].hitsounds ? hoa[i].hitsounds &= 21 : hoa[i].hitsounds |= 2
            break
          } case 10: {
            w = isWhiteLine(hoa[i].time)
            w === 1 ? hoa[i].hitsounds |= 4 : hoa[i].hitsounds &= 27
            break
          } case 11: {
            Math.random() > 0.5 ? hoa[i].hitsounds &= 21 : hoa[i].hitsounds |= 2
            break
          } case 12: {
            w = isWhiteLine(hoa[i].time)
            w2 = isWhiteLine(hoa[i].time, 3, 0.5)
            w === 2 || w === 4 || w2 === 3 ? hoa[i].hitsounds |= 8 : hoa[i].hitsounds &= 23
            break
          } case 13: {
            w = isWhiteLine(hoa[i].time)
            w === 1 ? hoa[i].hitsounds |= 8 : hoa[i].hitsounds &= 23
            break
          } case 14: {
            w = isWhiteLine(hoa[i].time)
            w === 2 ? hoa[i].hitsounds |= 8 : hoa[i].hitsounds &= 23
            break
          } case 15: {
            w = isWhiteLine(hoa[i].time)
            w === 3 ? hoa[i].hitsounds |= 8 : hoa[i].hitsounds &= 23
            break
          } case 16: {
            w = isWhiteLine(hoa[i].time)
            w === 4 ? hoa[i].hitsounds |= 8 : hoa[i].hitsounds &= 23
          }
        }
      } else if (2 & hoa[i].type) {
        let ticks = hoa[i].sliderLength / getSliderLen(hoa[i].time)
        let tickLength = getTickLen(hoa[i].time)
        if (!hoa[i].sliderSingleHitsounds || hoa[i].sliderSingleHitsounds.length === 0) {
          hoa[i].sliderSingleHitsounds = []
          for (let j = 0; j <= hoa[i].sliderReverses; j++) {
            hoa[i].sliderSingleHitsounds.push(0)
          }
          if (!hoa[i].sliderExtHitsounds) {
            hoa[i].sliderExtHitsounds = []
            for (let j = 0; j <= hoa[i].sliderReverses; j++) { hoa[i].sliderExtHitsounds.push('0:0') }
            hoa[i].extHitsounds = '0:0:0'
          }
          for (let j = 0; j <= hoa[i].sliderReverses; j++) {
            let cTick = Math.round(hoa[i].time + j * ticks * tickLength)
            switch (param) {
              case 1: {
                w = isWhiteLine(cTick)
                w === 2 || w === 4 ? hoa[i].sliderSingleHitsounds[j] |= 8 : hoa[i].sliderSingleHitsounds[j] &= 23
                break
              } case 2: {
                w = isWhiteLine(cTick)
                w === 1 || w === 3 ? hoa[i].sliderSingleHitsounds[j] |= 8 : hoa[i].sliderSingleHitsounds[j] &= 23
                break
              } case 3: {
                w = isWhiteLine(cTick, 3, 0.5)
                w ? hoa[i].sliderSingleHitsounds[j] |= 8 : hoa[i].sliderSingleHitsounds[j] &= 23
                break
              } case 4: {
                w = isWhiteLine(cTick)
                w === 2 || w === 3 ? hoa[i].sliderSingleHitsounds[j] |= 8 : hoa[i].sliderSingleHitsounds[j] &= 23
                break
              } case 5: {
                w = isWhiteLine(cTick)
                w === 2 || w === 4 ? hoa[i].sliderSingleHitsounds[j] |= 2 : hoa[i].sliderSingleHitsounds[j] &= 29
                break
              } case 6: {
                w = isWhiteLine(cTick)
                if (w === 2) {
                  hoa[i].sliderSingleHitsounds[j] |= 2
                  hoa[i].sliderSingleHitsounds[j] &= 23
                } else if (w === 4) {
                  hoa[i].sliderSingleHitsounds[j] |= 8
                  hoa[i].sliderSingleHitsounds[j] &= 29
                } else {
                  hoa[i].sliderSingleHitsounds[j] &= 21
                }
                break
              } case 7: {
                w = isWhiteLine(cTick)
                if (w === 4) {
                  hoa[i].sliderSingleHitsounds[j] |= 2
                  hoa[i].sliderSingleHitsounds[j] &= 23
                } else if (w === 2) {
                  hoa[i].sliderSingleHitsounds[j] |= 8
                  hoa[i].sliderSingleHitsounds[j] &= 29
                } else {
                  hoa[i].sliderSingleHitsounds[j] &= 21
                }
                break
              } case 8: {
                hoa[i].sliderSingleHitsounds[j] = 0
                hoa[i].sliderExtHitsounds[j] = '0:0'
                break
              } case 10: {
                w = isWhiteLine(cTick)
                w === 1 ? hoa[i].sliderSingleHitsounds[j] |= 4 : hoa[i].sliderSingleHitsounds[j] &= 27
                break
              } case 11: {
                Math.random() > 0.5 ? hoa[i].sliderSingleHitsounds[j] &= 21 : hoa[i].sliderSingleHitsounds[j] |= 2
                break
              } case 12: {
                w = isWhiteLine(cTick)
                w2 = isWhiteLine(cTick, 3, 0.5)
                w === 2 || w === 4 || w2 === 3 ? hoa[i].sliderSingleHitsounds[j] |= 8 : hoa[i].sliderSingleHitsounds[j] &= 23
                break
              } case 13: {
                w = isWhiteLine(cTick)
                w === 1 ? hoa[i].sliderSingleHitsounds[j] |= 8 : hoa[i].sliderSingleHitsounds[j] &= 23
                break
              } case 14: {
                w = isWhiteLine(cTick)
                w === 2 ? hoa[i].sliderSingleHitsounds[j] |= 8 : hoa[i].sliderSingleHitsounds[j] &= 23
                break
              } case 15: {
                w = isWhiteLine(cTick)
                w === 3 ? hoa[i].sliderSingleHitsounds[j] |= 8 : hoa[i].sliderSingleHitsounds[j] &= 23
                break
              } case 16: {
                w = isWhiteLine(cTick)
                w === 4 ? hoa[i].sliderSingleHitsounds[j] |= 8 : hoa[i].sliderSingleHitsounds[j] &= 23
              }
            }
          }
        }
        return hoa
      }
    }
  }
}

function main () {
  let args = process.argv
  if (args.length <= 4) {
    output('please specify mode, inputfile path and outputfile path')
    return
  }
  let date0 = new Date()
  let mode = args[2].charAt(0); let mode2 = args[2].charAt(1)
  let inputfile = args[3]
  let outputfile = args[4]

  if (mode === 'j') {
    try {
      let txt = fs.readFileSync(inputfile, 'utf8')
      let json = loadMap(txt)

      // this will overwrite it if it existed!!
      fs.writeFileSync(outputfile, JSON.stringify(json), { encoding: 'utf8' })
      if (mode2 !== 'q') {
        output('success! file converted to json.')
      }
    } catch (e) {
      output(e)
    }
  } else if (mode === 'o') {
    try {
      let txt = fs.readFileSync(inputfile, 'utf8')
      let json = JSON.parse(txt)

      // this will overwrite it if it existed!!
      fs.writeFileSync(outputfile, buildOsuFile(json), { encoding: 'utf8' })
      if (mode2 !== 'q') {
        output('success! file converted to osu map.')
      }
    } catch (e) {
      output(e)
    }
  } else if (mode === 'c') {
    try {
      let txt = fs.readFileSync(inputfile, 'utf8')
      let json = JSON.parse(txt)

      globalizeMap(json)

      let mode = json.general.Mode || 0
      if (mode < 3) {
        generateSliders(json)

        // json.obj = streamRegularizer(json.obj);

        json.obj = newComboEvery2Metronome(json.obj, json.timing.uts)
      }

      /*
                   * Hitsounds can be deep-learned as well, probably, but one main problem is
                   * that most of the maps use a custom hitsound set.
                   * In this way, the hitsound is largely correlated to the hitsound itself, rather from our data.
                   * With a much bigger dataset (#OsuHitsoundCollection!) this should be possible, but it is pointless -
                   *
                   * - because we can do this the easy way!
                   */
      if (json.obj.every(item => item.hitsounds === 0)) { // Skip hitsounding if it is already hitsounded
        json.obj = makeClaps(11, json.obj)
        json.obj = makeClaps(1, json.obj)
      }

      // this will overwrite it if it existed!!
      fs.writeFileSync(outputfile, buildOsuFile(json), { encoding: 'utf8' })
      if (mode2 !== 'q') {
        output('success! built osu map from json data.')
      }
    } catch (e) {
      output(e)
    }
  } else if (mode === 't') {
    try {
      // let txt = fs.readFileSync(inputfile, 'utf8')
      // let json = loadMap(txt)

      output('script end!')
    } catch (e) {
      output(e)
    }
  } else {
    output('mitakoto nai mo-do desu ne')
  }

  let date1 = new Date()
  if (mode2 !== 'q') {
    output('elapsed time: ' + (date1 - date0) / 1000 + ' s')
  }
}

main()
