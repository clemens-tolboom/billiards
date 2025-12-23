import { ControllerBase } from "./controllerbase"
import { Controller, Input } from "./controller"
import { Aim } from "./aim"
import { BreakEvent } from "../events/breakevent"
import { R } from "../model/physics/constants"
import { Plane, Raycaster, Vector2, Vector3 } from "three"
import { CueMesh } from "../view/cuemesh"

/**
 * Place cue ball using input events.
 *
 * Needs to be configurable to break place ball and post foul place ball anywhere legal.
 */
export class PlaceBall extends ControllerBase {
  readonly placescale = 0.02 * R
  private selectedIndex = 0
  private placedFlags: boolean[] = []
  private pointerPlane = new Plane(new Vector3(0, 0, 1), 0)
  private raycaster = new Raycaster()
  private practiceMode: boolean

  constructor(container, practiceMode = false) {
    super(container)
    this.practiceMode = practiceMode
    this.container.table.cue.moveTo(this.container.table.cueball.pos)
    this.container.table.cue.aim.power = 0
    this.container.view.camera.forceMode(this.container.view.camera.aimView)
  }

  override onFirst() {
    this.placedFlags = this.container.table.balls.map(() => false)
    const ball = this.currentBall()
    if (ball === this.container.table.cueball && this.container.rules.allowsPlaceBall()) {
      ball.pos.copy(this.container.rules.placeBall())
    }
    ball.setStationary()
    ball.updateMesh(0)
    this.container.table.cue.placeBallMode()
    this.container.table.cue.showHelper(false)
    this.container.table.cue.moveTo(ball.pos)
    this.updateButtonLabel()
    this.addPointerHandlers()
    if (!this.practiceMode && !this.container.rules.allowsPlaceBall()) {
      this.container.inputQueue.push(new Input(1, "SpaceUp"))
    }
  }

  override handleInput(input: Input): Controller {
    const ball = this.currentBall()
    const ballPos = ball.pos
    switch (input.key) {
      case "Tab":
        this.selectNextBall()
        break
      case "ShiftTab":
        this.selectPreviousBall()
        break
      case "ArrowLeft":
        this.moveTo(0, input.t * this.placescale)
        break
      case "ArrowRight":
        this.moveTo(0, -input.t * this.placescale)
        break
      // use cursor movement for placing cueball
      case "movementXUp":
        this.moveTo(input.t * this.placescale * 2, 0)
        break
      case "movementYUp":
        this.moveTo(0, -input.t * this.placescale * 2)
        break
      // use IJKL for placing cueball
      case "KeyI":
        this.moveTo(0, input.t * this.placescale)
        break
      case "KeyK":
        this.moveTo(0, -input.t * this.placescale)
        break
      case "KeyJ":
        this.moveTo(-input.t * this.placescale, 0)
        break
      case "KeyL":
        this.moveTo(input.t * this.placescale, 0)
        break
      case "SpaceUp":
        return this.confirmPlacement()
      default:
        this.commonKeyHandler(input)
    }

    this.container.table.cue.moveTo(ballPos)
    this.container.view.camera.forceMove(this.container.table.cue.aim)
    this.container.sendEvent(this.container.table.cue.aim)

    return this
  }

  private addPointerHandlers() {
    const canvas: HTMLCanvasElement | undefined = this.container.view.element
    if (!canvas) {
      return
    }
    canvas.addEventListener("pointerdown", (e) => {
      const pos = this.intersectTable(e, canvas)
      if (!pos) {
        return
      }
      // find nearest ball to pointer projection
      let bestIndex = 0
      let bestDist = Number.POSITIVE_INFINITY
      this.container.table.balls.forEach((b, i) => {
        const d = b.pos.distanceTo(pos)
        if (d < bestDist) {
          bestDist = d
          bestIndex = i
        }
      })
      this.selectedIndex = bestIndex
      this.updateButtonLabel()
    })
  }

  private intersectTable(e: PointerEvent, canvas: HTMLCanvasElement): Vector3 | null {
    const rect = canvas.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(new Vector2(x, y), this.container.view.camera.camera)
    const hit = new Vector3()
    const intersection = this.raycaster.ray.intersectPlane(this.pointerPlane, hit)
    return intersection ?? null
  }

  moveTo(dx, dy) {
    const delta = new Vector3(dx, dy)
    const ball = this.currentBall()
    const ballPos = ball.pos.add(delta)
    if (
      ball === this.container.table.cueball &&
      (this.practiceMode || this.container.rules.allowsPlaceBall())
    ) {
      ballPos.copy(this.container.rules.placeBall(ballPos))
    }
    CueMesh.indicateValid(!this.container.table.overlapsAny(ballPos, ball))
  }

  confirmPlacement() {
    const ball = this.currentBall()
    if (this.container.table.overlapsAny(ball.pos, ball)) {
      return this
    }
    this.placedFlags[this.selectedIndex] = true
    if (!this.allPlaced()) {
      this.selectNextUnplaced()
      this.updateButtonLabel()
      return this
    }
    this.container.table.cue.aimInputs.setButtonText("Hit")
    this.container.sound.playNotify()
    this.container.sendEvent(new BreakEvent(this.container.table.shortSerialise()))
    return new Aim(this.container)
  }

  private currentBall() {
    return this.container.table.balls[this.selectedIndex] ?? this.container.table.cueball
  }

  private selectNextBall() {
    this.selectedIndex = (this.selectedIndex + 1) % this.container.table.balls.length
    this.updateButtonLabel()
  }

  private selectPreviousBall() {
    this.selectedIndex =
      (this.selectedIndex - 1 + this.container.table.balls.length) %
      this.container.table.balls.length
    this.updateButtonLabel()
  }

  private selectNextUnplaced() {
    const len = this.container.table.balls.length
    for (let i = 1; i <= len; i++) {
      const idx = (this.selectedIndex + i) % len
      if (!this.placedFlags[idx]) {
        this.selectedIndex = idx
        return
      }
    }
  }

  private allPlaced() {
    return this.placedFlags.every((p) => p)
  }

  private updateButtonLabel() {
    if (this.allPlaced()) {
      this.container.table.cue.aimInputs.setButtonText("Hit")
      return
    }
    this.container.table.cue.aimInputs.setButtonText("Place")
  }
}
