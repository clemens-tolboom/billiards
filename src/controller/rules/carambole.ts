import { Aim } from "../../controller/aim"
import { Controller } from "../../controller/controller"
import { WatchAim } from "../../controller/watchaim"
import { WatchEvent } from "../../events/watchevent"
import { Outcome } from "../../model/outcome"
import { Respot } from "../../utils/respot"
import { StartAimEvent } from "../../events/startaimevent"
import { ThreeCushion } from "./threecushion"

/**
 * Carambole shares the three-cushion table/balls but scores as soon as
 * the cueball contacts both other balls (no cushion requirement).
 */
export class Carambole extends ThreeCushion {
  rulename = "carambole"

  constructor(container) {
    super(container)
  }

  nextCandidateBall() {
    // Reuse three-cushion respot logic
    return Respot.closest(
      this.container.table.cueball,
      this.container.table.balls
    )
  }

  update(outcomes: Outcome[]): Controller {
    if (Outcome.isCarambolePoint(this.cueball, outcomes)) {
      this.container.sound.playSuccess(outcomes.length / 3)
      this.container.sendEvent(new WatchEvent(this.container.table.serialise()))
      this.currentBreak++
      this.score++
      return new Aim(this.container)
    }

    this.previousBreak = this.currentBreak
    this.currentBreak = 0

    if (this.container.isSinglePlayer) {
      this.cueball = this.otherPlayersCueBall()
      this.container.table.cue.aim.i = this.container.table.balls.indexOf(
        this.cueball
      )
      return new Aim(this.container)
    }

    this.container.sendEvent(new StartAimEvent())
    return new WatchAim(this.container)
  }

  isPartOfBreak(outcome: Outcome[]) {
    return Outcome.isCarambolePoint(this.cueball, outcome)
  }
}

