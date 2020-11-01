let util = require('./util')
let Zip = require('adm-zip')

async function main () {
  switch (process.argv[2]) {
    case 'train': {
      await util.py('training')
      break
    }
    case 'generate': {
      let zip = null
      let osu = {}
      let file = process.argv[3]
      if (!file) return util.error('No file specified.')
      else if (file.endsWith('.osz')) {
        zip = new Zip(file)
        let entries = zip.getEntries()
        file = entries.find(entry => entry.entryName.endsWith('.osu')).entryName
        zip.extractEntryTo(file, 'temp')
        for (let i = entries.length - 1; i >= 0; i--) {
          let entry = entries[i]
          if (entry.entryName.endsWith('.osu')) zip.deleteFile(entry)
        }
        file = util.join(__dirname, 'temp', file)
        osu = util.parse(file)
        try { zip.extractEntryTo(osu.general.audiofilename, 'temp') } catch (e) {
          return util.error(`Missing audio file "${osu.general.audiofilename}".`)
        }
      } else if (!file.endsWith('.mp3')) return util.error('Unsupported file type.')

      await util.py('generate', [file])

      if (!zip) {
        zip = new Zip()
        zip.addLocalFile(file, null, 'audio.mp3')
      }

      let map = util.grab('./', x => x.endsWith('.osu'))
      zip.addLocalFile(map)

      let dest = '../'
      if (util.exists('../path.txt')) {
        let txt = util.open('../path.txt').trim()
        if (txt && util.exists(txt)) dest = txt
        else util.error('Invalid path in path.txt!')
      }
      await new Promise(resolve => {
        zip.writeZip(util.join(dest, map.slice(7, -3) + 'osz'), () => resolve())
      })

      break
    }
  }
}

main()

function cleanup () {
  let file = null
  do {
    file = util.grab('./', x => x.endsWith('.osu'))
    if (file) util.remove(file)
  } while (file)
  util.remove('temp')
  util.remove('mapthis.json')
  util.remove('mapthis.npz')
  util.remove('temp_json_file.json')
}

process.on('exit', cleanup)
process.on('SIGINT', cleanup)
process.on('SIGUSR1', cleanup)
process.on('SIGUSR2', cleanup)
process.on('uncaughtException', cleanup)
