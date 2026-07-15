import readline from "node:readline"
import { color } from "@astrojs/cli-kit"
import {
  random,
  randomBetween,
  sleep,
  useAscii as isAscii,
} from "@astrojs/cli-kit/utils"
import { createLogUpdate } from "log-update"

type Message = string | string[] | Promise<string>

interface SayOptions {
  clear?: boolean
  hat?: string
  tie?: string
  stdin?: NodeJS.ReadStream
  stdout?: NodeJS.WriteStream
}

const NAME = "Voss"
const NAME_COLOR = color.hex("#7C5CFF").bold

export async function voss(
  msg: Message | Message[] = [],
  {
    clear = false,
    hat = "",
    tie = "",
    stdin = process.stdin,
    stdout = process.stdout,
  }: SayOptions = {}
) {
  const messages = Array.isArray(msg) ? (msg as Message[]) : [msg]
  const rl = readline.createInterface({
    input: stdin,
    escapeCodeTimeout: 50,
  } as never)
  const logUpdate = createLogUpdate(stdout, { showCursor: false })
  readline.emitKeypressEvents(stdin, rl)

  let cancelled = false
  const done = () => {
    stdin.off("keypress", onKey)
    if (stdin.isTTY) stdin.setRawMode(false)
    rl.close()
    cancelled = true
    if (clear) logUpdate.clear()
    else logUpdate.done()
  }
  const onKey = () => done()
  if (stdin.isTTY) stdin.setRawMode(true)
  stdin.on("keypress", onKey)

  const ascii = isAscii()
  const eyes = ascii ? ["o", "O", "•", "^"] : ["◉", "◉", "●", "○", "◉"]
  const mouths = ascii
    ? ["o", "O", "•", "-", "u"]
    : ["◡", "○", "▫", "▪", "■", "◡"]
  const restingEye = ascii ? "o" : "◉"
  const restingMouth = ascii ? "u" : "◡"
  const walls = ascii ? ["—", "|"] : ["─", "│"]
  const corners = ascii ? ["+", "+", "+", "+"] : ["╭", "╮", "╰", "╯"]

  const face = (text: string, eye: string, mouth: string) => {
    const [h, v] = walls
    const [tl, tr, bl, br] = corners
    return [
      `${tl}${h.repeat(2)}${hat}${h.repeat(3 - hat.length)}${tr}  ${NAME_COLOR(`${NAME}:`)}`,
      `${v} ${eye} ${color.cyanBright(mouth)} ${eye}  ${text}`,
      `${bl}${h.repeat(2)}${tie}${h.repeat(3 - tie.length)}${br}`,
    ].join("\n")
  }

  for (let message of messages) {
    message = await message
    const words = Array.isArray(message)
      ? message
      : (message as string).split(" ")
    const buf: string[] = []
    let eye = random(eyes)
    let j = 0
    for (const word of [""].concat(words as string[])) {
      if (cancelled) break
      if (word) buf.push(word)
      const mouth = random(mouths)
      if (j % 7 === 0) eye = random(eyes)
      logUpdate("\n" + face(buf.join(" "), eye, mouth))
      await sleep(randomBetween(60, 140))
      j++
    }
    if (!cancelled) {
      const full = (
        Array.isArray(message) ? message.join(" ") : (message as string)
      ).toString()
      logUpdate("\n" + face(full, restingEye, restingMouth))
      await sleep(randomBetween(900, 1100))
    }
  }

  stdin.off("keypress", onKey)
  await sleep(80)
  done()
  if (stdin.isTTY) stdin.setRawMode(false)
  stdin.removeAllListeners("keypress")
}

export function banner() {
  const prefix = color.bgHex("#7C5CFF").black(" verp ")
  const suffix = color.dim("Launch sequence initiated.")
  process.stdout.write(`\n ${prefix}  ${suffix}\n`)
}

export function bannerAbort() {
  process.stdout.write(
    `\n ${color.bgRed.white(" verp ")}  ${color.dim("Setup cancelled.")}\n`
  )
}
