'use strict'

import {
  CGPoint,
  CGRect,
  SKAction,
  SKNode,
  SKScene,
  SKSceneScaleMode,
  SKSpriteNode,
  SKTexture
} from 'jscenekit'
import Button from './UI/Button'
import Menu from './UI/Menu'

export default class Overlay extends SKScene {

// MARK: - Initialization
  constructor(size, controller) {
    super(size)
    if(!controller){
      return
    }

    this._collectedGemsCount = 0
    this.overlayNode = new SKNode()

    const w = size.width
    const h = size.height

    this.collectedGemsSprites = []

    // Setup the game overlays using SpriteKit.
    this.scaleMode = SKSceneScaleMode.resizeFill

    this.addChild(this.overlayNode)
    this.overlayNode.position = new CGPoint(0.0, h)

    // The Max icon.
    const characterNode = SKSpriteNode.nodeWithImageNamed('Overlays/MaxIcon.png')
    const menuButton = Button.buttonWithSKNode(characterNode)
    menuButton.position = new CGPoint(50, -50)
    menuButton.xScale = 0.5
    menuButton.yScale = 0.5
    this.overlayNode.addChild(menuButton)
    menuButton.setClickedTarget(this, this.toggleMenu)

    // The Gems
    for(let i=0; i<1; i++){
      const gemNode = SKSpriteNode.nodeWithImageNamed('Overlays/collectableBIG_empty.png')
      gemNode.position = new CGPoint(125 + i * 80, -50)
      gemNode.xScale = 0.25
      gemNode.yScale = 0.25
      this.overlayNode.addChild(gemNode)
      this.collectedGemsSprites.push(gemNode)
    }

    // The key
    this.collectedKeySprite = SKSpriteNode.nodeWithImageNamed('Overlays/key_empty.png')
    this.collectedKeySprite.position = new CGPoint(195, -50)
    this.collectedKeySprite.xScale = 0.4
    this.collectedKeySprite.yScale = 0.4
    this.overlayNode.addChild(this.collectedKeySprite)

    // The virtual D-pad
    /*
      this.controlOverlay = new ControlOverlay(CGRect(0, 0, w, h))
      this.controlOverlay.leftPad.delegate = controller
      this.controlOverlay.rightPad.delegate = controller
      this.controlOverlay.buttonA.delegate = controller
      this.controlOverlay.buttonB.delegate = controller
      this.addChild(this.controlOverlay)
    */
    // the demo UI
    this.demoMenu = new Menu(size)
    this.demoMenu.delegate = controller
    this.demoMenu.isHidden = true
    this.overlayNode.addChild(this.demoMenu)

    // Assign the SpriteKit overlay to the SceneKit view.
    this.isUserInteractionEnabled = false
  }

  layout2DOverlay() {
    this.overlayNode.position = new CGPoint(0.0, this.size.height)

    if(!this.congratulationsGroupNode){
      return
    }

    this.congratulationsGroupNode.position = new CGPoint(this.size.width * 0.5, this.size.height * 0.5)
    this.congratulationsGroupNode.xScale = 1.0
    this.congratulationsGroupNode.yScale = 1.0
    const currentBbox = this.congratulationsGroupNode.calculateAccumulatedFrame()

    const margin = 25.0
    const bounds = new CGRect(0, 0, this.size.width, this.size.height)
    const maximumAllowedBbox = bounds.insetBy(margin, margin)

    const top = currentBbox.maxY - this.congratulationsGroupNode.position.y
    const bottom = this.congratulationsGroupNode.position.y - currentBbox.minY
    const maxTopAllowed = maximumAllowedBbox.maxY - this.congratulationsGroupNode.position.y
    const maxBottomAllowed = this.congratulationsGroupNode.position.y - maximumAllowedBbox.minY

    const left = this.congratulationsGroupNode.position.x - currentBbox.minX
    const right = currentBbox.maxX - this.congratulationsGroupNode.position.x
    const maxLeftAllowed = this.congratulationsGroupNode.position.x - maximumAllowedBbox.minX
    const maxRightAllowed = maximumAllowedBbox.maxX - this.congratulationsGroupNode.position.x

    const topScale = top > maxTopAllowed ? maxTopAllowed / top: 1
    const bottomScale = bottom > maxBottomAllowed ? maxBottomAllowed / bottom: 1
    const leftScale = left > maxLeftAllowed ? maxLeftAllowed / left: 1
    const rightScale = right > maxRightAllowed ? maxRightAllowed / right: 1

    const scale = Math.min(topScale, Math.min(bottomScale, Math.min(leftScale, rightScale)))

    this.congratulationsGroupNode.xScale = scale
    this.congratulationsGroupNode.yScale = scale
  }

  copy() {
    const overlay = new Overlay(this.size)
    overlay._copyValue(this)
    return overlay
  }

  _copyValue(src) {
    super._copyValue(src)
    this._collectedGemsCount = src._collectedGemsCount
    this.overlayNode = src.overlayNode
    this.collectedGemsSprites = src.collectedGemsSprites
    this.scaleMode = src.scaleMode
    this.collectedKeySprite = src.collectedKeySprite
    this.demoMenu = src.demoMenu
    this.isUserInteractionEnabled = src.isUserInteractionEnabled
    this.congratulationsGroupNode = src.congratulationsGroupNode
  }

  get collectedGemsCount() {
    return this._collectedGemsCount
  }
  set collectedGemsCount(newValue) {
    this._collectedGemsCount = newValue

    this.collectedGemsSprites[this._collectedGemsCount - 1].texture = SKTexture.textureWithImageNamed('Overlays/collectableBIG_full.png')

    this.collectedGemsSprites[this._collectedGemsCount - 1].run(SKAction.sequence([
      SKAction.waitForDuration(0.5),
      SKAction.scaleByDuration(1.5, 0.2),
      SKAction.scaleByDuration(1 / 1.5, 0.2)
    ]))
  }

  didCollectKey() {
    this.collectedKeySprite.texture = SKTexture.textureWithImageNamed('Overlays/key_full.png')
    this.collectedKeySprite.run(SKAction.sequence([
      SKAction.waitForDuration(0.5),
      SKAction.scaleByDuration(1.5, 0.2),
      SKAction.scaleByDuration(1 / 1.5, 0.2)
    ]))
  }

  /*
  showVirtualPad() {
    this.controlOverlay.isHidden = false
  }

  hideVirtualPad() {
    this.controlOverlay.isHidden = true
  }
  */

  // MARK: Congratulate the player

  showEndScreen() {
    // Congratulation title
    const congratulationsNode = SKSpriteNode.nodeWithImageNamed('Overlays/congratulations.png')

    // Max image
    const characterNode = SKSpriteNode.nodeWithImageNamed('Overlays/congratulations_pandaMax.png')
    characterNode.position = new CGPoint(0.0, -220.0)
    characterNode.anchorPoint = new CGPoint(0.5, 0.0)

    this.congratulationsGroupNode = new SKNode()
    this.congratulationsGroupNode.addChild(characterNode)
    this.congratulationsGroupNode.addChild(congratulationsNode)
    this.addChild(this.congratulationsGroupNode)

    // Layout the overlay
    this.layout2DOverlay()

    // Animate
    congratulationsNode.alpha = 0.0
    congratulationsNode.xScale = 0.0
    congratulationsNode.yScale = 0.0
    congratulationsNode.run( SKAction.group([SKAction.fadeInWithDuration(0.25),
                             SKAction.sequence([SKAction.scaleToDuration(1.22, 0.25),
                            SKAction.scaleToDuration(1.0, 0.1)])]))

    characterNode.alpha = 0.0
    characterNode.xScale = 0.0
    characterNode.yScale = 0.0
    characterNode.run(SKAction.sequence([SKAction.waitForDuration(0.5),
                     SKAction.group([SKAction.fadeInWithDuration(0.5),
                     SKAction.sequence([SKAction.scaleToDuration(1.22, 0.25),
                    SKAction.scaleToDuration(1.0, 0.1)])])]))
  }

  toggleMenu(sender) {
    this.demoMenu.isHidden = !this.demoMenu.isHidden
  }
}

