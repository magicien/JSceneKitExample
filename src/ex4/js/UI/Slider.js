'use strict'

import {
  CGPoint,
  CGSize,
  SKColor,
  SKLabelNode,
  SKNode,
  SKShapeNode,
  SKSpriteNode
} from 'jscenekit'

export default class Slider extends SKNode {
  get value() {
    return this._value
  }
  set value(newValue) {
    this._value = newValue

    this.slider.position = new CGPoint(this.background.position.x + this._value * this.width, 0.0)
  }

  constructor(width, height, txt) {
    super()
    if(!width){
      return
    }

    this._value = 0.0
    this.label = null
    this.slider = null
    this.background = null
    this.actionClicked = null
    this.targetClicked = null

    // create a label
    const fontName = 'Optima-ExtraBlack'
    this.label = SKLabelNode.labelWithFontNamed(fontName)
    this.label.text = txt
    this.label.fontSize = 18
    this.label.fontColor = SKColor.white
    this.label.position = new CGPoint(0.0, -8.0)

    // create background & slider
    this.background = SKSpriteNode.nodeWithColorSize(SKColor.white, new CGSize(width, 2))
    this.slider = SKShapeNode.nodeWithCircleOfRadius(height)
    this.slider.fillColor = SKColor.white
    this.background.anchorPoint = new CGPoint(0.0, 0.5)

    this.slider.position = new CGPoint(this.label.frame.size.width / 2.0 + 15, 0.0)
    this.background.position = new CGPoint(this.label.frame.size.width / 2.0 + 15, 0.0)

    // add to the root node
    this.addChild(this.label)
    this.addChild(this.background)
    this.addChild(this.slider)

    // track mouse event
    this.isUserInteractionEnabled = true
    this.value = 0.0
  }

  get width() {
    return this.background.frame.size.width
  }

  get height() {
    return this.slider.frame.size.height
  }

  setBackgroundColor(col) {
    this.background.color = col
  }

  setClickedTarget(target, action) {
    this.targetClicked = target
    this.actionClicked = action
  }

  mouseDownWith(event) {
    this.mouseDraggedWith(event)
  }

  mouseUpWith(event) {
    this.setBackgroundColor(SKColor.white)
  }

  mouseDraggedWith(event) {
    this.setBackgroundColor(SKColor.gray)

    const posInView = this.scene.convertFrom(this.position, this.parent)

    const x = event.locationInWindow.x - posInView.x - this.background.position.x
    const pos = Math.max(Math.min(x, width), 0.0)
    this.slider.position = new CGPoint(this.background.position.x + pos, 0.0)
    this.value = pos / this.width
    if(this.targetClicked){
      this.targetClicked.perform(this.actionClicked, this)
    }
  }

/*
  touchesMovedWith(touches, event) {
    this.setBackgroundColor(SKColor.gray)
    const x = touches[0].locationIn(this).x - this.background.position.x
    const pos = Math.max(Math.min(x, width), 0.0)

    this.slider.position = new CGPoint(this.background.position.x + pos, 0.0)
    this.value = pos / width
    if(this.targetClicked){
      this.targetClicked.perform(this.actionClicked, this)
    }
  }
*/
}

