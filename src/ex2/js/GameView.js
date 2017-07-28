'use strict'

import {
  CGPoint,
  CGRect,
  CGSize,
  SCNView,
  SKAction,
  SKColor,
  SKLabelHorizontalAlignmentMode,
  SKLabelNode,
  SKNode,
  SKScene,
  SKSceneScaleMode,
  SKSpriteNode,
  SKTexture
} from 'jscenekit'

export default class GameView extends SCNView {

  // MARK: 2D Overlay

  constructor(frame, options = null) {
    super(frame, options)

    this.overlayNode = new SKNode()
    this.congratulationsGroupNode = new SKNode()
    this.collectedPearlCountLabel = SKLabelNode.labelWithFontNamed('Chalkduster')
    this.collectedFlowerSprites = []

    this._collectedPearlsCount = 0
    this._collectedFlowersCount = 0
    this.eventsDelegate = null

    this._loadingScene = new SKScene()
    this._gameScene = new SKScene()

    this.setLoadingScene()
  }

  viewDidMoveToWindow() {
    super.viewDidMoveToWindow()
    this.setup2DOverlay()
  }

  setFrameSize(newSize) {
    super.setFrameSize(newSize)
    this.layout2DOverlay()
  }

  setLoadingScene() {
    this._loadingScene.scaleMode = SKSceneScaleMode.resizeFill
    this._loadingScene.backgroundColor = SKColor.white

    const loadingText = new SKLabelNode()
    loadingText.text = 'Loading...'
    loadingText.fontColor = SKColor.black
    loadingText.horizontalAlignmentMode = SKLabelHorizontalAlignmentMode.left
    loadingText.position = new CGPoint(50, 50)

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

  layout2DOverlay() {
    this.overlayNode.position = new CGPoint(0.0, this.bounds.size.height)

    this.congratulationsGroupNode.position = new CGPoint(this.bounds.size.width * 0.5, this.bounds.size.height * 0.5)

    this.congratulationsGroupNode.xScale = 1.0
    this.congratulationsGroupNode.yScale = 1.0
    const currentBbox = this.congratulationsGroupNode.calculateAccumulatedFrame()

    const margin = 25.0
    const maximumAllowedBbox = this.bounds.insetBy(margin, margin)

    const top = currentBbox.maxY - this.congratulationsGroupNode.position.y
    const bottom = this.congratulationsGroupNode.position.y - currentBbox.minY
    const maxTopAllowed = maximumAllowedBbox.maxY - this.congratulationsGroupNode.position.y
    const maxBottomAllowed = this.congratulationsGroupNode.position.y - maximumAllowedBbox.minY

    const left = this.congratulationsGroupNode.position.x - currentBbox.minX
    const right = currentBbox.maxX - this.congratulationsGroupNode.position.x
    const maxLeftAllowed = this.congratulationsGroupNode.position.x - maximumAllowedBbox.minX
    const maxRightAllowed = maximumAllowedBbox.maxX - this.congratulationsGroupNode.position.x

    const topScale = top > maxTopAllowed ? maxTopAllowed / top : 1
    const bottomScale = bottom > maxBottomAllowed ? maxBottomAllowed / bottom : 1
    const leftScale = left > maxLeftAllowed ? maxLeftAllowed / left : 1
    const rightScale = right > maxRightAllowed ? maxRightAllowed / right : 1

    const scale = Math.min(topScale, Math.min(bottomScale, Math.min(leftScale, rightScale)))

    this.congratulationsGroupNode.xScale = scale
    this.congratulationsGroupNode.yScale = scale
  }

  setup2DOverlay() {
    const w = this.bounds.size.width
    const h = this.bounds.size.height

    // Setup the game overlays using SpriteKit.
    const skScene = new SKScene(new CGSize(w, h))
    skScene.scaleMode = SKSceneScaleMode.resizeFill

    skScene.addChild(this.overlayNode)
    this.overlayNode.position = new CGPoint(0.0, h)

    // The Max icon.
    this.overlayNode.addChild(SKSpriteNode.nodeWithImageNamedPositionScale('Overlays/MaxIcon.png', new CGPoint(50, -50), 0.5))

    // The flowers.
    for(let i=0; i<3; i++){
      this.collectedFlowerSprites.push(SKSpriteNode.nodeWithImageNamedPositionScale('Overlays/FlowerEmpty.png', new CGPoint(110 + i * 40, -50), 0.25))
      this.overlayNode.addChild(this.collectedFlowerSprites[i])
    }

    // The pearl icon and count.
    this.overlayNode.addChild(SKSpriteNode.nodeWithImageNamedPositionScale('Overlays/ItemsPearl.png', new CGPoint(110, -100), 0.5))
    this.collectedPearlCountLabel.text = 'x0'
    this.collectedPearlCountLabel.position = new CGPoint(152, -113)
    this.overlayNode.addChild(this.collectedPearlCountLabel)

    // The virtual D-pad
    /*
    const virtualDPadBounds = virtualDPadBoundsInScene()
    const dpadSprite = new SKSpriteNode('dpad.png', virtualDPadBounds.origin, 1.0)
    dpadSprite.anchorPoint = new CGPoint(0.0, 0.0)
    dpadSprite.size = virtualDPadBounds.size
    skScene.addChild(dpadSprite)
    */
    
    // Assign the SpriteKit overlay to the SceneKit view.
    //this.overlaySKScene = skScene
    this._gameScene = skScene
    skScene.isUserInteractionEnabled = false
  }

  showGameSKScene() {
    this.overlaySKScene = this._gameScene
  }

  get collectedPearlsCount() {
    return this._collectedPearlsCount
  }
  set collectedPearlsCount(newValue) {
    this._collectedPearlsCount = newValue
    if(this._collectedPearlsCount === 10){
      this.collectedPearlCountLabel.position = new CGPoint(158, this.collectedPearlCountLabel.position.y)
    }
    this.collectedPearlCountLabel.text = `x${this.collectedPearlsCount}`
  }

  get collectedFlowersCount() {
    return this._collectedFlowersCount
  }
  set collectedFlowersCount(newValue) {
    this._collectedFlowersCount = newValue
    this.collectedFlowerSprites[this._collectedFlowersCount - 1].texture = SKTexture.textureWithImageNamed('Overlays/FlowerFull.png')
  }

  // MARK: Congratulating the Player

  showEndScreen() {
    // Congratulation title
    //let congratulationsNode = null
    //const congratulationsNodePromise = SKSpriteNode.nodeWithImageNamed('Overlays/congratulations.png')
    //.then((node) => {
    //  congratulationsNode = node
    //})
    const congratulationsNode = SKSpriteNode.nodeWithImageNamed('Overlays/congratulations.png')

    // Max image
    //let characterNode = null
    //const characterNodePromise = SKSpriteNode.nodeWithImageNamed('Overlays/congratulations_pandaMax.png')
    //.then((node) => {
    //  characterNode = node
    //  characterNode.position = new CGPoint(0.0, -220.0)
    //  characterNode.anchorPoint = new CGPoint(0.5, 0.0)
    //})
    const characterNode = SKSpriteNode.nodeWithImageNamed('Overlays/congratulations_pandaMax.png')
    characterNode.position = new CGPoint(0.0, -220.0)
    characterNode.anchorPoint = new CGPoint(0.5, 0.0)

    Promise.all([congratulationsNode.didLoad, characterNode.didLoad])
    .then(() => {
      this.congratulationsGroupNode.addChild(characterNode)
      this.congratulationsGroupNode.addChild(congratulationsNode)

      const overlayScene = this.overlaySKScene
      overlayScene.addChild(this.congratulationsGroupNode)

      // Layout the overlay
      this.layout2DOverlay()

      // Animate
      congratulationsNode.alpha = 0.0
      congratulationsNode.xScale = 0.0
      congratulationsNode.yScale = 0.0
      congratulationsNode.run(SKAction.group([
        SKAction.fadeInWithDuration(0.25),
        SKAction.sequence([SKAction.scaleToDuration(1.22, 0.25), SKAction.scaleToDuration(1.0, 0.1)])]))

      characterNode.alpha = 0.0
      characterNode.xScale = 0.0
      characterNode.yScale = 0.0
      characterNode.run(SKAction.sequence([
        SKAction.waitForDuration(0.5),
        SKAction.group([
          SKAction.fadeInWithDuration(0.5),
          SKAction.sequence([SKAction.scaleToDuration(1.22, 0.25), SKAction.scaleToDuration(1.0, 0.1)])])]))

      this.congratulationsGroupNode.position = new CGPoint(this.bounds.size.width * 0.5, this.bounds.size.height * 0.5)
    })
  }

  // MARK: Mouse and Keyboard Events

  mouseDownWith(event) {
    if(!this.eventsDelegate || !this.eventsDelegate.mouseDownInViewWithEvent || !this.eventsDelegate.mouseDownInViewWithEvent(this, event)){
      super.mouseDownWith(event)
      return
    }
  }

  mouseDraggedWith(event) {
    if(!this.eventsDelegate || !this.eventsDelegate.mouseDraggedInViewWithEvent || !this.eventsDelegate.mouseDraggedInViewWithEvent(this, event)){
      super.mouseDraggedWith(event)
      return
    }
  }
    
  mouseUpWith(event) {
    if(!this.eventsDelegate || !this.eventsDelegate.mouseUpInViewWithEvent || !this.eventsDelegate.mouseUpInViewWithEvent(this, event)){
      super.mouseUpWith(event)
      return
    }
  }

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

  // MARK: Virtual D-pad

  /*

  virtualDPadBoundsInScene() {
    return new CGRect(10.0, 10.0, 150.0, 150.0)
  }

  virtualDPadBounds() {
    const virtualDPadBounds = this.virtualDPadBoundsInScene()
    virtualDPadBounds.origin.y = this.bounds.size.height - virtualDPadBounds.size.height + virtualDPadBounds.origin.y
    return virtualDPadBounds
  }

  */

}

