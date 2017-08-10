'use strict'

import {
  CABasicAnimation,
  CAMediaTimingFunction,
  CGPoint,
  CGSize,
  DispatchQueue,
  DispatchTime,
  GCController,
  GKEntity,
  GKScene,
  GKSCNNodeComponent,
  NotificationCenter,
  NSNotification,
  NSObject,
  SCNAccelerationConstraint,
  SCNAction,
  SCNActionTimingMode,
  SCNAudioPlayer,
  SCNAudioSource,
  SCNCamera,
  SCNDistanceConstraint,
  SCNLookAtConstraint,
  SCNMatrix4Invert,
  SCNMatrix4MakeTranslation,
  SCNMatrix4Mult,
  SCNNode,
  SCNParticleSystem,
  SCNScene,
  SCNShaderModifierEntryPoint,
  SCNTransaction,
  SCNTransformConstraint,
  SCNVector3,
  SCNVector4,
  SKColor,

  kCAMediaTimingFunctionEaseInEaseOut
} from 'jscenekit'
import Character, {Bitmask} from './Character'
import PlayerComponent from './PlayerComponent'
import ChaserComponent from './ChaserComponent'
import ScaredComponent from './ScaredComponent'
import Overlay from './Overlay'

const ParticleKind = {
  collect: 0,
  collectBig: 1,
  keyApparition: 2,
  enemyExplosion: 3,
  unlockDoor: 4,
  totalCount: 5
}

const AudioSourceKind = {
  collect: 0,
  collectBig: 1,
  unlockDoor: 2,
  hitEnemy: 3,
  totalCount: 4
}
export default class GameController extends NSObject {

// Global settings
  static get DefaultCameraTransitionDuration() {
    return 1.0
  }
  static get NumberOfFields() {
    return 100
  }
  static get CameraOrientationSensitivity() {
    return 0.05
  }

  // MARK: - Init
  constructor(scnView) {
    super()

    this._cameraDirection = new CGPoint(0, 0)

    this.scene = null
    this.sceneRenderer = null

    // Overlays
    this.overlay = null

    // Character
    this.character = null

    // Camera and targets
    this.cameraNode = new SCNNode()
    this.lookAtTarget = new SCNNode()
    this.lastActiveCamera = new SCNNode()
    this.lastActiveCameraFrontDirection = SCNVector3.zero
    this.activeCamera = null
    this.playingCinematic = false

    //triggers
    this.lastTrigger = null
    this.firstTriggerDone = false

    //enemies
    this.enemy1 = null
    this.enemy2 = null

    //friends
    this.friends = []
    for(let i=0; i<GameController.NumberOfFriends; i++){
      this.friends.push(new SCNNode())
    }
    this.friendsSpeed = []
    for(let i=0; i<GameController.NumberOfFriends; i++){
      this.friendsSpeed(0.0)
    }
    this.friendCount = 0
    this.friendsAreFree = false

    //collected objects
    this.collectedKeys = 0
    this.collectedGems = 0
    this.keyIsVisible = false

    // particles
    this.particleSystems = []
    for(let i=0; i<ParticleKind.totalCount; i++){
      this.particleSystems.push([new SCNParticleSystem()])
    }

    // audio
    this.audioSources = []
    for(let i=0; i<AudioSourceKind.totalCount; i++){
      this.audioSources.push(new SCNAudioSource())
    }

    // GameplayKit
    this.gkScene = null

    // Game controller
    this.gamePadCurrent = null
    this.gamePadLeft = null
    this.gamePadRight = null

    // update delta time
    this.lastUpdateTime = 0


    this.sceneRenderer = scnView
    //this.sceneRenderer.delegate = this

    // Uncomment to show statistics such as fps and timing information
    //scnView.showsStatistics = true

    // setup overlay
    this.overlay = new Overlay(scnView.bounds.size, this)
    scnView.overlaySKScene = this.overlay

    //load the main scene
    this.scene = SCNScene.sceneNamed('Art.scnassets/scene.scn')
    this.scene.didLoad.then(() => {

      //setup physics
      this.setupPhysics()

      //setup collisions
      return this.setupCollisions()

    }).then(() => {

      //load the character
      return this.setupCharacter()

    }).then(() => {

      //setup enemies
      this.setupEnemies()

      //setup friends
      return this.addFriends(3)

    }).then(() => {

      //setup platforms
      this.setupPlatforms()

      //setup particles
      return this.setupParticleSystem()

    }).then(() => {

      //setup lighting
      const light = this.scene.rootNode.childNodeWithNameRecursively('DirectLight', true).light
      light.shadowCascadeCount = 3 // turn on cascade shadows
      light.shadowMapSize = new CGSize(512, 512)
      light.maximumShadowDistance = 20
      light.shadowCascadeSplittingFactor = 0.5

      //setup camera
      this.setupCamera()

      //setup game controller
      this.setupGameController()

      //configure quality
      this.configureRenderingQuality(scnView)

      //asign the scene to the view
      this.sceneRenderer.scene = this.scene

      //seup audio
      this.setupAudio()

      //select the point of view to use
      this.sceneRenderer.pointOfView = this.cameraNode

      //register ourself as the physics contact deleate to receive contact notifications
      this.sceneRenderer.scene.physicsWorld.contactDelegate = this

      this.sceneRenderer.delegate = this
    })
  }

// MARK: -
// MARK: Setup

  setupGameController() {
    NotificationCenter.default.addObserverSelectorNameObject(
      this, this.handleControllerDidConnect, NSNotification.Name.GCControllerDidConnect, null)

    NotificationCenter.default.addObserverSelectorNameObject(
      this, this.handleControllerDidDisconnect, NSNotification.Name.GCControllerDidDisconnect, null)
    const controller = GCController.controllers()[0]
    if(!controller){
      return
    }
    this.registerGameController(this.controller)
  }

  setupCharacter() {
    this.character = new Character(this.scene)

    // keep a pointer to the physicsWorld from the character because we will need it when updating the character's position
    return this.character.didLoad.then(() => {
      this.character.physicsWorld = this.scene.physicsWorld
      this.scene.rootNode.addChildNode(this.character.node)
    })
  }

  setupPhysics() {
    //make sure all objects only collide with the character
    this.scene.rootNode.enumerateHierarchy((node) => {
      if(node.physicsBody){
        node.physicsBody.collisionBitMask = Bitmask.character
      }
    })
  }

  setupCollisions() {
    // load the collision mesh from another scene and merge into main scene
    const collisionsScene = SCNScene.sceneNamed('Art.scnassets/collision.scn')
    return collisionsScene.didLoad.then(() => {
      collisionsScene.rootNode.enumerateChildNodes((child) => {
        child.opacity = 0.0
        this.scene.rootNode.addChildNode(child)
      })
    })
  }

  // the follow camera behavior make the camera to follow the character, with a constant distance, altitude and smoothed motion
  setupFollowCamera(cameraNode) {
    // look at "lookAtTarget"
    const lookAtConstraint = new SCNLookAtConstraint(this.lookAtTarget)
    lookAtConstraint.influenceFactor = 0.07
    lookAtConstraint.isGimbalLockEnabled = true

    // distance constraints
    const follow = new SCNDistanceConstraint(this.lookAtTarget)
    const distance = cameraNode.position.length()
    follow.minimumDistance = distance
    follow.maximumDistance = distance

    // configure a constraint to mainain a constant altitude relative to the character
    const desiredAltitude = Math.abs(cameraNode.worldPosition.y)

    const keepAltitude = SCNTransformConstraint.positionConstraintInWorldSpaceWith(true, (node, position) => {
      let _position = position._copy()
      _position.y = this.character.baseAltitude + desiredAltitude
      return _position
    })

    const accelerationConstraint = new SCNAccelerationConstraint()
    accelerationConstraint.maximumLinearVelocity = 1500.0
    accelerationConstraint.minimumLinearAcceleration = 50.0
    accelerationConstraint.damping = 0.05

    // use a custom constraint to let the user orbit the camera around the character
    const transformNode = new SCNNode()
    const orientationUpdateConstraint = SCNTransformConstraint.constraintInWorldSpaceWith(true, (node, transform) => {
      if(this.activeCamera !== node){
        return transform
      }

      // Slowly update the acceleration constraint influence factor to smoothly reenable the acceleration.
      accelerationConstraint.influenceFactor = Math.min(1, accelerationConstraint.influenceFactor + 0.01)

      const targetPosition = this.lookAtTarget.presentation.worldPosition
      const cameraDirection = this.cameraDirection
      if(cameraDirection.length() === 0){
        return transform
      }

      // Disable the acceleration constraint.
      accelerationConstraint.influenceFactor = 0

      const characterWorldUp = this.character.node.presentation.worldUp

      transformNode.transform = transform

      const q = SCNVector4(GameController.CameraOrientationSensitivity * cameraDirection.x, characterWorldUp).mul(SCNVector4(GameController.CameraOrientationSensitivity * cameraDirection.y, transformNode.worldRight)
      )

      transformNode.rotateByAroundTarget(q, targetPosition)
      return transformNode.transform
    })

    this.cameraNode.constraints = [follow, keepAltitude, accelerationConstraint, orientationUpdateConstraint, lookAtConstraint]
  }

  // the axis aligned behavior look at the character but remains aligned using a specified axis
  setupAxisAlignedCamera(cameraNode) {
    const distance = cameraNode.position.length()
    const originalAxisDirection = cameraNode.worldFront

    this.lastActiveCameraFrontDirection = originalAxisDirection

    const symetricAxisDirection = new SCNVector3(-originalAxisDirection.x, originalAxisDirection.y, -originalAxisDirection.z)

    // define a custom constraint for the axis alignment
    const axisAlignConstraint = SCNTransformConstraint.positionConstraintInWorldSpaceWith(true, (node, position) => {
      if(!this.activeCamera){
        return position
      }

      const axisOrigin = this.lookAtTarget.presentation.worldPosition
      const referenceFrontDirection = this.activeCamera === node ? this.lastActiveCameraFrontDirection : this.activeCamera.presentation.worldFront

      const axis = originalAxisDirection.dot(referenceFrontDirection) > 0 ? originalAxisDirection: symetricAxisDirection

      const constrainedPosition = axisOrigin.sub(distance).mul(axis)
      return constrainedPosition
    })

    const accelerationConstraint = new SCNAccelerationConstraint()
    accelerationConstraint.maximumLinearAcceleration = 20
    accelerationConstraint.decelerationDistance = 0.5
    accelerationConstraint.damping = 0.05

    // look at constraint
    const lookAtConstraint = new SCNLookAtConstraint(this.lookAtTarget)
    lookAtConstraint.isGimbalLockEnabled = true // keep horizon horizontal

    this.cameraNode.constraints = [axisAlignConstraint, lookAtConstraint, accelerationConstraint]
  }

  setupCameraNode(node) {
    const cameraName = node.name
    if(!cameraName){
      return
    }

    if(cameraName.startsWith('camTrav')){
      this.setupAxisAlignedCamera(node)
    }else if(cameraName.startsWith('camLookAt')){
      this.setupFollowCamera(node)
    }
  }

  setupCamera() {
    //The lookAtTarget node will be placed slightly above the character using a constraint

    this.lookAtTarget.constraints = [ SCNTransformConstraint.positionConstraintInWorldSpaceWith(true, (node, position) => {
      const worldPosition = this.character.node.worldPosition
      worldPosition.y = this.character.baseAltitude + 0.5
      return worldPosition
    })]

    this.scene.rootNode.addChildNode(this.lookAtTarget)

    this.scene.rootNode.enumerateHierarchy((node) => {
      if(node.camera !== null){
        this.setupCameraNode(node)
      }
    })

    this.cameraNode.camera = new SCNCamera()
    this.cameraNode.name = 'mainCamera'
    this.cameraNode.camera.zNear = 0.1
    this.scene.rootNode.addChildNode(this.cameraNode)

    this.setActiveCameraAnimationDuration('camLookAt_cameraGame', 0.0)
  }

  setupEnemies() {
    this.enemy1 = this.scene.rootNode.childNodeWithNameRecursively('enemy1', true)
    this.enemy2 = this.scene.rootNode.childNodeWithNameRecursively('enemy2', true)

    const gkScene = new GKScene()

    // Player
    const playerEntity = new GKEntity()
    gkScene.addEntity(playerEntity)
    playerEntity.addComponent(new GKSCNNodeComponent(this.character.node))

    const playerComponent = new PlayerComponent()
    playerComponent.isAutoMoveNode = false
    playerComponent.character = this.character
    playerEntity.addComponent(playerComponent)
    playerComponent.positionAgentFromNode()

    // Chaser
    const chaserEntity = new GKEntity()
    gkScene.addEntity(chaserEntity)
    chaserEntity.addComponent(new GKSCNNodeComponent(this.enemy1))
    const chaser = new ChaserComponent()
    chaserEntity.addComponent(chaser)
    chaser.player = playerComponent
    chaser.positionAgentFromNode()

    // Scared
    const scaredEntity = new GKEntity()
    gkScene.addEntity(scaredEntity)
    scaredEntity.addComponent(new GKSCNNodeComponent(this.enemy2))
    const scared = new ScaredComponent()
    scaredEntity.addComponent(scared)
    scared.player = playerComponent
    scared.positionAgentFromNode()

    // animate enemies (move up and down)
    const anim = new CABasicAnimation('position')
    anim.fromValue = new SCNVector3(0, 0.1, 0)
    anim.toValue = new SCNVector3(0, -0.1, 0)
    anim.isAdditive = true
    anim.repeatCount = Infinity
    anim.autoreverses = true
    anim.duration = 1.2
    anim.timingFunction = CAMediaTimingFunction.functionWithName(kCAMediaTimingFunctionEaseInEaseOut)

    this.enemy1.addAnimationForKey(anim, '')
    this.enemy2.addAnimationForKey(anim, '')

    this.gkScene = gkScene
  }

  loadParticleSystems(path) {
    const url = path
    const directory = url.substring(0, url.lastIndexOf('/'))

    const fileName = url.substring(url.lastIndexOf('/') + 1)
    const ext = url.substring(url.lastIndexOf('.') + 1)

    if(ext === 'scnp'){
      const particle = new SCNParticleSystem(fileName, directory)
      return particle.didLoad.then(() => particle)
    }else{
      const scene = SCNScene.sceneNamedInDirectory(fileName, directory, null)
      return scene.didLoad.then(() => {
        const particles = []
        scene.rootNode.enumerateHierarchy((node) => {
          if(node.particleSystems !== null){
            particles.push(...node.particleSystems)
          }
        })
        return particles
      })
    }
  }

  setupParticleSystem() {
    //this.particleSystems[ParticleKind.collect] = this.loadParticleSystems('Art.scnassets/particles/collect.scnp')
    //this.particleSystems[ParticleKind.collectBig] = this.loadParticleSystems('Art.scnassets/particles/key_apparition.scn')
    //this.particleSystems[ParticleKind.enemyExplosion] = this.loadParticleSystems('Art.scnassets/particles/enemy_explosion.scn')
    //this.particleSystems[ParticleKind.keyApparition] = this.loadParticleSystems('Art.scnassets/particles/key_apparition.scn')
    //this.particleSystems[ParticleKind.unlockDoor] = this.loadParticleSystems('Art.scnassets/particles/unlock_door.scn')
    const particles = [
      this.loadParticleSystems('Art.scnassets/particles/collect.scnp').then((system) => { this.particleSystems[ParticleKind.collect] = system }),
      this.loadParticleSystems('Art.scnassets/particles/key_apparition.scn').then((system) => { this.particleSystems[ParticleKind.collectBig] = system}),
      this.loadParticleSystems('Art.scnassets/particles/enemy_explosion.scn').then((system) => { this.particleSystems[ParticleKind.enemyExplosion] = system }),
      this.loadParticleSystems('Art.scnassets/particles/key_apparition.scn').then((system) => { this.particleSystems[ParticleKind.keyApparition] = system }),
      this.loadParticleSystems('Art.scnassets/particles/unlock_door.scn').then((system) => { this.particleSystems[ParticleKind.unlockDoor] = system })
    ]
    return Promise.all(particles)
  }

  setupPlatforms() {
    const PLATFORM_MOVE_OFFSET = 1.5
    const PLATFORM_MOVE_SPEED = 0.5

    let alternate = 1
    // This could be done in the editor using the action editor.
    this.scene.rootNode.enumerateHierarchy((node) => {
      if(node.name === 'mobilePlatform' && node.childNodes.length !== 0){
        node.position = new SCNVector3(node.position.x - (alternate * PLATFORM_MOVE_OFFSET / 2.0), node.position.y, node.position.z)

        const moveAction = SCNAction.moveBy(new SCNVector3(alternate * PLATFORM_MOVE_OFFSET, 0, 0), 1 / PLATFORM_MOVE_SPEED)
        moveAction.timingMode = SCNActionTimingMode.easeInEaseOut
        node.runAction(SCNAction.repeatForever(SCNAction.sequence([moveAction, moveAction.reversed()])))

        alternate = -alternate // alternate movement of platforms to desynchronize them

        node.enumerateChildNodes((child) => {
          if(child.name === 'particles_platform'){
            child.particleSystems[0].orientationDirection = new SCNVector3(0, 1, 0)
          }
        })
      }
    })
  }

  // MARK: - Camera transitions

  // transition to the specified camera
  // this method will reparent the main camera under the camera named "cameraNamed"
  // and trigger the animation to smoothly move from the current position to the new position
  setActiveCameraAnimationDuration(cameraName, duration) {
    const camera = this.scene.rootNode.childNodeWithNameRecursively(cameraName, true)
    if(!camera){
      return
    }
    if(this.activeCamera === camera){
      return
    }

    this.lastActiveCamera = this.activeCamera
    if(this.activeCamera !== null){
      this.lastActiveCameraFrontDirection = this.activeCamera.presentation.worldFront
    }
    this.activeCamera = camera

    // save old transform in world space
    const oldTransform = this.cameraNode.presentation.worldTransform

    // re-parent
    camera.addChildNode(this.cameraNode)

    // compute the old transform relative to our new parent node (yeah this is the complex part)
    const parentTransform = camera.presentation.worldTransform
    const parentInv = SCNMatrix4Invert(parentTransform)

    // with this new transform our position is unchanged in world space (i.e we did re-parent but didn't move
    this.cameraNode.transform = SCNMatrix4Mult(oldTransform, parentInv)

    // now animate the transform to identity to smoothly move to the new desired position
    SCNTransaction.begin()
    SCNTransaction.animationDuration = duration
    SCNTransaction.animationTimingFunction = CAMediaTimingFunction.functionWithName(kCAMediaTimingFunctionEaseInEaseOut)
    this.cameraNode.transform = SCNMatrix4MakeTranslation(0, 0, 0)

    const cameraTemplate = camera.camera
    if(cameraTemplate){
      this.cameraNode.camera.fieldOfView = cameraTemplate.fieldOfView
      this.cameraNode.camera.wantsDepthOfField = cameraTemplate.wantsDepthOfField
      this.cameraNode.camera.sensorHeight = cameraTemplate.sensorHeight
      this.cameraNode.camera.fStop = cameraTemplate.fStop
      this.cameraNode.camera.focusDistance = cameraTemplate.focusDistance
      this.cameraNode.camera.bloomIntensity = cameraTemplate.bloomIntensity
      this.cameraNode.camera.bloomThreshold = cameraTemplate.bloomThreshold
      this.cameraNode.camera.bloomBlurRadius = cameraTemplate.bloomBlurRadius
      this.cameraNode.camera.wantsHDR = cameraTemplate.wantsHDR
      this.cameraNode.camera.wantsExposureAdaptation = cameraTemplate.wantsExposureAdaptation
      this.cameraNode.camera.vignettingPower = cameraTemplate.vignettingPower
      this.cameraNode.camera.vignettingIntensity = cameraTemplate.vignettingIntensity
    }
    SCNTransaction.commit()
  }

  setActiveCamera(cameraName) {
    this.setActiveCameraAnimationDuration(cameraName, GameController.DefaultCameraTransitionDuration)
  }

  // MARK: - Audio

  playSound(audioName) {
    this.scene.rootNode.addAudioPlayer(new SCNAudioPlayer(this.audioSources[audioName]))
  }

  setupAudio() {
    // Get an arbitrary node to attach the sounds to.
    const node = this.scene.rootNode

    // ambience
    const audioSource = new SCNAudioSource('audio/ambience.mp3')
    if(audioSource){
      audioSource.loops = true
      audioSource.volume = 0.8
      audioSource.isPositional = false
      audioSource.shouldStream = true
      node.addAudioPlayer(new SCNAudioPlayer(audioSource))
    }
    // volcano
    const volcanoNode = this.scene.rootNode.childNodeWithNameRecursively('particles_volcanoSmoke_v2', true)
    if(volcanoNode){
      const _audioSource = new SCNAudioSource('audio/volcano.mp3')
      _audioSource.loops = true
      _audioSource.volume = 5.0
      volcanoNode.addAudioPlayer(new SCNAudioPlayer(_audioSource))
    }

    // other sounds
    this.audioSources[AudioSourceKind.collect] = new SCNAudioSource('audio/collect.mp3')
    this.audioSources[AudioSourceKind.collectBig] = new SCNAudioSource('audio/collectBig.mp3')
    this.audioSources[AudioSourceKind.unlockDoor] = new SCNAudioSource('audio/unlockTheDoor.mp3')
    this.audioSources[AudioSourceKind.hitEnemy] = new SCNAudioSource('audio/hitEnemy.mp3')

    // adjust volumes
    this.audioSources[AudioSourceKind.unlockDoor].isPositional = false
    this.audioSources[AudioSourceKind.collect].isPositional = false
    this.audioSources[AudioSourceKind.collectBig].isPositional = false
    this.audioSources[AudioSourceKind.hitEnemy].isPositional = false

    this.audioSources[AudioSourceKind.unlockDoor].volume = 0.5
    this.audioSources[AudioSourceKind.collect].volume = 4.0
    this.audioSources[AudioSourceKind.collectBig].volume = 4.0
  }

  resetPlayerPosition() {
    this.character.queueResetCharacterPosition()
  }

  // MARK: - cinematic

  startCinematic() {
    this.playingCinematic = true
    this.character.node.isPaused = true
  }

  stopCinematic() {
    this.playingCinematic = false
    this.character.node.isPaused = false
  }

  // MARK: - particles

  particleSystems(kind) {
    return this.particleSystems[kind]
  }

  addParticles(kind, transform) {
    const particles = this.particleSystems(kind)
    for(const ps of particles){
      this.scene.addParticleSystem(ps, transform)
    }
  }

  // mARK: - Triggers

  // "triggers" are triggered when a character enter a box with the collision mask BitmaskTrigger
  execTrigger(triggerNode, duration) {
    //exec trigger
    if(triggerNode.name.startsWith('trigCam_')){
      const cameraName = triggerNode.name.substring(8)
      this.setActiveCamera(cameraName, duration)
    }
    //action
    if(triggerNode.name.startsWit('trigAction_')){
      const actionName = triggerNode.name.substring(11)
      if(actionName === 'unlockDoor'){
        this.unlockDoor()
      }
    }
  }

  trigger(triggerNode) {
    if(this.playingCinematic){
      return
    }
    if(this.lastTrigger !== triggerNode){
      this.lastTrigger = triggerNode

      // the very first trigger should not animate (initial camera position)
      this.execTrigger(triggerNode, this.firstTriggerDone ? GameController.DefaultCameraTransitionDuration: 0)
      this.firstTriggerDone = true
    }
  }

  // MARK: - Friends

  updateFriends(deltaTime) {
    const pathCurve = 0.4

    // update pandas
    for(let i=0; i<this.friendCount; i++){
      const friend = this.friends[i]

      let pos = friend.position
      const offsetx = pos.x - Math.sin(pathCurve * pos.z)

      pos.z += this.friendsSpeed[i] * deltaTime * 0.5
      pos.x = Math.sin(pathCurve * pos.z) + offsetx

      friend.position = pos

      this.ensureNoPenetrationOfIndex(i)
    }
  }

  animateFriends() {
      //animations
    const walkAnimation = Character.loadAnimationFromSceneNamed('Art.scnassets/character/max_walk.scn')

    SCNTransaction.begin()
    for(let i=0; i<this.friendCount; i++){
      //unsynchronize
      const walk = walkAnimation.copy()
      walk.speed = this.friendsSpeed[i]
      this.friends[i].addAnimationPlayerForKey(walk, 'walk')
      walk.play()
    }
    SCNTransaction.commit()
  }

  addFriends(count) {
    let _count = count
    if(_count + this.friendCount > GameController.NumberOfFriends){
      _count = GameController.NumberOfFriends - this.friendCount
    }

    const friendScene = SCNScene.sceneNamed('Art.scnassets/character/max.scn')
    return friendScene.didLoad.then(() => {
      const friendModel = friendScene.rootNode.childNodeWithNameRecursively('Max_rootNode', true)
      friendModel.name = 'friend'

      const textures = []
      textures[0] = 'Art.scnassets/character/max_diffuseB.png'
      textures[1] = 'Art.scnassets/character/max_diffuseC.png'
      textures[2] = 'Art.scnassets/character/max_diffuseD.png'

      const geometries = []
      const geometryNode = friendModel.childNodeWithNameRecursively('Max', true)

      geometryNode.geometry.firstMaterial.diffuse.intensity = 0.5

      geometries[0] = geometryNode.geometry.copy()
      geometries[1] = geometryNode.geometry.copy()
      geometries[2] = geometryNode.geometry.copy()

      geometries[0].firstMaterial = geometries[0].firstMaterial.copy()
      geometryNode.geometry.firstMaterial.diffuse.contents = 'Art.scnassets/character/max_diffuseB.png'

      geometries[1].firstMaterial = geometries[1].firstMaterial.copy()
      geometryNode.geometry.firstMaterial.diffuse.contents = 'Art.scnassets/character/max_diffuseC.png'

      geometries[2].firstMaterial = geometries[2].firstMaterial.copy()
      geometryNode.geometry.firstMaterial.diffuse.contents = 'Art.scnassets/character/max_diffuseD.png'

      //remove physics from our friends
      friendModel.enumerateHierarchy((node) => {
        node.physicsBody = null
      })

      const friendPosition = new SCNVector3(-5.84, -0.75, 3.354)
      const FRIEND_AREA_LENGTH = 5.0

      // group them
      let friendsNode = this.scene.rootNode.childNodeWithNameRecursively('friends', false)
      if(friendsNode === null){
        friendsNode = new SCNNode()
        friendsNode.name = 'friends'
        this.scene.rootNode.addChildNode(friendsNode)
      }

      //animations
      const idleAnimationPromise = Character.loadAnimationFromSceneNamed('Art.scnassets/character/max_idle.scn')
      return idleAnimationPromise.then((idleAnimation) => {
        for(let i=0; i<count; i++){
          const friend = friendModel.clone()

          //replace texture
          const geometryIndex = Math.floor(Math.random() * 3)
          const _geometryNode = friend.childNodeWithNameRecursively('Max', true)
          _geometryNode.geometry = geometries[geometryIndex]

          //place our friend
          friend.position = new SCNVector3(
            friendPosition.x + (1.4 * Math.random() - 0.5),
            friendPosition.y,
            friendPosition.z - (FRIEND_AREA_LENGTH * Math.random()))

          //unsynchronize
          const idle = idleAnimation.copy()
          idle.speed = 1.5 + 1.5 * Math.random()

          friend.addAnimationPlayerForKey(idle, 'idle')
          idle.play()
          friendsNode.addChildNode(friend)

          this.friendsSpeed[this.friendCount] = idle.speed
          this.friends[this.friendCount] = friend
          this.friendCount += 1
        }

        for(let i=0; i<this.friendCount; i++){
          this.ensureNoPenetrationOfIndex(i)
        }
      })
    })
  }

  // iterates on every friend and move them if they intersect friend at index i
  ensureNoPenetrationOfIndex(index) {
    let pos = this.friends[index].position

    // ensure no penetration
    const pandaRadius = 0.15
    const pandaDiameter = pandaRadius * 2.0
    for(let j=0; j<this.friendCount; j++){
      if(j === index){
        continue
      }

      const otherPos = this.friends[j].position
      const v = otherPos.sub(pos)
      const dist = v.length()
      if(dist < pandaDiameter){
        // penetration
        const pen = pandaDiameter - dist
        pos = pos.sub(v.mul(pen))
      }
    }

    //ensure within the box X[-6.662 -4.8] Z<3.354
    if(this.friends[index].position.z <= 3.354){
      pos.x = Math.max(pos.x, -6.662)
      pos.x = Math.min(pos.x, -4.8)
    }
    this.friends[index].position = pos
  }

  // MARK: - Game actions

  unlockDoor() {
    if(this.friendsAreFree){ //already unlocked
      return
    }

    this.startCinematic() //pause the scene

    //play sound
    this.playSound(AudioSourceKind.unlockDoor)

    //cinematic02
    SCNTransaction.begin()
    SCNTransaction.animationDuration = 0.0
    SCNTransaction.completionBlock = () => {
      //trigger particles
      const door = this.scene.rootNode.childNodeWithNameRecursively('door', true)
      const particle_door = this.scene.rootNode.childNodeWithNameRecursively('particles_door', true)
      this.addParticles(ParticleKind.unlockDoor, particle_door.worldTransform)

      //audio
      this.playSound(AudioSourceKind.collectBig)

      //add friends
      SCNTransaction.begin()
      SCNTransaction.animationDuration = 0.0
      this.addFriends(GameController.NumberOfFriends)
      SCNTransaction.commit()

      //open the door
      SCNTransaction.begin()
      SCNTransaction.animationDuration = 1.0
      SCNTransaction.completionBlock = () => {
        //animate characters
        this.animateFriends()

        // update state
        this.friendsAreFree = true

        // show end screen
        DispatchQueue.main.asyncAfterDeadline(DispatchTime.now() + 1.0, () => {
          this.showEndScreen()
        })
      }
      door.opacity = 0.0
      SCNTransaction.commit()
    }

    // change the point of view
    this.setActiveCamera('CameraCinematic02', 1.0)
    SCNTransaction.commit()
  }

  showKey() {
    this.keyIsVisible = true

    // get the key node
    const key = this.scene.rootNode.childNodeWithNameRecursively('key', true)

    //sound fx
    this.playSound(AudioSourceKind.collectBig)

    //particles
    this.addParticles(ParticleKind.keyApparition, key.worldTransform)

    SCNTransaction.begin()
    SCNTransaction.animationDuration = 1.0
    SCNTransaction.completionBlock = () => {
      DispatchQueue.main.asyncAfterDeadline(DispatchTime.now() + 2.5, () => {
        this.keyDidAppear()
      })
    }
    key.opacity = 1.0 // show the key
    SCNTransaction.commit()
  }

  keyDidAppear() {
    this.execTrigger(this.lastTrigger, 0.75) //revert to previous camera
    this.stopCinematic()
  }

  keyShouldAppear() {
    this.startCinematic()

    SCNTransaction.begin()
    SCNTransaction.animationDuration = 0.0
    SCNTransaction.completionBlock = () => {
      this.showKey()
    }
    this.setActiveCamera('CameraCinematic01', 3.0)
    SCNTransaction.commit()
  }

  collect(collectable) {
    if(collectable.physicsBody !== null){

      //the Key
      if(collectable.name === 'key'){
        if(!this.keyIsVisible){ //key not visible yet
          return
        }

        // play sound
        this.playSound(AudioSourceKind.collect)
        this.overlay.didCollectKey()

        this.collectedKeys += 1
      }

      //the gems
      else if(collectable.name === 'CollectableBig'){
        this.collectedGems += 1

        // play sound
        this.playSound(AudioSourceKind.collect)

        // update the overlay
        this.overlay.collectedGemsCount = this.collectedGems

        if(this.collectedGems === 1){
          //we collect a gem, show the key after 1 second
          DispatchQueue.main.asyncAfterDeadline(DispatchTime.now() + 0.5, () => {
            this.keyShouldAppear()
          })
        }
      }

      collectable.physicsBody = null //not collectable anymore

      // particles
      this.addParticles(ParticleKind.keyApparition, collectable.worldTransform)

      collectable.removeFromParentNode()
    }
  }

  // MARK: - Controlling the character

  controllerJump(controllerJump) {
    this.character.isJump = controllerJump
  }

  controllerAttack() {
    if(this.character.isAttacking){
      this.character.attack()
    }
  }

  get characterDirection() {
    return this.character.direction
  }
  set characterDirection(newValue) {
    let direction = newValue
    const l = direction.length()
    if(l > 1.0){
      direction.mul(1 / l)
    }
    this.character.direction = direction
  }

  get cameraDirection() {
    return this._cameraDirection
  }
  set cameraDirection(newValue) {
    this._cameraDirection = newValue
    const l = this._cameraDirection.length()
    if(l > 1.0){
      this._cameraDirection = this._cameraDirection.mul(1 / l)
    }
    this._cameraDirection.y = 0
  }

  // MARK: - Update

  rendererUpdateAtTime(renderer, time) {
    // compute delta time
    if(this.lastUpdateTime === 0){
      this.lastUpdateTime = time
    }
    const deltaTime = time - this.lastUpdateTime
    this.lastUpdateTime = time

    // Update Friends
    if(this.friendsAreFree){
      this.updateFriendsDeltaTime(deltaTime)
    }

    // stop here if cinematic
    if(this.playingCinematic === true){
      return
    }

    // update characters
    this.character.updateAtTimeWith(time, renderer)

    // update enemies
    for(const entity of this.gkScene.entities){
      entity.updateDeltaTime(deltaTime)
    }
  }

  // MARK: - contact delegate

  physicsWorldDidBegin(world, contact) {
    
    // triggers
    if(contact.nodeA.physicsBody.categoryBitMask === Bitmask.trigger){
      this.trigger(contact.nodeA)
    }
    if(contact.nodeB.physicsBody.categoryBitMask === Bitmask.trigger){
      this.trigger(contact.nodeB)
    }
    // collectables
    if(contact.nodeA.physicsBody.categoryBitMask === Bitmask.collectable){
      this.collect(contact.nodeA)
    }
    if(contact.nodeB.physicsBody.categoryBitMask === Bitmask.collectable){
      this.collect(contact.nodeB)
    }
  }

  // MARK: - Congratulating the Player

  showEndScreen() {
    // Play the congrat sound.
    const victoryMusic = new SCNAudioSource('audio/Music_victory.mp3')
    victoryMusic.volume = 0.5

    this.scene.rootNode.addAudioPlayer(new SCNAudioPlayer(victoryMusic))

    this.overlay.showEndScreen()
  }

  // MARK: - Configure rendering quality

  turnOffEXRForMAterialProperty(property) {
    let propertyPath = property.contents
    if(propertyPath && propertyPath.endsWith('.exr')){
      propertyPath = propertyPath.replace(/\.exr$/, '.png')
      property.contents = propertyPath
    }
  }

  turnOffEXR() {
    this.turnOffEXRForMAterialProperty(this.scene.background)
    this.turnOffEXRForMAterialProperty(this.scene.lightingEnvironment)

    this.scene.rootNode.enumerateChildNodes((child) => {
      const materials = child.geometry.materials
      if(materials){
        for(const material of materials){
          this.turnOffEXRForMAterialProperty(material.selfIllumination)
        }
      }
    })
  }

  turnOffNormalMaps() {
    this.scene.rootNode.enumerateChildNodes((child) => {
      const materials = child.geometry ? child.geometry.materials : null
      if(materials){
        for(const material of materials){
          material.normal.contents = SKColor.black
        }
      }
    })
  }

  turnOffHDR() {
    this.scene.rootNode.enumerateChildNodes((child) => {
      if(child.camera){
        child.camera.wantsHDR = false
      }
    })
  }

  turnOffDepthOfField() {
    this.scene.rootNode.enumerateChildNodes((child) => {
      if(child.camera){
        child.camera.wantsDepthOfField = false
      }
    })
  }

  turnOffSoftShadows() {
    this.scene.rootNode.enumerateChildNodes((child) => {
      const lightSampleCount = child.light ? child.light.shadowSampleCount : null
      if(lightSampleCount !== null){
        child.light.shadowSampleCount = Math.min(lightSampleCount, 1)
      }
    })
  }

  turnOffPostProcess() {
    this.scene.rootNode.enumerateChildNodes((child) => {
      const light = child.light
      if(light){
        light.shadowCascadeCount = 0
        light.shadowMapSize = new CGSize(1024, 1024)
      }
    })
  }

  turnOffOverlay() {
    this.sceneRenderer.overlaySKScene = null
  }

  turnOffVertexShaderModifiers() {
    this.scene.rootNode.enumerateChildNodes((child) => {
      const shaderModifiers = child.geometry ? child.geometry.shaderModifiers : null
      if(shaderModifiers){
        shaderModifiers[SCNShaderModifierEntryPoint.geometry] = null
        child.geometry.shaderModifiers = shaderModifiers
      }

      const materials = child.geometry ? child.geometry.materials : null
      if(materials){
        for(const material of materials){
          if(material.shaderModifiers !== null){
            const _shaderModifiers = material.shaderModifiers
            _shaderModifiers[SCNShaderModifierEntryPoint.geometry] = null
            material.shaderModifiers = _shaderModifiers
          }
        }
      }
    })
  }

  turnOffVegetation() {
    this.scene.rootNode.enumerateChildNodes((child) => {
      const materialName = child.geometry ? child.geometry.firstMaterial.name : null
      if(!materialName){
        return
      }
      if(materialName.startsWith('plante')){
        child.isHidden = true
      }
    })
  }

  configureRenderingQuality(view){
  /*
    this.turnOffEXR() //tvOS doesn't support exr maps
    // the following things are done for low power device(s) only
    this.turnOffNormalMaps()
    this.turnOffHDR()
    this.turnOffDepthOfField()
    this.turnOffSoftShadows()
    this.turnOffPostProcess()
    this.turnOffOverlay()
    this.turnOffVertexShaderModifiers()
    this.turnOffVegetation()
  */

  }

  // MARK: - Debug menu

  fStopChanged(value) {
    this.sceneRenderer.pointOfView.camera.fStop = value
  }

  focusDistanceChanged(value) {
    this.sceneRenderer.pointOfView.camera.focusDistance = value
  }

  debugMenuSelectCameraAtIndex(index) {
    if(index === 0){
      const key = this.scene.rootNode.childNodeWithNameRecursively('key', true)
      key.opacity = 1.0
    }
    this.setActiveCamera(`CameraDof${index}`)
  }

  // MARK: - GameController

  handleControllerDidConnect(notification) {
    if(this.gamePadCurrent !== null){
      return
    }
    const gameController = notification.object
    if(!gameController){
      return
    }
    this.registerGameController(gameController)
  }

  handleControllerDidDisconnect(notification) {
    const gameController = notification.object
    if(!gameController){
      return
    }
    if(gameController !== this.gamePadCurrent){
      return
    }

    this.unregisterGameController()

    for(const controller of GCController.controllers()){
      if(gameController !== controller){
        this.registerGameController(controller)
      }
    }
  }

  registerGameController(gameController){

    let buttonA = null
    let buttonB = null

    let gamepad = gameController.extendedGamepad
    if(gamepad){
      this.gamePadLeft = gamepad.leftThumbstick
      this.gamePadRight = gamepad.rightThumbstick
      buttonA = gamepad.buttonA
      buttonB = gamepad.buttonB
    }else if(gameController.gamepad){
      gamepad = gameController.gamepad
      this.gamePadLeft = gamepad.dpad
      buttonA = gamepad.buttonA
      buttonB = gamepad.buttonB
    }else if(gameController.microGamepad){
      gamepad = gameController.microGamepad
      this.gamePadLeft = gamepad.dpad
      buttonA = gamepad.buttonA
      buttonB = gamepad.buttonB
    }

    this.gamepadLeft.valueChangedHandler = (dpad, xValue, yValue) => {
      this.characterDirection = new CGPoint(xValue, -yValue)
    }

    const gamePadRight = this.gamePadRight
    if(gamePadRight){
      gamePadRight.valueChangedHandler = (dpad, xValue, yValue) => {
        this.cameraDirection = new CGPoint(xValue, yValue)
      }
    }

    if(buttonA){
      buttonA.valueChangedHandler = (button, value, pressed) => {
        this.controllerJump(pressed)
      }
    }
    
    if(buttonB){
      buttonB.valueChangedHandler = (button, value, pressed) => {
        this.controllerAttack()
      }
    }

/*
    if(this.gamePadLeft !-- null){
      overlay.hideVirtualPad()
    }
*/
  }

  unregisterGameController() {
    this.gamePadLeft = null
    this.gamePadRight = null
    this.gamePadCurrent = null
/*
    overlay.showVirtualPad()
*/
  }

  // MARK: - PadOverlayDelegate

/*
  padOverlayVirtualStickInteractionDidStart(padNode) {
  }

  padOverlayVirtualStickInteractionDidChange(padNode) {
  }

  padOverlayVirtualSitkcInteractionDidEnd(padNode) {
  }

  willPress(button) {
  }

  didPress(button) {
  }
*/
}

