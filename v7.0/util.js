let child = require('child_process')
let fs = require('fs')
let path = require('path')

module.exports = {
  py: (file, args = []) => {
    let app = child.spawn('python', ['-u', file + '.py', ...args])
    app.stdout.on('data', d => process.stdout.write(d.toString()))
    app.stderr.on('data', d => process.stdout.write(d.toString()))
    return new Promise(resolve => { app.on('close', () => resolve()) })
  },
  error: msg => {
    console.error('Error: ' + msg)
  },
  parse: file => {
    let res = {}
    let key = null
    let sections = ['events', 'timingpoints', 'hitobjects']
    let lines = fs.readFileSync(file, { encoding: 'utf-8' }).replace(/\/\/.*/g, '').split(/\r?\n/).filter(x => x)
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i]
      if (line.match(/\[.+\]/)) {
        key = line.trim().slice(1, -1).toLowerCase()
        res[key] = sections.includes(key) ? [] : {}
      } else if (key) {
        if (sections.includes(key)) {
          res[key].push(line)
        } else {
          let index = line.indexOf(':')
          res[key][line.substring(0, index).trim().toLowerCase()] = line.substr(index + 1).trim()
        }
      }
    }
    return res
  },
  exists: file => {
    return fs.existsSync(file)
  },
  grab: (dir, fn) => {
    let file = fs.readdirSync(dir).find(fn)
    return file ? path.join(dir, file) : null
  },
  remove: file => {
    if (!fs.existsSync(file)) return
    if (fs.statSync(file).isDirectory()) {
      fs.rmdirSync(file, { recursive: true })
    } else fs.unlinkSync(file)
  },
  join: (...args) => {
    return path.join(...args)
  },
  open: file => {
    return fs.readFileSync(file, { encoding: 'utf-8' })
  }
}
