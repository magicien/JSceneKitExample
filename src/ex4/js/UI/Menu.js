'use strict'

import {
  CGPoint,
  SKAction,
  SKNode
} from 'jscenekit'
import Button from './Button'
import Slider from './Slider'

export default class Menu extends SKNode {
  constructor(size) {
    super()
    if(!size){
      return
    }

    this.delegate = null

    this.cameraButtons = []
    this.dofSliders = []
    this.isMenuHidden = false

    this.buttonMargin = 250
    this.menuY = 40
    this.duration = 0.3

    // Track mouse event
    this.isUserInteractionEnabled = true

    // Camera buttons
    let buttonLabels = ['Camera 1', 'Camera 2', 'Camera 3']
    this.cameraButtons = buttonLabels.map(($0) => { return Button.buttonWithText($0) })

    this.cameraButtons.forEach((button, i) => {
      const x = button.width / 2 + (i > 0 ? this.cameraButtons[i - 1].position.x + this.cameraButtons[i - 1].width / 2 + 10: this.buttonMargin)
      const y = size.height - this.menuY
      button.position = new CGPoint(x, y)
      button.setClickedTarget(this, this.menuChanged)
      this.addChild(button)
    })

    // Depth of Field
    buttonLabels = ['fStop', 'Focus']
    this.dofSliders = buttonLabels.map(($0) => { return new Slider(300, 10, $0) })

    this.dofSliders.forEach((slider, i) => {
      slider.position = new CGPoint(this.buttonMargin, size.height - i * 30.0 - 70.0)
      slider.alpha = 0.0
      this.addChild(slider)
    })
    this.dofSliders[0].setClickedTarget(this, this.cameraFStopChanged)
    this.dofSliders[1].setClickedTarget(this, this.cameraFocusDistanceChanged)
  }

  menuChanged(sender) {
    this.hideSliderMenu()
    const index = this.cameraButtons.indexOf(sender)
    if(index >= 0){
      this.delegate.debugMenuSelectCameraAtIndex(index)
      if(index === 2){
        this.showSlidersMenu()
      }
    }
  }

  get isHidden() {
    return this.isMenuHidden
  }
  set isHidden(newValue) {
    if(newValue){
      this.hide()
    }else{
      this.show()
    }
  }

  show() {
    if(!this.cameraButtons){
      return
    }
    for(const button of this.cameraButtons){
      button.alpha = 0.0
      button.run(SKAction.fadeInWithDuration(this.duration))
    }
    this.isMenuHidden = false
  }

  hide() {
    if(!this.cameraButtons){
      return
    }
    for(const button of this.cameraButtons){
      button.alpha = 1.0
      button.run(SKAction.fadeOutWithDuration(this.duration))
    }
    this.hideSliderMenu()
    this.isMenuHidden = true
  }

  hideSliderMenu() {
    if(!this.dofSliders){
      return
    }
    for(const slider of this.dofSliders){
      slider.run(SKAction.fadeOutWithDuration(this.duration))
    }
  }

  showSliderMenu() {
    if(!this.dofSliders){
      return
    }
    for(const slider of this.dofSliders){
      slider.run(SKAction.fadeInWithDuration(this.duration))
    }
    this.dofSliders[0].value = 0.1
    this.dofSliders[1].value = 0.5
    this.perform(this.cameraFStopChanged, this.dofSliders[0])
    this.perform(this.cameraFocusDistanceChanged, this.dofSliders[1])
  }

  cameraFStopChanged(sender) {
    const method = this.delegate ? this.delegate.fStopChanged : null
    if(method){
      method(dofSliders[0].value + 0.2)
    }
  }

  cameraFocusDistanceChanged(sender) {
    const mehtod = this.delegate ? this.delegate.focusDistanceChanged : null
    if(method){
      method(dofSliders[1].value * 20.0 + 3.0)
    }
  }
}

