'use strict'

import {
  SCNView,
  SKColor
} from 'jscenekit'
import GameController from './GameController'

//export default class GameViewControllerMacOS extends NSViewController {
export default class GameViewControllerMacOS {
  get gameView() {
    return this.view
  }

  constructor() {
    // super()

    this.view = new GameViewMacOS()
    this.gameController = null
  }
  
  viewDidLoad() {
    this.gameController = new GameController(this.gameView)

    // Configure the view
    this.gameView.backgroundColor = SKColor.black

    // Link view and controller
    this.gameView.viewController = this

    this.gameView.isPlaying = true
    this.gameView.loops = true
  }

  keyDownEvent(view, theEvent) {
    let characterDirection = this.gameController.characterDirection
    let cameraDirection = this.gameController.cameraDirection

    let updateCamera = false
    let updateCharacter = false

    switch(theEvent.keyCode){
      case 126:
        // Up
        if(!theEvent.isARepeat){
          characterDirection.y = -1
          updateCharacter = true
        }
        break
      case 125:
        // Down
        if(!theEvent.isARepeat){
          characterDirection.y = 1
          updateCharacter = true
        }
        break
      case 123:
        // Left
        if(!theEvent.isARepeat){
          characterDirection.x = -1
          updateCharacter = true
        }
        break
      case 124:
        // Right
        if(!theEvent.isARepeat){
          characterDirection.x = 1
          updateCharacter = true
        }
        break
      case 13:
        // Camera Up
        if(!theEvent.isARepeat){
          cameraDirection.y = -1
          updateCamera = true
        }
        break
      case 1:
        // Camera Down
        if(!theEvent.isARepeat){
          cameraDirection.y = 1
          updateCamera = true
        }
        break
      case 0:
        // Camera Left
        if(!theEvent.isARepeat){
          cameraDirection.x = -1
          updateCamera = true
        }
        break
      case 2:
        // Camera Right
        if(!theEvent.isARepeat){
          cameraDirection.x = 1
          updateCamera = true
        }
        break
      case 49:
        // Space
        if(!theEvent.isARepeat){
          this.gameController.controllerJump(true)
        }
        return true
      case 8:
        // c
        if(!theEvent.isARepeat){
          this.gameController.controllerAttack()
        }
        return true
      default:
        return false
    }

    if(updateCharacter){
      this.gameController.characterDirection = characterDirection.length() === 0 ? characterDirection: characterDirection.normalize()
    }

    if(updateCamera){
      this.gameController.cameraDirection = cameraDirection.length() === 0 ? cameraDirection: cameraDirection.normalize()
    }

    return true
  }

  keyUpEvent(view, theEvent) {
    let characterDirection = this.gameController.characterDirection
    let cameraDirection = this.gameController.cameraDirection

    let updateCamera = false
    let updateCharacter = false

    switch(theEvent.keyCode){
      case 36:
        if(!theEvent.isARepeat){
          this.gameController.resetPlayerPosition()
        }
        return true
      case 126:
        // Up
        if(!theEvent.isARepeat && characterDirection.y < 0){
          characterDirection.y = 0
          updateCharacter = true
        }
        break
      case 125:
        // Down
        if(!theEvent.isARepeat && characterDirection.y > 0){
          characterDirection.y = 0
          updateCharacter = true
        }
        break
      case 123:
        // Left
        if(!theEvent.isARepeat && characterDirection.x < 0){
          characterDirection.x = 0
          updateCharacter = true
        }
        break
      case 124:
        // Right
        if(!theEvent.isARepeat && characterDirection.x > 0){
          characterDirection.x = 0
          updateCharacter = true
        }
        break
      case 13:
        // Camera Up
        if(!theEvent.isARepeat && cameraDirection.y < 0){
          cameraDirection.y = 0
          updateCamera = true
        }
        break
      case 1:
        // Camera Down
        if(!theEvent.isARepeat && cameraDirection.y > 0){
          cameraDirection.y = 0
          updateCamera = true
        }
        break
      case 0:
        // Camera Left
        if(!theEvent.isARepeat && cameraDirection.x < 0){
          cameraDirection.x = 0
          updateCamera = true
        }
        break
      case 2:
        // Camera Right
        if(!theEvent.isARepeat && cameraDirection.x > 0){
          cameraDirection.x = 0
          updateCamera = true
        }
        break
      case 49:
        // Space
        if(!theEvent.isARepeat){
          this.gameController.controllerJump(false)
        }
        return true
      case 8:
        // c
        if(!theEvent.isARepeat){
          this.gameController.controllerAttack()
        }
        return true
      default:
        break
    }

    if(updateCharacter){
      this.gameController.characterDirection = characterDirection.length() === 0 ? characterDirection: characterDirection.normalize()
      return true
    }

    if(updateCamera){
      this.gameController.cameraDirection = cameraDirection.length() === 0 ? cameraDirection: cameraDirection.normalize()
      return true
    }

    return false
  }
}

export class GameViewMacOS extends SCNView {
  constructor() {
    super()

    this.viewController = null
  }
  
  // MARK: - EventHandler

  keyDownWith(theEvent) {
    if(this.viewCtonroller && this.viewController.keyUpEvent(this, theEvent) === false){
      super.keyUpWith(theEvent)
    }
  }

  keyUpWith(theEvent) {
    if(this.viewController && this.viewController.keyUpEvent(this, theEvent) === false){
      super.keyUpWith(theEvent)
    }
  }

  setFrameSize(newSize) {
    super.setFrameSize(newSize)
    if(this.overlaySKScene){
      this.overlaySKScene.layout2DOverlay()
    }
  }

  viewDidMoveToWindow() {
    //disable retina
    if(this.layer){
      this.layer.contentsScale = 1.0
    }
  }
}

