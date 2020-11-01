/* global isWhiteLine2, getSliderLen */
'use strict'
/*
     * Modularized newcombo.js
     */
; (function (module) {
  let curCombo = 0 // i'll go with combo[n] = n+1 in .osu file. it's kinda weird here..
  let totalCombos = 0
  let globSpinBuff = 0
  let globalComboToInit = 0

  let hitObjectArray = []
  let uninheritedSections = null
  let colorsData = ''

  function setHitObjectsAndUTS (hoa, uts) {
    hitObjectArray = hoa
    uninheritedSections = uts
  }

  function getHitObjects (hoa) {
    return hitObjectArray
  }

  function output (p) {
    /* Disable output */
    // console.log(p);
  }
  function modAdd (a, b, m) {
    return (a % m + b % m + 2 * m) % m
  }

  function modSub (a, b, m) {
    return (a % m - b % m + 2 * m) % m
  }

  function comInc (a, b) {
    let a1 = (a & 4) ? ((a + 12) >> 4) : 0
    let c1 = modAdd(a1, b, totalCombos)
    return (c1 === 0) ? (totalCombos << 4) - 12 : (c1 << 4) - 12
  }

  function comAdd (a, b) {
    let a1 = (a & 4) ? ((a + 12) >> 4) : 0
    let b1 = (b & 4) ? ((b + 12) >> 4) : 0
    let c1 = modAdd(a1, b1, totalCombos)
    return (c1 === 0) ? (totalCombos << 4) - 12 : (c1 << 4) - 12
  }

  function getCombo (t) {
    if (hitObjectArray.length === 0) { output('No object!'); return 0 }
    totalCombos = colorsData.split(/\r?\n/).length
    let c0 = hitObjectArray[0].type & 244
    let curCombo
    if (c0 === 0) {
      curCombo = 1
    } else if (c0 & 4) {
      curCombo = (1 + ((c0 - 4) >> 4)) % totalCombos
    }
    let spinBuff = 0
    for (let i = 1; i < hitObjectArray.length; i++) {
      let ci = hitObjectArray[i].type & 244
      if (hitObjectArray[i].type & 8) {
        spinBuff = 1
        continue
      } else if (ci & 4) {
        curCombo = modAdd(curCombo, (ci + 12) >> 4, totalCombos)
        spinBuff = 0
      } else if (spinBuff) {
        curCombo = modAdd(curCombo, 1, totalCombos)
        spinBuff = 0
      }
      if (Math.abs(hitObjectArray[i].time - t) <= 3) {
        return curCombo
      }
    }
    return -1
  }

  function setCombo (t, c) {
    if (hitObjectArray.length === 0) { output('No object!'); return 0 }
    totalCombos = colorsData.split(/\r?\n/).length
    let resetFlag = 0
    let c0 = hitObjectArray[0].type & 244
    let curCombo
    if (c0 === 0) {
      curCombo = 1
    } else if (c0 & 4) {
      curCombo = (1 + ((c0 - 4) >> 4)) % totalCombos
    }
    let spinBuff = 0
    for (let i = 1; i < hitObjectArray.length; i++) {
      let ci = hitObjectArray[i].type & 244
      if (hitObjectArray[i].type & 8) {
        spinBuff = 1
        continue
      }
      if (Math.abs(hitObjectArray[i].time - t) <= 3) {
        if (c === curCombo) {
          hitObjectArray[i].type = hitObjectArray[i].type & 11
          return 2
        } else {
          resetFlag = comInc(ci, modSub(curCombo, c, totalCombos))
          hitObjectArray[i].type = (modSub(c, curCombo, totalCombos) << 4) - 12 + (hitObjectArray[i].type & 11)
        }
      } else if (ci & 4) {
        curCombo = modAdd(curCombo, (ci + 12) >> 4, totalCombos)
        spinBuff = 0
        if (resetFlag) {
          hitObjectArray[i].type = comAdd(ci, resetFlag) + (hitObjectArray[i].type & 11)
          return 1
        }
      } else if (spinBuff) {
        curCombo = modAdd(curCombo, 1, totalCombos)
        spinBuff = 0
        if (resetFlag) {
          hitObjectArray[i].type = comAdd(ci, resetFlag) + (hitObjectArray[i].type & 11)
          return 1
        }
      }
    }
    return 0
  }

  function initGlobalCombo () {
    globalComboToInit = 0
    totalCombos = colorsData.split(/\r?\n/).length
    let c0 = hitObjectArray[0].type & 244
    if (c0 === 0) {
      curCombo = 1
    } else if (c0 & 4) {
      curCombo = (1 + ((c0 - 4) >> 4)) % totalCombos
    }
    globSpinBuff = 0
    return 1
  }

  function calcGlobalCombo (t) {
    if (globalComboToInit) {
      initGlobalCombo()
      return
    }
    if (t & 8) {
      globSpinBuff = 1
    } else {
      let c = t & 244
      if (c & 4) {
        curCombo = modAdd(curCombo, (c + 12) >> 4, totalCombos)
        globSpinBuff = 0
      } else if (globSpinBuff) {
        curCombo = modAdd(curCombo, 1, totalCombos)
        globSpinBuff = 0
      }
    }
  }

  function setComboHere (obj, c) {
    if (globalComboToInit) {
      setComboHereForce(obj, c)
      return
    }
    if (c !== curCombo) {
      obj.type = ((modSub(c, curCombo, totalCombos) << 4) - 12) | (obj.type & 11)
    } else {
      obj.type = obj.type & 11
    }
  }

  function addNewComboHere (obj) {
    obj.type = 4 | (obj.type & 11)
  }

  function removeNewComboHere (obj) {
    obj.type = obj.type & 11
  }

  function setComboHereForce (obj, c) {
    if (globalComboToInit) {
      curCombo = 0
    }
    if (c !== curCombo) {
      obj.type = ((modSub(c, curCombo, totalCombos) << 4) - 12) | (obj.type & 11)
    } else {
      obj.type = ((totalCombos << 4) - 12) | (obj.type & 11)
    }
  }

  function delayComboInit () {
    totalCombos = colorsData.split(/\r?\n/).length
    globalComboToInit = 1
    curCombo = 0
  }

  function setComboDivisor (dTimeStart, dTimeEnd) {
    if (hitObjectArray.length === 0) { output('No object!'); return 0 }
    colorsData = 'Combo1 : 234,234,231\r\nCombo2 : 249,21,20\r\nCombo3 : 70,138,249\r\nCombo4 : 251,247,20\r\nCombo5 : 227,22,225\r\nCombo6 : 128,128,128'
    dTimeStart = dTimeStart || 0
    dTimeEnd = dTimeEnd || 19911123
    delayComboInit()
    for (let i = 0; i < hitObjectArray.length; i++) {
      let obj = hitObjectArray[i]
      if (obj.time >= dTimeStart && obj.time <= dTimeEnd) {
        if (isWhiteLine2(obj.time, 1) !== false) {
          setComboHere(obj, 0)
        } else if (isWhiteLine2(obj.time, 2)) {
          setComboHere(obj, 1)
        } else if (isWhiteLine2(obj.time, 4)) {
          setComboHere(obj, 2)
        } else if (isWhiteLine2(obj.time, 8)) {
          setComboHere(obj, 3)
        } else if (isWhiteLine2(obj.time, 6)) {
          setComboHere(obj, 4)
        } else {
          setComboHere(obj, 5)
        }
      }
      calcGlobalCombo(hitObjectArray[i].type)
    }
    output('New Combo by Divisor complete!')
  }

  function setComboDMT (dTimeStart, dTimeEnd) {
    if (hitObjectArray.length === 0) { output('No object!'); return 0 }
    colorsData = 'Combo1 : 70,55,255\r\nCombo2 : 242,0,0\r\nCombo3 : 255,243,104\r\nCombo4 : 238,89,255'
    dTimeStart = dTimeStart || 0
    dTimeEnd = dTimeEnd || 19911123
    delayComboInit()
    let stackedQueue = []
    let stackMaxTime = 1000
    for (let i = 0; i < hitObjectArray.length; i++) {
      let obj = hitObjectArray[i]
      if (obj.time >= dTimeStart && obj.time <= dTimeEnd) {
        if (obj.type & 2) {
          let ticks = obj.sliderLength / getSliderLen(obj.time)
          if (ticks < 0.30) {
            setComboHere(obj, 0)
          } else {
            setComboHere(obj, 2)
          }
        } else if (obj.type & 1) {
          let isStack = 0
          for (let j = 0; j < stackedQueue.length; j++) {
            if (i === stackedQueue[j]) {
              isStack = 1
              stackedQueue.splice(j, 1)
              break
            }
          }
          if (!isStack) {
            let stackTimer = obj.time + stackMaxTime
            let x0 = obj.x
            let y0 = obj.y
            for (let j = i + 1; j < hitObjectArray.length; j++) {
              if (hitObjectArray[j].time > stackTimer) {
                break
              }
              if (hitObjectArray[j].x === x0 && hitObjectArray[j].y === y0) {
                stackTimer = hitObjectArray[j].time + stackMaxTime
                isStack = 1
                if (hitObjectArray[j].type & 1) {
                  stackedQueue.push(j)
                }
              }
            }
          }
          if (isStack) {
            setComboHere(obj, 3)
          } else {
            setComboHere(obj, 1)
          }
        }
      }
      calcGlobalCombo(hitObjectArray[i].type)
    }
    output('New Combo DMT complete!')
  }

  function afterWhiteLine (t, divisor, err, ext) {
    err = err || 3
    ext = ext || 0
    let m = 0
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
        return 1 + Math.floor((t + err - us[i].beginTime) / tkl) + m
      }
      if (us[i + 1]) {
        m += Math.ceil((us[i + 1].beginTime - us[i].beginTime) / us[i].tickLength)
      }
    }
  }

  function setComboWL (n, dTimeStart, dTimeEnd) {
    n = n || 4
    if (hitObjectArray.length === 0) { output('No object!'); return 0 }
    dTimeStart = dTimeStart || 0
    dTimeEnd = dTimeEnd || 19911123
    delayComboInit()
    let curWL = 1
    for (let i = 0; i < hitObjectArray.length; i++) {
      let obj = hitObjectArray[i]
      if (obj.time >= dTimeStart && obj.time <= dTimeEnd) {
        if (curWL === 1 && dTimeStart >= 1500) {
          curWL = afterWhiteLine(dTimeStart, 1)
        }
        if (afterWhiteLine(obj.time, 1) >= curWL) {
          addNewComboHere(obj)
          while (curWL <= afterWhiteLine(obj.time, 1)) {
            curWL += n
          }
        } else {
          removeNewComboHere(obj)
        }
      }
      calcGlobalCombo(hitObjectArray[i].type)
    }
    output('New Combo every ' + n + ' white lines complete!')
  }

  function setComboBlackTech (dTimeStart, dTimeEnd) {
    if (hitObjectArray.length === 0) { output('No object!'); return 0 }
    dTimeStart = dTimeStart || 0
    dTimeEnd = dTimeEnd || 19911123
    delayComboInit()
    for (let i = 0; i < hitObjectArray.length; i++) {
      let obj = hitObjectArray[i]
      if (obj.time >= dTimeStart && obj.time <= dTimeEnd) {
        if ((obj.type & 12) === 0) {
          obj.type = (obj.type & 11) | ((totalCombos << 4) - 12)
        }
      }
      calcGlobalCombo(hitObjectArray[i].type)
    }
    output('New Combo BlackTech complete!')
  }

  function setComboHitsounds (dTimeStart, dTimeEnd) {
    if (hitObjectArray.length === 0) { output('No object!'); return 0 }
    colorsData = 'Combo1 : 255,98,98\r\nCombo2 : 187,0,0\r\nCombo3 : 121,128,255\r\nCombo4 : 0,10,187\r\nCombo5 : 141,255,98\r\nCombo6 : 50,198,0\r\nCombo7 : 121,228,255\r\nCombo8 : 0,140,187'
    dTimeStart = dTimeStart || 0
    dTimeEnd = dTimeEnd || 19911123
    delayComboInit()
    for (let i = 0; i < hitObjectArray.length; i++) {
      let obj = hitObjectArray[i]
      if (obj.time >= dTimeStart && obj.time <= dTimeEnd) {
        let hs = obj.hitsounds
        if ((obj.type & 2) && obj.sliderSingleHitsounds && obj.sliderSingleHitsounds.length) {
          hs = parseInt(obj.sliderSingleHitsounds[0]) // it isn't supposed to o.o..
        }
        switch (hs) {
          case 2:
            setComboHere(obj, 2)
            break
          case 4:
            setComboHere(obj, 1)
            break
          case 6:
            setComboHere(obj, 3)
            break
          case 8:
            setComboHere(obj, 4)
            break
          case 10:
            setComboHere(obj, 6)
            break
          case 12:
            setComboHere(obj, 5)
            break
          case 14:
            setComboHere(obj, 7)
            break
          default:
            setComboHere(obj, 0)
            break
        }
      }
      calcGlobalCombo(hitObjectArray[i].type)
    }
    output('New Combo for Hitsounds complete!')
  }

  function setComboArea (dTimeStart, dTimeEnd) {
    if (hitObjectArray.length === 0) { output('No object!'); return 0 }
    colorsData = 'Combo1 : 255,0,0\r\nCombo2 : 255,0,255\r\nCombo3 : 0,0,255\r\nCombo4 : 0,255,255\r\nCombo5 : 0,255,0\r\nCombo6 : 255,255,0'
    dTimeStart = dTimeStart || 0
    dTimeEnd = dTimeEnd || 19911123
    delayComboInit()
    for (let i = 0; i < hitObjectArray.length; i++) {
      let obj = hitObjectArray[i]
      if (obj.time >= dTimeStart && obj.time <= dTimeEnd) {
        let wy = obj.y
        let wx = obj.x
        if (obj.type & 2) {
          wx = Math.round((wx + parseInt(obj.sliderPoints[obj.sliderPoints.length - 1].split(':')[0])) / 2)
          wy = Math.round((wy + parseInt(obj.sliderPoints[obj.sliderPoints.length - 1].split(':')[1])) / 2)
        }
        if (wy <= 192) {
          if (wx < 171) {
            setComboHere(obj, 0)
          } else if (wx < 342) {
            setComboHere(obj, 1)
          } else {
            setComboHere(obj, 2)
          }
        } else {
          if (wx < 171) {
            setComboHere(obj, 3)
          } else if (wx < 342) {
            setComboHere(obj, 4)
          } else {
            setComboHere(obj, 5)
          }
        }
      }
      calcGlobalCombo(hitObjectArray[i].type)
    }
    output('New Combo for Area complete!')
  }

  function setComboCycle (cycleArray, dTimeStart, dTimeEnd) {
    if (hitObjectArray.length === 0) { output('No object!'); return 0 }
    let arr = cycleArray
    dTimeStart = dTimeStart || 0
    dTimeEnd = dTimeEnd || 19911123
    let pt = 0
    let doEndBack = 1
    let locSpinBuff = 0
    let origColorLast = 0
    for (let i = 0; i < hitObjectArray.length; i++) {
      if (hitObjectArray[i].time > dTimeEnd) {
        origColorLast = getCombo(hitObjectArray[i].time)
        break
      }
    }
    delayComboInit()
    for (let i = 0; i < hitObjectArray.length; i++) {
      let obj = hitObjectArray[i]
      if (obj.time >= dTimeStart && obj.time <= dTimeEnd) {
        if (obj.type & 8) {
          locSpinBuff = 1
        } else if ((obj.type & 4) || locSpinBuff) {
          setComboHere(obj, arr[pt])
          locSpinBuff = 0
          pt = (1 + pt) % arr.length
        }
      } else if (obj.time > dTimeEnd && doEndBack) {
        setComboHere(obj, origColorLast)
        doEndBack = 0
      }
      calcGlobalCombo(hitObjectArray[i].type)
    }
    output('New Combo Cycle complete!')
  }

  function getColorData () {
    return colorsData
  }

  module.exports = {
    setHitObjectsAndUTS: setHitObjectsAndUTS,
    getHitObjects: getHitObjects,
    getColorData: getColorData,
    getCombo: getCombo,
    setCombo: setCombo,
    calcGlobalCombo: calcGlobalCombo,
    setComboDivisor: setComboDivisor,
    setComboDMT: setComboDMT,
    setComboWL: setComboWL,
    setComboBlackTech: setComboBlackTech,
    setComboHitsounds: setComboHitsounds,
    setComboArea: setComboArea,
    setComboCycle: setComboCycle
  }
})(module)
