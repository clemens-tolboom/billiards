import { Container } from "../container/container"
import { BreakEvent } from "../events/breakevent"
import { ChatEvent } from "../events/chatevent"
import { StationaryEvent } from "../events/stationaryevent"
import { share, shorten } from "../utils/shorten"
import { PlaceBall } from "../controller/placeball"
import { Aim } from "../controller/aim"

export class Menu {
  container: Container
  redo: HTMLButtonElement
  share: HTMLButtonElement
  replay: HTMLButtonElement
  camera: HTMLButtonElement
  practice: HTMLButtonElement
  private practiceActive = false

  disabled = true

  constructor(container) {
    this.container = container

    this.replay = this.getElement("replay")
    this.redo = this.getElement("redo")
    this.share = this.getElement("share")
    this.camera = this.getElement("camera")
    this.practice = this.getElement("practice")
    if (this.camera) {
      this.setMenu(true)
      this.camera.onclick = (_) => {
        this.adjustCamera()
      }
    }
    if (this.practice) {
      this.practice.onclick = () => this.togglePractice(!this.practiceActive)
    }
  }

  setMenu(disabled) {
    this.replay.disabled = disabled
    this.redo.disabled = disabled
    this.share.disabled = disabled
  }

  adjustCamera() {
    this.container.view.camera.toggleMode()
    this.container.lastEventTime = performance.now()
  }

  replayMode(url, breakEvent: BreakEvent) {
    if (!this.replay) {
      return
    }

    this.setMenu(false)
    const queue = this.container.eventQueue
    this.share.onclick = (_) => {
      shorten(url, (url) => {
        const response = share(url)
        queue.push(new ChatEvent(null, response))
      })
    }
    this.redo.onclick = (_) => {
      const redoEvent = new BreakEvent(breakEvent.init, breakEvent.shots)
      redoEvent.retry = true
      this.interuptEventQueue(redoEvent)
    }
    this.replay.onclick = (_) => {
      this.interuptEventQueue(breakEvent)
    }
  }

  interuptEventQueue(breakEvent: BreakEvent) {
    this.container.table.halt()
    const queue = this.container.eventQueue
    queue.length = 0
    queue.push(new StationaryEvent())
    queue.push(breakEvent)
  }

  getElement(id): HTMLButtonElement {
    return document.getElementById(id)! as HTMLButtonElement
  }

  private togglePractice(enabled: boolean) {
    // stop current action and enter/exit placement
    this.container.table.halt()
    this.container.eventQueue.length = 0
    this.practiceActive = enabled
    this.updatePracticeButton()
    if (enabled) {
      this.container.chat.showMessage("Practice: place balls")
      this.container.updateController(new PlaceBall(this.container, true))
      this.container.view.camera.forceMode(this.container.view.camera.topView)
      return
    }
    this.container.chat.showMessage("Practice off")
    this.container.view.camera.toggleMode() // restore from forced top to previous
    this.container.updateController(new Aim(this.container))
  }

  private updatePracticeButton() {
    if (!this.practice) return
    this.practice.textContent = this.practiceActive ? "🏓✔" : "🏓"
    this.practice.classList.toggle("active", this.practiceActive)
  }
}
