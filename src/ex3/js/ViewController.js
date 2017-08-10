'use strict'

import {
  CAAnimation,
  CABasicAnimation,
  CGPoint,
  CGSize,
  SCNAction,
  SCNAnimationEvent,
  SCNAntialiasingMode,
  SCNAudioPlayer,
  SCNAudioSource,
  SCNNode,
  SCNParticleSystem,
  SCNScene,
  SCNTransaction,
  SCNVector3,
  SCNVector3Zero
} from 'jscenekit'
import View from './View'

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

// MARK: Types

class Assets {
  static get basePath() {
    return 'badger.scnassets/'
  }
  static get soundsPath() {
    return this.basePath + 'sounds/'
  }

  static soundNamed(name) {
    const source = new SCNAudioSource(this.soundsPath + name)
    if(!source){
      throw new Error('failed to load the sound file: ' + name)
    }
    return source
  }

  static animationNamed(name) {
    return CAAnimation.animationWithSceneName(this.basePath + name)
  }

  static sceneNamed(name) {
    const scene = SCNScene.sceneNamed(this.basePath + name)
    if(!scene){
      throw new Error('failed to load the scene file: ' + name)
    }
    return scene
  }
}

class Trigger {
  constructor(position, action) {
    this.position = position
    this.action = action
  }
}

const CollectableState = {
  notCollected: 0,
  beingCollected: 2
}

const GameState = {
  notStarted: 0,
  started: 1
}

export default class ViewController {
  get Assets() {
    return Assets
  }

  constructor() {
    // super()

    this.sceneView = new View()
    this.view = this.sceneView

    this._boostSpeedFactor = 1.0
    this._characterSpeed = 1.0

    // MARK: Configuration Properties

    /// Determines if the level uses local sun.
    this.isUsingLocalSun = true
    //this.isUsingLocalSun = false // DEBUG

    /// Determines if audio should be enabled.
    this.isSoundEnabled = true

    this.speedFactor = 1.5

    // MARK: Scene Properties

    // MARK: Animation Properties

    this.character = null
    this.idleAnimationOwner = null
    this.cartAnimationName = null

    /**
       These animations will be played when the user perform an action
       and will temporarily disable the "idle" animation.
    */

    //this.jumpAnimation      = this.Assets.animationNamed('animation-jump.scn')
    //this.squatAnimation     = this.Assets.animationNamed('animation-squat.scn')
    //this.leanLeftAnimation  = this.Assets.animationNamed('animation-lean-left.scn')
    //this.leanRightAnimation = this.Assets.animationNamed('animation-lean-right.scn')
    //this.slapAnimation      = this.Assets.animationNamed('animation-slap.scn')

    this.leftHand = null
    this.rightHand = null

    this.sunTargetRelativeToCamera = null
    this.sunDirection = null
    this.sun = null

    // Sparkles effect
    this.sparkles = null
    this.stars = null
    this.leftWheelEmitter = null
    this.rightWheelEmitter = null
    this.headEmitter = null
    this.wheels = null

    // Collect particles
    this.collectParticleSystem = null
    this.collectBigParticleSystem = null

    // State
    this.squatCounter = 0
    this.isOverWood = false

    // MARK: Sound Properties

    this.railSoundSpeed = 0

    this.hitSound              = this.Assets.soundNamed('hit.mp3')
    this.railHighSpeedSound    = this.Assets.soundNamed('rail_highspeed_loop.mp3')
    this.railMediumSpeedSound = this.Assets.soundNamed('rail_normalspeed_loop.mp3')
    this.railLowSpeedSound     = this.Assets.soundNamed('rail_slowspeed_loop.mp3')
    this.railWoodSound         = this.Assets.soundNamed('rail_wood_loop.mp3')
    this.railSqueakSound       = this.Assets.soundNamed('cart_turn_squeak.mp3')
    this.cartHide              = this.Assets.soundNamed('cart_hide.mp3')
    this.cartJump              = this.Assets.soundNamed('cart_jump.mp3')
    this.cartTurnLeft          = this.Assets.soundNamed('cart_turn_left.mp3')
    this.cartTurnRight         = this.Assets.soundNamed('cart_turn_right.mp3')
    this.cartBoost             = this.Assets.soundNamed('cart_boost.mp3')

    // MARK: Collectable Properties

    this.collectables = null
    this.speedItems = null
    this.collectSound = this.Assets.soundNamed('collect1.mp3')
    this.collectSound2 = this.Assets.soundNamed('collect2.mp3')

    // MARK: Triggers

    /// Triggers are configured in `configureScene()`
    this.triggers = []
    this.activeTriggerIndex = -1

    // MARK: Game controls

    this.controllerDPad = null

    /// Game state
    this.gameState = GameState.notStarted

    this.loadScenes().then(() => {

      //this.scene = this.Assets.sceneNamed('scene.scn')
      
      // Retrieve the character and its animations.

      // The character node "Bob_root" initially is a placeholder.
      // We will load the models from one of the animation scenes and add them to the empty node.
      this.character = this.scene.rootNode.childNodeWithNameRecursively('Bob_root', true)

      //const idleScene = this.Assets.sceneNamed('animation-idle.scn')
      //const characterHierarchy = idleScene.rootNode.childNodeWithNameRecursively('Bob_root', true)
      const characterHierarchy = this.idleScene.rootNode.childNodeWithNameRecursively('Bob_root', true)

      for(const node of characterHierarchy.childNodes){
        this.character.addChildNode(node)
      }

      this.idleAnimationOwner = this.character.childNodeWithNameRecursively('Dummy_kart_root', true)

      // The animation for the cart is always running. The name of the animation is retrieved
      // so that we can change its speed as the cart accelerates or decelerates.
      this.cartAnimationName = this.scene.rootNode.animationKeys[0]

      // Play character idle animation.
      //const idleAnimation = this.Assets.animationNamed('animation-start-idle.scn')
      //idleAnimation.repeatCount = Infinity
      //this.character.addAnimationForKey(idleAnimation, 'start')
      this.idleAnimation.repeatCount = Infinity
      this.character.addAnimationForKey(this.idleAnimation, 'start')

      // Load sparkles.
      //const sparkleScene = this.Assets.sceneNamed('sparkles.scn')
      //const sparkleNode = sparkleScene.rootNode.childNodeWithNameRecursively('sparkles', true)
      const sparkleNode = this.sparkleScene.rootNode.childNodeWithNameRecursively('sparkles', true)
      this.sparkles = sparkleNode.particleSystems[0]
      this.sparkles.loop = false

      //const starsNode = sparkleScene.rootNode.childNodeWithNameRecursively('slap', true)
      const starsNode = this.sparkleScene.rootNode.childNodeWithNameRecursively('slap', true)
      this.stars = starsNode.particleSystems[0]
      this.stars.loops = false

      // Collect particles.
      //this.collectParticleSystem = SCNParticleSystem.systemNamedInDirectory('collect.scnp', 'badger.scnassets')
      this.collectParticleSystem.loops = false

      //this.collectBigParticleSystem = SCNParticleSystem.systemNamedInDirectory('collect-big.scnp', 'badger.scnassets')
      this.collectBigParticleSystem.loops = false

      this.leftHand = this.character.childNodeWithNameRecursively('Bip001_L_Finger0Nub', true)
      this.rightHand = this.character.childNodeWithNameRecursively('Bip001_R_Finger0Nub', true)

      this.leftWheelEmitter = this.character.childNodeWithNameRecursively('Dummy_rightWheel_sparks', true)
      this.rightWheelEmitter = this.character.childNodeWithNameRecursively('Dummy_leftWheel_sparks', true)
      this.wheels = this.character.childNodeWithNameRecursively('wheels_front', true)

      this.headEmitter = new SCNNode()
      this.headEmitter.position = new SCNVector3(0, 1, 0)
      this.character.addChildNode(this.headEmitter)

      const wheelAnimation = new CABasicAnimation('eulerAngles.x')
      wheelAnimation.byValue = 10.0
      wheelAnimation.duration = 1.0
      wheelAnimation.repeatCount = Infinity
      wheelAnimation.isCumulative = true
      this.wheels.addAnimationForKey(wheelAnimation, 'wheel')

      // Make sure the slap animation plays right away (no fading)
      this.slapAnimation.fadeInDuration = 0.0

      /// Similarly collectables are grouped under a common parent node.
      /// In addition, load a sound file that will be played when the user collects an item.
      this.collectables = this.scene.rootNode.childNodeWithNameRecursively('Collectables', false)
      this.speedItems = this.scene.rootNode.childNodeWithNameRecursively('SpeedItems', false)

      // Load sounds.
      this.collectSound.volume = 5.0
      this.collectSound2.volume = 5.0

      // Configure sounds.
      const sounds = [
        this.railSqueakSound, this.collectSound, this.collectSound2,
        this.hitSound, this.railHighSpeedSound, this.railMediumSpeedSound,
        this.railLowSpeedSound, this.railWoodSound, this.railSqueakSound,
        this.cartHide, this.cartJump, this.cartTurnLeft,
        this.cartTurnRight
      ]

      for(const sound of sounds){
        sound.isPositional = false
        sound.load()
      }

      this.railSqueakSound.loops = true

      // Configure the scene to use a local sun.
      if(this.isUsingLocalSun){
        this.sun = this.scene.rootNode.childNodeWithNameRecursively('Direct001', false)
        this.sun.light.shadowMapSize = new CGSize(2048, 2048)
        this.sun.light.orthographicScale = 10

        this.sunTargetRelativeToCamera = new SCNVector3(0, 0, -10)
        this.sun.position = SCNVector3Zero
        this.sunDirection = this.sun.convertPositionTo(new SCNVector3(0, 0, -1), null)
      }else{
        this.sun = new SCNNode()
        this.sunTargetRelativeToCamera = SCNVector3Zero
        this.sunDirection = SCNVector3Zero
      }
    })
  }

  configureScene() {
    // Add sparkles.
    const leftEvent1 = new SCNAnimationEvent(0.15, () => {
      this.leftWheelEmitter.addParticleSystem(this.sparkles)
    })
    const leftEvent2 = new SCNAnimationEvent(0.9, () => {
      this.rightWheelEmitter.addParticleSystem(this.sparkles)
    })
    const rightEvent1 = new SCNAnimationEvent(0.9, () => {
      this.leftWheelEmitter.addParticleSystem(this.sparkles)
    })
    this.leanLeftAnimation.animationEvents = [leftEvent1, leftEvent2]
    this.leanRightAnimation.animationEvents = [rightEvent1]

    this.sceneView.antialiasingMode = SCNAntialiasingMode.none

    // Configure triggers and collectables

    /// Special nodes ("triggers") are placed in the scene under a common parent node.
    /// Their names indicate what event should occur as they are hit by the cart.
    const triggerGroup = this.scene.rootNode.childNodeWithNameRecursively('triggers', false)

    this.triggers = triggerGroup.childNodes.map((node) => {
      const triggerName = node.name
      const triggerPosition = node.position

      if(triggerName.startsWith('Trigger_speed')){
        const speedValueOffset = 'Trigger_speedX_'.length
        let speedValue = triggerName.substring(speedValueOffset)
        speedValue = speedValue.replace(/_/g, '.')

        const speed = parseFloat(speedValue)
        if(isNaN(speed)){
          console.log(`Failed to parse speed value ${speedValue}.`)
          return null
        }

        return new Trigger(triggerPosition, (controller) => {
          controller.trigger(speed)
        })
      }

      if(triggerName.startsWith('Trigger_obstacle')){
        return new Trigger(triggerPosition, (controller) => {
          controller.triggerCollision()
        })
      }

      if(triggerName.startsWith('Trigger_reverb') && triggerName.endsWith('start')){
        return new Trigger(triggerPosition, (controller) => {
          controller.startReverb()
        })
      }

      if(triggerName.startsWith('Trigger_reverb') && triggerName.endsWith('stop')){
        return new Trigger(triggerPosition, (controller) => {
          controller.stopReverb()
        })
      }

      if(triggerName.startsWith('Trigger_turn_start')){
        return new Trigger(triggerPosition, (controller) => {
          controller.startTurn()
        })
      }

      if(triggerName.startsWith('Trigger_turn_stop')){
        return new Trigger(triggerPosition, (controller) => {
          controller.stopTurn()
        })
      }

      if(triggerName.startsWith('Trigger_wood_start')){
        return new Trigger(triggerPosition, (controller) => {
          controller.startWood()
        })
      }

      if(triggerName.startsWith('Trigger_wood_stop')){
        return new Trigger(triggerPosition, (controller) => {
          controller.stopWood()
        })
      }

      if(triggerName.startsWith('Trigger_highSpeed')){
        return new Trigger(triggerPosition, (controller) => {
          controller.changeSpeedSound(3)
        })
      }

      if(triggerName.startsWith('Trigger_normalSpeed')){
        return new Trigger(triggerPosition, (controller) => {
          controller.changeSpeedSound(2)
        })
      }

      if(triggerName.startsWith('Trigger_slowSpeed')){
        return new Trigger(triggerPosition, (controller) => {
          controller.changeSpeedSound(1)
        })
      }

      return null
    }).filter((trigger) => trigger !== null)
  }

  loadScenes() {
    this.scene = this.Assets.sceneNamed('scene.scn')
    this.idleScene = this.Assets.sceneNamed('animation-idle.scn')
    this.sparkleScene = this.Assets.sceneNamed('sparkles.scn')
    
    this.loaded = Promise.all([
      this.scene.didLoad,
      this.idleScene.didLoad,
      this.sparkleScene.didLoad,
      SCNParticleSystem.systemNamedInDirectory('collect.scnp', 'badger.scnassets')
        .then((sys) => {this.collectParticleSystem = sys}),
      SCNParticleSystem.systemNamedInDirectory('collect-big.scnp', 'badger.scnassets')
        .then((sys) => {this.collectBigParticleSystem = sys}),
      this.Assets.animationNamed('animation-jump.scn').then((anim) => {this.jumpAnimation = anim}),
      this.Assets.animationNamed('animation-squat.scn').then((anim) => {this.squatAnimation = anim}),
      this.Assets.animationNamed('animation-lean-left.scn').then((anim) => {this.leanLeftAnimation = anim}),
      this.Assets.animationNamed('animation-lean-right.scn').then((anim) => {this.leanRightAnimation = anim}),
      this.Assets.animationNamed('animation-slap.scn').then((anim) => {this.slapAnimation = anim}),
      this.Assets.animationNamed('animation-start-idle.scn').then((anim) => {this.idleAnimation = anim}),
      this.Assets.animationNamed('animation-start.scn').then((anim) => {this.startAnimation = anim})
    ])
    return this.loaded
  }

  // MARK: UIViewController

  viewDidLoad() {
    // super.viewDidLoad()

    this.sceneView.isPlaying = true
    this.sceneView.loops = true
    this._ready = false

    this.loaded.then(() => {
      // Configure scene post init.
      this.configureScene()

      /// Set the scene and make sure all shaders and textures are pre-loaded.
      this.sceneView.scene = this.scene

      // At every round regenerate collecatables.
      const cartAnimation = this.scene.rootNode.animationForKey(this.cartAnimationName)
      cartAnimation.animationEvents = [new SCNAnimationEvent(0.9, () => {
        this.respawnCollectables()
      })]
      this.scene.rootNode.addAnimationForKey(cartAnimation, this.cartAnimationName)

      this.sceneView.prepare(this.scene, null)
      this.sceneView.delegate = this
      this.sceneView.pointOfView = this.sceneView.scene.rootNode.childNodeWithNameRecursively('camera_depart', true)

      // Play wind sound at launch.
      const sound = this.Assets.soundNamed('wind.m4a')
      sound.loops = true
      sound.isPositional = false
      sound.shouldStream = true
      sound.volume = 8.0
      this.sceneView.scene.rootNode.addAudioPlayer(new SCNAudioPlayer(sound))

      this.sceneView.contentScaleFactor = 1.0

      // Start at speed 0.
      this.characterSpeed = 0.0

      this.setupGameControllers()

      this._ready = true
      //this.sceneView.scene = new SCNScene() // DEBUG
      //const character = this.idleScene.rootNode.childNodeWithNameRecursively('Bob_root', true) // DEBUG
      //this.sceneView.scene.rootNode.addChildNode(this.character) // DEBUG
    })
  }

  // MARK: Render loop

  /// At each frame, verify if an event should occur
  rendererUpdateAtTime(renderer, time) {
    if(!this._ready || !this.character.presentation){
      return
    }
    this.activateTriggers()
    this.collectItems()

    // Update sun position
    if(this.isUsingLocalSun){
      const target = renderer.pointOfView.presentation.convertPositionTo(this.sunTargetRelativeToCamera, null)
      this.sun.position = target.sub(this.sunDirection.mul(10.0))
    }
  }

  // MARK: Sound effects

  startReverb() {
  }

  stopReverb() {
  }

  startTurn() {
    if(!this.isSoundEnabled){
      return
    }

    const player = new SCNAudioPlayer(this.railSqueakSound)
    this.leftWheelEmitter.addAudioPlayer(player)
  }

  stopTurn() {
    if(!this.isSoundEnabled){
      return
    }

    this.leftWheelEmitter.removeAllAudioPlayers()
  }

  startWood() {
    this.isOverWood = true
    this.updateCartSound()
  }

  stopWood() {
    this.isOverWood = false
    this.updateCartSound()
  }

  trigger(speed) {
    SCNTransaction.begin()
    SCNTransaction.animationDuration = 2.0
    this.characterSpeed = speed
    SCNTransaction.commit()
  }

  triggerCollision() {
    if(this.squatCounter > 0){
      return
    }

    // Play sound and animate
    this.character.runAction(SCNAction.playAudioWaitForCopletion(this.hitSound, false))
    this.character.addAnimationForKey(this.slapAnimation, null)

    // Add stars.
    const emitter = this.character.childNodeWithNameRecursively('Bip001_Head', true)
    emitter.addParticleSystem(this.stars)
  }

  activateTriggers() {
    const characterPosition = this.character.presentation.convertPositionTo(SCNVector3Zero, null)

    let index = 0
    let didTrigger = false

    for(const trigger of this.triggers){
      if(characterPosition.sub(trigger.position).length() < 0.05){
        if(this.activeTriggerIndex != index){
          this.activeTriggerIndex = index
          trigger.action(this)
        }
        didTrigger = true
        break
      }

      index = index + 1
    }

    if(didTrigger === false){
      this.activeTriggerIndex = -1
    }
  }

  // MARK: Collectables

  respawnCollectables() {
    for(const collectable of this.collectables.childNodes){
      collectable.categoryBitMask = 0
      collectable.scale = new SCNVector3(1, 1, 1)
    }

    for(const collectable of this.speedItems.childNodes){
      collectable.categoryBitMask = 0
      collectable.scale = new SCNVector3(1, 1, 1)
    }
  }

  collectItems() {
    const leftHandPosition = this.leftHand.presentation.convertPositionTo(SCNVector3Zero, null)
    const rightHandPosition = this.rightHand.presentation.convertPositionTo(SCNVector3Zero, null)

    for(const collectable of this.collectables.childNodes){
      if(collectable.categoryBitMask === CollectableState.beingCollected){
        continue
      }

      const collectablePosition = collectable.position
      if(leftHandPosition.sub(collectablePosition).length() < 0.05 || rightHandPosition.sub(collectablePosition).length() < 0.05){
        collectable.caregoryBitMask = CollectableState.beingCollected

        SCNTransaction.begin()
        SCNTransaction.animationDuration = 0.25

        collectable.scale = SCNVector3Zero

        this.scene.addParticleSystem(this.collectParticleSystem, collectable.presentation.worldTransform)

        if(collectable.name.startsWith('big')){
          this.headEmitter.addParticleSystem(this.collectBigParticleSystem)

          this.sceneView.didCollectBigItem()
          collectable.runAction(SCNAction.playAudioWaitForCompletion(this.collectSound2, false))
        }else{
          this.sceneView.didCollectItem()
          collectable.runAction(SCNAction.playAudioWaitForCompletion(this.collectSound, false))
        }

        SCNTransaction.commit()

        break
      }
    }

    for(const collectable of this.speedItems.childNodes){
      if(collectable.categoryBitMask === CollectableState.beingCollected){
        continue
      }

      const collectablePosition = collectable.position
      if(rightHandPosition.sub(collectablePosition).length() < 0.05){
        collectable.categoryBitMask = CollectableState.beingCollected

        SCNTransaction.begin()
        SCNTransaction.animationDuration = 0.25

        collectable.scale = SCNVector3Zero
        collectable.runAction(SCNAction.playAudioWaitForCompletion(this.collectSound2, false))

        this.scene.addParticleSystem(this.collectParticleSystem, collectable.presentation.worldTransform)

        SCNTransaction.commit()

        // Speed boost!
        SCNTransaction.begin()
        SCNTransaction.animationDuration = 1.0

        const pov = this.sceneView.pointOfView
        pov.camera.xFov = 100.0

        pov.camera.motionBlurIntensity = 1.0

        const adjustCamera = SCNAction.run(() => {
          SCNTransaction.begin()
          SCNTransaction.animationDuration = 1.0

          pov.camera.xFov = 70
          pov.camera.motionBlurIntensity = 0.0

          SCNTransaction.commit()
        })

        pov.runAction(SCNAction.sequence([SCNAction.wait(2.0), adjustCamera]))
        this.character.runAction(SCNAction.playAudioWaitForCompletion(this.cartBoost, false))

        SCNTransaction.commit()

        break
      }
    }
  }

  // MARK: Controlling the Character

  changeSpeedSound(speed) {
    this.railSoundSpeed = speed
    this.updateCartSound()
  }

  updateCartSound() {
    if(!this.isSoundEnabled){
      return
    }
    this.wheels.removeAllAudioPlayers()

    if(this.isOverWood){
      this.wheels.addAudioPlayer(new SCNAudioPlayer(this.railWoodSound))
    }else if(this.railSoundSpeed === 1){
      this.wheels.addAudioPlayer(new SCNAudioPlayer(this.railLowSound))
    }else if(this.railSoundSpeed === 3){
      this.wheels.addAudioPlayer(new SCNAudioPlayer(this.railHighSound))
    }else if(this.railSoundSpeed > 0){
      this.wheels.addAudioPlayer(new SCNAudioPlayer(this.railMediumSound))
    }
  }

  updateSpeed() {
    const speed = this.boostSpeedFactor * this.characterSpeed
    const effectiveSpeed = this.speedFactor * speed
    this.scene.rootNode.setAnimationSpeedForKey(effectiveSpeed, this.cartAnimationName)
    this.wheels.setAnimationSpeedForKey(effectiveSpeed, 'wheel')
    this.idleAnimationOwner.setAnimationSpeedForKey(effectiveSpeed, 'bob_idle-1')

    // Update sound.
    this.updateCartSound()
  }

  get boostSpeedFactor() {
    return this._boostSpeedFactor
  }
  set boostSpeedFactor(newValue) {
    this._boostSpeedFactor = newValue
    this.updateSpeed()
  }

  get characterSpeed() {
    return this._characterSpeed
  }
  set characterSpeed(newValue) {
    this._characterSpeed = newValue
    this.updateSpeed()
  }

  squat() {
    console.error('squat()')
    SCNTransaction.begin()
    SCNTransaction.completionBlock = () => {
      this.squatCounter -= 1
    }
    this.squatCounter += 1

    this.character.addAnimationForKey(this.squatAnimation, null)
    this.character.runAction(SCNAction.playAudioWaitForCompletion(this.cartHide, false))

    SCNTransaction.commit()
  }

  jump() {
    console.error('jump()')
    this.character.addAnimationForKey(this.jumpAnimation, null)
    this.character.runAction(SCNAction.playAudioWaitForCompletion(this.cartJump, false))
  }

  leanLeft() {
    console.error('leanLeft()')
    this.character.addAnimationForKey(this.leanLeftAnimation, null)
    this.character.runAction(SCNAction.playAudioWaitForCompletion(this.cartTurnLeft, false))
  }

  leanRight() {
    console.error('leanRight()')
    this.character.addAnimationForKey(this.leanRightAnimation, null)
    this.character.runAction(SCNAction.playAudioWaitForCompletion(this.cartTurnRight, false))
  }

  startMusic() {
    if(!this.isSoundEnabled){
      return
    }

    const musicIntroSource = this.Assets.soundNamed('music_intro.mp3')
    const musicLoopSource = this.Assets.soundNamed('music_loop.mp3')
    musicLoopSource.loops = true
    musicIntroSource.isPositional = false
    musicLoopSource.isPositional = false

    // `shouldStream` must be false to wait for completion.
    musicIntroSource.shouldStream = false
    musicLoopSource.shouldStream = true

    this.sceneView.scene.rootNode.runActionCompletionHandler(SCNAction.playAudioWaitForCompletion(musicIntroSource, true), () => {
      this.sceneView.scene.rootNode.addAudioPlayer(new SCNAudioPlayer(musicLoopSource))
    })
  }

  startGameIfNeeded() {
    if(this.gameState !== GameState.notStarted){
      return false
    }
    console.error('start game')
    this.sceneView.setup2DOverlay()

    // Stop wind.
    this.sceneView.scene.rootNode.removeAllAudioPlayers()

    // Play some music.
    this.startMusic()

    this.gameState = GameState.started

    SCNTransaction.begin()
    SCNTransaction.animationDuration = 2.0
    SCNTransaction.completionBlock = () => {
      this.jump()
    }

    //const idleAnimation = this.Assets.animationNamed('animation-start.scn')
    //this.character.addAnimationForKey(idleAnimation, null)
    this.character.addAnimationForKey(this.startAnimation, null)
    this.character.removeAnimationForKeyFadeOutDuration('start', 0.3)

    this.sceneView.pointOfView = this.sceneView.scene.rootNode.childNodeWithNameRecursively('Camera', true)

    SCNTransaction.commit()

    SCNTransaction.begin()
    SCNTransaction.animationDuration = 5.0

    this.characterSpeed = 1.0
    this.railSoundSpeed = 1

    SCNTransaction.commit()

    return true
  }

  // MARK: Game Controller Events

  setupGameControllers() {
    this.sceneView.eventsDelegate = this

    // Gesture recognizers
  }

  handleControllerDidConnectNotification(notification) {
    const gameController = notification.object
    this.registerCharacterMovementEvents(gameController)
  }

  registerCharacterMovementEvents(gameController) {
    // An analog movement handler for D-pads and thumbsticks.
    const movementHandler = (dpad) => { this.controllerDpad = dpad }

    // Gamepad D-pad
    if(gameController.gamepad){
      gameController.gamepad.dpad.valueChangedHandler = movementHandler
    }

    // Extended gamepad left thumbstick
    if(gameController.extendedGamepad){
      gameController.extendedGamepad.leftThumbstick.valueChangedHandler = movementHandler
    }
  }

  // MARK: Touch Events
  didSwipe(sender) {
    if(this.startGameIfNeeded()){
      return
    }

    //switch(sender.direction){
    //  case UISwipeGestureRecognizerDirection.up: this.jump(); break;
    //  case UISwipeGestureRecognizerDirection.down: this.squat(); break;
    //  case UISwipeGestureRecognizerDirection.left: this.leanLeft(); break;
    //  case UISwipeGestureRecognizerDirection.right: this.leanRight(); break;
    //  default: break
    //}
  }

  // MARK: Keyboard Events
  keyDownInViewWithEvent(view, event) {
    if(event.isARepeat){
      return true
    }

    if(this.startGameIfNeeded()){
      return true
    }

    const direction = KeyboardDirection[event.keyCode]
    if(direction){
      switch(direction.rawValue){
        case KeyboardDirection.up: this.jump(); break
        case KeyboardDirection.down: this.squat(); break
        case KeyboardDirection.left: this.leanLeft(); break
        case KeyboardDirection.right: this.leanRight(); break
      }
      return true
    }
    return false
  }

  keyUpInViewWithEvent(view, event) {
    const direction = KeyboardDirection[event.keyCode]
    return direction !== null ? true : false
  }
}  

