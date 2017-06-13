'use strict'

import {
  CABasicAnimation,
  CACurrentMediaTime,
  CAMediaTimingFunction,
  CGPoint,
  DispatchQueue,
  NotificationCenter,
  NSNotification,
  SCNAction,
  SCNActionTimingMode,
  SCNAudioPlayer,
  SCNAudioSource,
  SCNMatrix4MakeTranslation,
  SCNNode,
  SCNParticleSystem,
  SCNPhysicsBody,
  SCNPhysicsShape,
  SCNScene,
  SCNTransaction,
  SCNVector3,
  SCNVector3Zero,
  SCNVector4,

  kCAFillModeBoth,
  kCAMediaTimingFunctionEaseInEaseOut,
  kCAMediaTimingFunctionEaseOut
} from 'jscenekit'
import Character from './Character'
import GameView from './GameView'

const GroundType = {
  grass: 0,
  rock: 1,
  water: 2,
  inTheAir: 3,
  count: 4
}

// Collision bit masks
const BitmaskCollision        = 1 << 2
const BitmaskCollectable      = 1 << 3
const BitmaskEnemy            = 1 << 4
const BitmaskSuperCollectable = 1 << 5
const BitmaskWater            = 1 << 6

class KeyboardDirection {
  constructor(rawValue) {
    this.rawValue = rawValue
  }

  static get left() {
    return 123
  }

  static get right() {
    return 124
  }
  
  static get down() {
    return 125
  }

  static get up() {
    return 126
  }

  static get 123() {
    return new KeyboardDirection(123)
  }

  static get 124() {
    return new KeyboardDirection(124)
  }

  static get 125() {
    return new KeyboardDirection(125)
  }

  static get 126() {
    return new KeyboardDirection(126)
  }
  
  get vector() {
    switch(this.rawValue){
      case KeyboardDirection.up:
        return new CGPoint(0, -1)
      case KeyboardDirection.down:
        return new CGPoint(0, 1)
      case KeyboardDirection.left:
        return new CGPoint(-1, 0)
      case KeyboardDirection.right:
        return new CGPoint(1, 0)
      default:
        throw new Error(`unknown rawValue: ${this.rawValue}`)
    }
  }
}

export default class GameViewController {

  // MARK: initialization

  constructor() {
    // super()

    this.gameView = new GameView()
    this.view = this.gameView

    // Nodes to manipulate the camera
    this.cameraYHandle = new SCNNode()
    this.cameraXHandle = new SCNNode()

    // The character
    this.character = new Character()

    // Game states
    this.gameIsComplete = false
    this.lockCamera = false

    this.grassArea = null
    this.waterArea = null
    this.flames = []
    this.enemies = []

    // Sounds
    this.collectPearlSound = null
    this.collectFlowerSound = null
    this.frameThrowerSound = null
    this.victoryMusic = null

    // Particles
    this.confettiParticleSystem = null
    this.collectFlowerParticleSystem = null

    // For automatic camera animation
    this.currentGround = null
    this.mainGround = null
    this.groundToCameraPosition = new Map()

    // Game controls
    this.controllerDPad = null
    this.controllerStoredDirection = new CGPoint(0, 0)

    this.lastMousePosition = new CGPoint(0, 0)
    /*
    this.padTouch = null
    this.panningTouch = null
    */

    this.maxPenetrationDistance = 0.0
    this.replacementPosition = null

    this._collectedPearlsCount = 0
    this._collectedFlowersCount = 0
  }

  viewDidLoad() {
    // super.viewDidLoad()

    // Create a new scene.
    //const scene = new SCNScene('game.scnassets/level.scn')
    new SCNScene('game.scnassets/level.scn', null, (scene) => {
      // Set the scene to the view and loop for the animation of the bamboos.
      this.gameView.scene = scene
      this.gameView.isPlaying = true
      this.gameView.loops = true

      // Various setup
      this.setupCamera()
      this.setupSounds()

      // Configure particle systems
      SCNParticleSystem.systemNamedInDirectory('ParticleSystems/collect.scnp', null)
      .then((system) => {
        this.collectFlowerParticleSystem = system
        this.collectFlowerParticleSystem.loops = false
      })

      SCNParticleSystem.systemNamedInDirectory('ParticleSystems/confetti.scnp', null)
      .then((system) => {
        this.confettiParticleSystem = system
      })

      // Add the character to the scene.
      scene.rootNode.addChildNode(this.character.node)

      const startPosition = scene.rootNode.childNodeWithNameRecursively('startingPoint', true)
      this.character.node.transform = startPosition.transform

      // Retrieve various game elements in one traversal
      let collisionNodes = []
      scene.rootNode.enumerateChildNodes((node) => {
        console.warn(`node.name: ${node.name}`)
        switch(node.name){
          case 'flame': {
            node.physicsBody.categoryBitMask = BitmaskEnemy
            this.flames.push(node)
            break
          }
          case 'enemy': {
            this.enemies.push(node)
            break
          }
          default: {
            if(/collision/.test(node.name)){
              collisionNodes.push(node)
            }
          }
        }
      })

      for(const node of collisionNodes){
        node.isHidden = false
        this.setupCollisionNode(node)
      }

      // Setup delegates
      scene.physicsWorld.contactDelegate = this
      this.gameView.delegate = this

      this.setupAutomaticCameraPositions()
      this.setupGameControllers()
    }, null)
  }

  // MARK: Managing the Camera

  panCamera(direction) {
    if(this.lockCamera){
      return
    }

    let directionToPan = direction

    directionToPan.y *= -1.0

    const F = 0.005

    // Make sure the camera handles are collectly reset (because automatic camera animations may have put the "rotation" in a weird state
    SCNTransaction.animateWithDurationTimingFunctionCompletionBlockAnimations(0.0, null, null, () => {
      this.cameraYHandle.removeAllActions()
      this.cameraXHandle.removeAllActions()

      if(this.cameraYHandle.rotation.y < 0){
        this.cameraYHandle.rotation = new SCNVector4(0, 1, 0, -this.cameraYHandle.rotation.w)
      }

      if(this.cameraXHandle.rotation.x < 0){
        this.cameraXHandle.rotation = new SCNVector4(1, 0, 0, -this.cameraXHandle.rotation.w)
      }
    })

    // Update the camera position with some inertia.
    SCNTransaction.animateWithDurationTimingFunctionCompletionBlockAnimations(0.5, CAMediaTimingFunction.functionWithName(kCAMediaTimingFunctionEaseOut), null, () => {
      this.cameraYHandle.rotation = new SCNVector4(0, 1, 0, this.cameraYHandle.rotation.y * (this.cameraYHandle.rotation.w - directionToPan.x * F))
      this.cameraXHandle.rotation = new SCNVector4(1, 0, 0, Math.max(-Math.PI * 0.5, Math.min(0.13, this.cameraXHandle.rotation.w + directionToPan.y * F)))
    })
  }

  updateCameraWithCurrentGround(node) {
    if(this.gameIsComplete){
      return
    }

    if(this.currentGround === null){
      this.currentGround = node
      return
    }

    // Automatically update the position of the camera when we move to another block.
    if(node !== this.currentGround){
      this.currentGround = node

      let position = this.groundToCameraPosition.get(node)
      if(position){
        if(node === this.mainGround && this.character.node.position.x < 2.5){
          position = new SCNVector3(-0.098175, 3.926991, 0.0)
        }

        const actionY = SCNAction.rotateToXYZUsesShortestUnitArc(0, position.y, 0, 3.0, true)
        actionY.timingMode = SCNActionTimingMode.easeInEaseOut

        const actionX = SCNAction.rotateToXYZUsesShortestUnitArc(position.x, 0, 0, 3.0, true)
        actionX.timingMode = SCNActionTimingMode.easeInEaseOut

        this.cameraYHandle.runAction(actionY)
        this.cameraXHandle.runAction(actionX)
      }
    }
  }

  // MARK: Moving the Character

  characterDirection() {
    const controllerDirection = this.controllerDirection()
    let direction = new SCNVector3(controllerDirection.x, 0.0, controllerDirection.y)

    const pov = this.gameView.pointOfView
    if(pov){
      const p1 = pov.presentation.convertPositionTo(direction, null)
      const p0 = pov.presentation.convertPositionTo(SCNVector3Zero, null)
      direction = new SCNVector3(p1.x - p0.x, 0.0, p1.z - p0.z)

      if(direction.x !== 0.0 || direction.z !== 0.0){
        direction = direction.normalize()
      }
    }

    return direction
  }

  // MARK: SCNSceneRendererDelegate Conformatnce (Game Loop)

  // SceneKit calls this method exactly once per frame, so long as the SCNView object (or other SCNSceneRenderer object) displaying the scene is not paused.
  // Implement this method to add game logic to the rendering loop. Any changes you make to the scene graph during this method are immediately reflected in the displayed scene.

  groundTypeFromMaterial(material) {
    if(material === this.grassArea){
      return GroundType.grass
    }
    if(material === this.waterArea){
      return GroundType.water
    }
    else{
      return GroundType.rock
    }
  }

  rendererUpdateAtTime(renderer, time) {
    // Reset some states every frame
    this.replacementPosition = null
    this.maxPenetrationDistance = 0

    const scene = this.gameView.scene
    const direction = this.characterDirection()

    const groundNode = this.character.walkInDirection(direction, time, scene, this.groundTypeFromMaterial.bind(this))
    if(groundNode){
      this.updateCameraWithCurrentGround(groundNode)
    }

    // Flames are static physics bodies, but they are moved by an action - So we need to tell the physics engine that the transforms did change.
    for(const flame in this.flames){
      flame.physicsBody.resetTransform()
    }

    // Adjust the volume of the enemy based on the distance to the character.
    let distanceToClosestEnemy = Infinity
    const characterPosition = this.character.node.position
    for(const enemy of this.enemies){
      // distance to enemy
      const enemyTransform = enemy.worldTransform
      const enemyPosition = new SCNVector3(enemyTransform.m41, enemyTransform.m42, enemyTransform.m43)
      const distance = characterPosition.sub(enemyPosition).length()
      distanceToClosestEnemy = Math.min(distanceToClosestEnemy, distance)
    }

    // Adjust sounds volumes based on distance with the enmy.
    if(!this.gameIsComplete){
      const mixer = this.flameThrowerSound.audioNode
      if(mixer){
        mixer.volume = 0.3 * Math.max(0, Math.min(1, 1 - (distanceToClosestEnemy - 1.2) / 1.6))
      }
    }
  }

  rendererDidSimlatePhysicsAtTime(renderer, time) {
    // If we hit a wall, position needs to be adjusted
    if(this.replacementPosition){
      this.character.node.position = this.replacementPosition._copy()
    }
  }

  // MARK: SCNPhysicsContactDelegate Conformance

  // To receive contact messages, you set the contactDelegate property of an SCNPhysicsWorld object.
  // SceneKit calls your delegate methods when a contact begins, when information about the contact changes, and when the contact ends.

  physicsWorldDidBegin(world, contact) {
    contact.match(BitmaskCollision, (matching, other) => {
      this.characterNode(other, matching, contact)
    })
    contact.match(BitmaskCollectable, (matching) => {
      this.collectPearl(matching)
    })
    contact.match(BitmaskSuperCollectable, (matching) => {
      this.collectFlower(matching)
    })
    contact.match(BitmaskEnemy, () => {
      this.character.catchFire()
    })
  }

  physicsWorldDidUpdate(world, contact) {
    contact.match(BitmaskCollision, (matching, other) => {
      this.characterNode(other, matching, contact)
    })
  }

  characterNode(characterNode, wall, contact) {
    if(characterNode.parent !== this.character.node){
      return
    }

    if(this.maxPenetrationDistance > contact.penetrationDistance){
      return
    }

    this.maxPenetrationDistance = contact.penetrationDistance

    let characterPosition = this.character.node.position._copy()
    const positionOffset = contact.contactNormal.mul(contact.penetrationDistance)
    positionOffset.y = 0
    characterPosition = characterPosition.add(positionOffset)

    this.replacementPosition = characterPosition
  }

  // MARK: Scene Setup
  setupCamera() {
    const ALTITUDE = 1.0
    const DISTANCE = 10.0

    // We create 2 nodes to manipulate the camera:
    // The first node "cameraXHandle" is at the center of the world (0, ALTITUDE, 0) and will only rotate on the X axis
    // The second node "cameraYHandle" is a child of the first one and will only rotate on the Y axis
    // The camera node is a child of the "cameraYHandle" at a specific distance (DISTANCE).
    // So rotating cameraYHandle and cameraXHandle will update the camera position and the camera will always look at the center of the scene.

    const pov = this.gameView.pointOfView
    pov.eulerAngles = SCNVector3Zero
    pov.position = new SCNVector3(0.0, 0.0, DISTANCE)

    this.cameraXHandle.rotation = new SCNVector4(1.0, 0.0, 0.0 -Math.PI / 32.0)
    this.cameraXHandle.addChildNode(pov)

    this.cameraYHandle.position = new SCNVector3(0.0, ALTITUDE, 0.0)
    this.cameraYHandle.rotation = new SCNVector4(0.0, 1.0, 0.0, Math.PI * 1.25)
    this.cameraYHandle.addChildNode(this.cameraXHandle)

    this.gameView.scene.rootNode.addChildNode(this.cameraYHandle)

    // Animate camera on launch and prevent the user from manipulating the camera until the end of the animation
    SCNTransaction.animateWithDurationTimingFunctionCompletionBlockAnimations(0.25, null, () => { this.lockCamera = false }, () => {
      this.lockCamera = true

      // Create 2 additive animations that converge to 0
      // That way at the end of the animation, the camera will be at its default position
      const cameraYAnimation = new CABasicAnimation('rotation.w')
      cameraYAnimation.fromValue = Math.PI * 2.0 - this.cameraYHandle.rotation.w
      cameraYAnimation.toValue = 0.0
      cameraYAnimation.isAdditive = true
      cameraYAnimation.beginTime = CACurrentMediaTime() + 3.0 // wait a little bit before starting
      cameraYAnimation.fillMode = kCAFillModeBoth
      cameraYAnimation.duration = 5.0
      cameraYAnimation.timingFunction = CAMediaTimingFunction.functionWithName(kCAMediaTimingFunctionEaseInEaseOut)
      this.cameraYHandle.addAnimationForKey(cameraYAnimation, null)

      const cameraXAnimation = cameraYAnimation.copy()
      cameraXAnimation.fromValue = -Math.PI * 0.5 - this.cameraXHandle.rotation.w
      this.cameraXHandle.addAnimationForKey(cameraXAnimation, null)
    })
  }

  setupAutomaticCameraPositions() {
    const rootNode = this.gameView.scene.rootNode

    this.mainGround = rootNode.childNodeWithNameRecursively('bloc05_collisionMesh_02', true)

    this.groundToCameraPosition.set(rootNode.childNodeWithNameRecursively('bloc04_collisionMesh_02', true), new SCNVector3(-0.188683, 4.719608, 0.0))
    this.groundToCameraPosition.set(rootNode.childNodeWithNameRecursively('bloc03_collisionMesh', true), new SCNVector3(-0.435909, 6.297167, 0.0))
    this.groundToCameraPosition.set(rootNode.childNodeWithNameRecursively('bloc07_collisionMesh', true), new SCNVector3(-0.333663, 7.868592, 0.0))
    this.groundToCameraPosition.set(rootNode.childNodeWithNameRecursively('bloc08_collisionMesh', true), new SCNVector3(-0.575011, 8.739003, 0.0))
    this.groundToCameraPosition.set(rootNode.childNodeWithNameRecursively('bloc06_collisionMesh', true), new SCNVector3(-1.095519, 9.425292, 0.0))
    this.groundToCameraPosition.set(rootNode.childNodeWithNameRecursively('bloc05_collisionMesh_02', true), new SCNVector3(-0.072051, 8.202264, 0.0))
    this.groundToCameraPosition.set(rootNode.childNodeWithNameRecursively('bloc05_collisionMesh_01', true), new SCNVector3(-0.072051, 8.202264, 0.0))
  }

  setupCollisionNode(node) {
    const geometry = node.geometry
    if(geometry){
      // Collision meshes must use a concave shape for intersection correctness.
      node.physicsBody = SCNPhysicsBody.static()
      node.physicsBody.categoryBitMask = BitmaskCollision
      node.physicsBody.physicsShape = new SCNPhysicsShape(node, [[SCNPhysicsShape.Option.type, SCNPhysicsShape.ShapeType.concavePolyhedron]])

      // Get grass area to play the right sound steps
      if(geometry.firstMaterial.name === 'grass-area'){
        if(this.grassArea !== null){
          geometry.firstMaterial = this.grassArea
        }else{
          this.grassArea = geometry.firstMaterial
        }
      }

      // Get the water area
      if(geometry.firstMaterial.name === 'water'){
        this.waterArea = geometry.firstMaterial
      }

      // Temporary workaround because concave shape created from geometry instead of node fails
      const childNode = new SCNNode()
      node.addChildNode(childNode)
      childNode.isHidden = true
      childNode.geometry = node.geometry
      node.geometry = null
      node.isHidden = false

      if(node.name === 'water'){
        node.physicsBody.categoryBitMask = BitmaskWater
      }
    }

    for(const childNode of node.childNodes){
      if(childNode.isHidden === false){
        this.setupCollisionNode(childNode)
      }
    }
  }

  setupSounds() {
    // Get an arbitrary node to attach the sounds to.
    const node = this.gameView.scene.rootNode

    node.addAudioPlayer(new SCNAudioPlayer(SCNAudioSource.sourceWithNameVolumePositionalLoopsShouldStreamShouldLoad('music.m4a', 0.25, false, true, true)))
    node.addAudioPlayer(new SCNAudioPlayer(SCNAudioSource.sourceWithNameVolumePositionalLoopsShouldStreamShouldLoad('wind.m4a', 0.3, false, true, true)))
    this.flameThrowerSound = new SCNAudioPlayer(SCNAudioSource.sourceWithNameVolumePositionalLoopsShouldStreamShouldLoad('flamethrower.mp3', 0, false, true))
    node.addAudioPlayer(this.flameThrowerSound)

    this.collectPearlSound = SCNAudioSource.sourceWithNameVolumePositionalLoopsShouldStreamShouldLoad('collect1.mp3', 0.5)
    this.collectFlowerSound = SCNAudioSource.sourceWithNameVolumePositionalLoopsShouldStreamShouldLoad('collect2.mp3')
    this.victoryMusic = SCNAudioSource.sourceWithNameVolumePositionalLoopsShouldStreamShouldLoad('Music_victory.mp3', 0.5, false, false, false)
  }

  // MARK: Collecting Items

  removeNodeSoundToPlay(node, sound) {
    const parentNode = node.parent
    if(parentNode){
      const soundEmitter = new SCNNode()
      soundEmitter.position = node.position
      parentNode.addChildNode(soundEmitter)

      soundEmitter.runAction(SCNAction.sequence([
        SCNAction.playAudioWaitForCompletion(sound, true),
        SCNAction.removeFromParentNode()]))

      node.removeFromParentNode()
    }
  }

  get collectedPearlsCount() {
    return this._collectedPearlsCount
  }
  set collectedPearlsCount(newValue) {
    this._collectedPearlsCount = newValue
    this.gameView.collectedPearlsCount = newValue
  }

  collectPearl(pearlNode) {
    if(pearlNode.parent !== null){
      this.removeNodeSoundToPlay(pearlNode, this.collectPearlSound)
      this.collectedPearlsCount += 1
    }
  }

  get collectedFlowersCount() {
    return this._collectedFlowersCount
  }
  set collectedFlowersCount(newValue) {
    this._collectedFlowersCount = newValue
    this.gameView.collectedFlowersCount = newValue
    if(this._collectedFlowersCount === 3){
      this.showEndScreen()
    }
  }

  collectFlower(flowerNode) {
    if(flowerNode.parent !== null){
      // Emit particles.
      let particleSystemPosition = flowerNode.worldTransform._copy()
      particleSystemPosition.m42 += 0.1
      this.gameView.scene.addParticleSystem(this.collectFlowerParticleSystem, particleSystemPosition)

      // Remove the flower from the scene.
      this.removeNodeSoundToPlay(flowerNode, this.collectFlowerSound)
      this.collectedFlowersCount += 1
    }
  }

  // MARK: Congratulating the Player

  showEndScreen() {
    this.gameIsComplete = true

    // Add confettis
    const particleSystemPosition = SCNMatrix4MakeTranslation(0.0, 8.0, 0.0)
    this.gameView.scene.addParticleSystem(this.confettiParticleSystem, particleSystemPosition)

    // Stop the music.
    this.gameView.scene.rootNode.removeAllAudioPlayers()

    // Play the congrat sound.
    this.gameView.scene.rootNode.addAudioPlayer(new SCNAudioPlayer(this.victoryMusic))

    // Animate the camera forever
    DispatchQueue.main.asyncAfter(new Date() + 1000, () => {
      this.cameraYHandle.runAction(SCNAction.repeatForever(SCNAction.rotateByXYZ(0, -1, 0, 3)))
      //const act = SCNAction.repeatForever(SCNAction.rotateByXYZ(0, -1, 0, 3))
      //window.cameraYHandleAction = act
      //window.cameraYHandle = this.cameraYHandle
      //this.cameraYHandle.runAction(act)

      this.cameraXHandle.runAction(SCNAction.rotateToXYZ(-Math.PI / 4, 0, 0, 5.0))
    })

    this.gameView.showEndScreen()
  }

  // MARK: Controller orientation

  static get controllerAcceleration() {
    return 0.1
  }

  static get controllerDirectionLimit() {
    return new CGSize(1.0, 1.0)
  }

  controllerDirection() {
    // Poll when using a game controller
    const dpad = this.controllerDPad
    if(dpad){
      if(dpad.xAxis.value === 0.0 && dpad.yAxis.value === 0.0){
        this.controllerStoredDirection = [0.0, 0.0]
      }else{
        //this.controllerStoredDirection = clamp(this.controllerStoredDirection + float2(dpad.xAxis.value, -dpad.yAxis.value) * GameViewController.controllerAcceleration, -GameViewController.controllerDirectionLimit, GameViewController.controllerDirectionLimit)
      }
    }

    return this.controllerStoredDirection
  }

  // MARK: Game Controller Events

  setupGameControllers() {
    this.gameView.eventsDelegate = this

    NotificationCenter.default.addObserverSelectorNameObject(this, this.handleControllerDidConnectNotification, NSNotification.Name.GCControllerDidConnect, null)
  }

  handleControllerDidConnectNotification(notification) {
    const gameController = notification.object
    this.registerCharacterMovementEvents(gameController)
    console.error('handleControllerDidConnectNotification: ' + gameController)
  }

  registerCharacterMovementEvents(gameController) {

    // An analog movement handler for D-pads and thumbsticks.
    const movementHandler = (dpad) => {
      this.controllerDPad = dpad
    }

    // Gamepad D-pad
    const gamepad = gameController.gamepad
    if(gamepad){
      gamepad.dpad.valueChangedHandler = movementHandler
    }

    // Extended gamepad left thumbstick
    const extendedGamepad = gameController.extendedGamepad
    if(extendedGamepad){
      extendedGamepad.leftThumbstick.valueChangedHandler = movementHandler
    }
  }

  // MARK: Touch Events

  ////

  // MARK: Mouse and Keyboard Events

  mouseDownInViewWithEvent(view, event) {
    // Remember last mouse position for dragging.
    this.lastMousePosition = view.convertFrom(event.locationInWindow, null)

    return true
  }

  mouseDraggedInViewWithEvent(view, event) {
    const mousePosition = view.convertFrom(event.locationInWindow, null)
    this.panCamera(mousePosition.sub(this.lastMousePosition))
    this.lastMousePosition = mousePosition

    return true
  }

  mouseUpInViewWithEvent(view, event) {
    const direction = KeyboardDirection[event.keyCode]
    if(direction){
      if(!event.isARepeat){
        this.controllerStoredDirection = this.controllerStoredDirection.add(direction.vector)
      }
      return true
    }

    return false
  }

  keyDownInViewWithEvent(view, event) {
    const direction = KeyboardDirection[event.keyCode]
    if(direction){
      if(!event.isARepeat){
        this.controllerStoredDirection = this.controllerStoredDirection.add(direction.vector)
      }
      return true
    }

    return false
  }

  keyUpInViewWithEvent(view, event) {
    const direction = KeyboardDirection[event.keyCode]
    if(direction){
      if(!event.isARepeat){
        this.controllerStoredDirection = this.controllerStoredDirection.sub(direction.vector)
      }
      return true
    }

    return false
  }
}

