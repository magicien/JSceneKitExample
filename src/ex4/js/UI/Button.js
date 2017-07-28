'use strict'

import {
  CGPoint,
  CGSize,
  SKColor,
  SKLabelNode,
  SKNode,
  SKSpriteNode
} from 'jscenekit'

export default class Button extends SKNode {
  constructor() {
    super()

    this.label = null
    this.background = null
    this.actionClicked = null
    this.targetClicked = null
    this.size = new CGSize()
  }

  setText(txt) {
    this.label.text = txt
  }

  setBackgroundColor(col) {
    if(!this.background){
      return
    }
    this.background.color = col
  }

  setClickedTarget(target, action) {
    this.targetClicked = target
    this.actionClicked = action
  }

  static buttonWithText(txt) {
    const button = new Button()

    // create a label
    const fontName = 'Optima-ExtraBlack'
    button.label = SKLabelNode.labelWithFontNamed(fontName)
    button.label.text = txt
    button.label.fontSize = 18
    button.label.fontColor = SKColor.white
    button.label.position = new CGPoint(0.0, -8.0)

    // create the background
    button.size = new CGSize(button.label.frame.size.width + 10.0, 30.0)
    button.background = SKSpriteNode.nodeWithColorSize(new SKColor(0, 0, 0, 0.75), button.size)

    // add to the root node
    button.addChild(button.background)
    button.addChild(button.label)

    // Track mouse event
    button.isUserInteractionEnabled = true

    return button
  }

  static buttonWithSKNode(node) {
    const button = new Button()

    // Track mouse event
    button.isUserInteractionEnabled = true
    button.size = node.frame.size
    button.addChild(node)

    return button
  }

  height() {
    return this.size.height
  }

  mouseDownWith(event) {
    this.setBackgroundColor(new SKColor(0, 0, 0, 1.0))
  }

  mouseUpWith(event) {
    this.setBackgroundColor(new SKColor(0, 0, 0, 0.75))

    const x = this.position.x + (this.parent ? this.parent.position.x : 0)
    const y = this.position.y + (this.parent ? this.parent.position.y : 0)
    const p = event.locationInWindow

    if(Math.abs(p.x - x) < this.width / 2 * this.xScale && Math.abs(p.y - y) < this.height() / 2 * this.yScale){
      this.targetClicked.perform(this.actionClicked, this)
    }
  }

/*
  touchesEndedWith(touches, event) {
    this.targetClicked.perform(this.actionClicked, this)
  }
*/
}
