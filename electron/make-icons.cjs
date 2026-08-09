const fs = require('fs')
const path = require('path')

async function main() {
  const { Jimp } = await import('jimp')
  const pngToIco = (await import('png-to-ico')).default

  const src = path.join(__dirname, '..', 'frontend', 'src', 'assets', 'logonobg.png')
  const outDir = path.join(__dirname, 'build')
  fs.mkdirSync(outDir, { recursive: true })

  const img = await Jimp.read(src)
  const size = Math.max(img.width, img.height, 256)
  const square = new Jimp({ width: size, height: size, color: 0x00000000 })
  const x = Math.floor((size - img.width) / 2)
  const y = Math.floor((size - img.height) / 2)
  square.composite(img, x, y)
  square.resize({ w: 256, h: 256 })

  const pngPath = path.join(outDir, 'icon.png')
  await square.write(pngPath)
  const ico = await pngToIco(pngPath)
  fs.writeFileSync(path.join(outDir, 'icon.ico'), ico)
  console.log('Icons written to electron/build')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
