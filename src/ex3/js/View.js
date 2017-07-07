'use strict'

import {
  CGPoint,
  CGSize,
  SCNView,
  SKAction,
  SKColor,
  SKLabelHorizontalAlignmentMode,
  SKLabelNode,
  SKNode,
  SKScene,
  SKSceneScaleMode,
  SKSpriteNode
} from 'jscenekit'

export default class View extends SCNView {

  constructor(frame, options = null) {
    super(frame, options)

    this.eventsDelegate = null
    this._overlayNode = new SKNode()
    this._scaleNode = new SKNode()
    this._collectedItemsCount = 0
    this._collectedItemsCountLabel = SKLabelNode.labelWithFontNamed('Superclarendon')

    this._loadingScene = new SKScene()
    this._gameScene = new SKScene()

    this.setLoadingScene()
  }

  // MARK: Mouse and Keyboard Events

  keyDownWith(event) {
    if(!this.eventsDelegate || !this.eventsDelegate.keyDownInViewWithEvent || !this.eventsDelegate.keyDownInViewWithEvent(this, event)){
      super.keyDownWith(event)
      return
    }
  }

  keyUpWith(event) {
    if(!this.eventsDelegate || !this.eventsDelegate.keyUpInViewWithEvent || !this.eventsDelegate.keyUpInViewWithEvent(this, event)){
      super.keyUpWith(event)
      return
    }
  }

  // Resizing

  setFrameSize(newSize) {
    super.setFrameSize(newSize)
    this.update2DOverlays()
  }

  setLoadingScene() {
    this._loadingScene.scaleMode = SKSceneScaleMode.resizeFill
    this._loadingScene.backgroundColor = SKColor.white

    const loadingText = new SKLabelNode()
    loadingText.text = 'Loading...'
    loadingText.fontColor = SKColor.black
    loadingText.position = new CGPoint(100, 100)

    const fadeAction = SKAction.repeatForever(
      SKAction.sequence([
        SKAction.fadeOutWithDuration(0.5),
        SKAction.fadeInWithDuration(0.5)
      ])
    )
    loadingText.run(fadeAction)

    this._loadingScene.addChild(loadingText)

    this.overlaySKScene = this._loadingScene
  }

  // MARK: Overlays

  update2DOverlays() {
    this._overlayNode.position = new CGPoint(0.0, this.bounds.size.height)
  }

  setup2DOverlay() {
    const w = this.bounds.size.width
    const h = this.bounds.size.height

    // Setup the game overlays using SpriteKit.
    const skScene = new SKScene(new CGSize(w, h))
    skScene.scaleMode = SKSceneScaleMode.resizeFill

    skScene.addChild(this._scaleNode)
    this._scaleNode.addChild(this._overlayNode)
    this._overlayNode.position = new CGPoint(0.0, h)

    // The Bob icon.
    const bobSprite = new SKSpriteNode('overlays/BobHUD.png')
    bobSprite.position = new CGPoint(70, -50)
    bobSprite.xScale = 0.5
    bobSprite.yScale = 0.5
    this._overlayNode.addChild(bobSprite)

    this._collectedItemsCountLabel.text = 'x0'
    this._collectedItemsCountLabel.horizontalAlignmentMode = SKLabelHorizontalAlignmentMode.left
    this._collectedItemsCountLabel.position = new CGPoint(135, -63)
    this._overlayNode.addChild(this._collectedItemsCountLabel)

    // Assign the SpriteKit overlay to the SceneKit view.
    this.overlaySKScene = skScene
    skScene.isUserInteractionEnabled = false
  }

  get collectedItemsCount() {
    return this._collectedItemsCount
  }
  set collectedItemsCount(newValue) {
    this._collectedItemsCount = newValue
    this._collectedItemsCountLabel.text = `x${this._collectedItemsCount}`
  }

  didCollectItem() {
    this.collectedItemsCount = this.collectedItemsCount + 1
  }

  didCollectBigItem() {
    this.collectedItemsCount = this.collectedItemsCount + 10
  }

}

