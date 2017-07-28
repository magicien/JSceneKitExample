'use strict'

import {
} from 'jscenekit'
import BaseComponent from './BaseComponent'

export default class PlayerComponent extends BaseComponent {
  constructor() {
    super()
    this.character = null
  }

  updateDeltaTime(seconds) {
    this.positionAgentFromNode()
    super.updateDeltaTime(seconds)
  }
}

