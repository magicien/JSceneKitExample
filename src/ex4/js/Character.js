'use strict'

import {
  NSObject,
  //CFAbsoluteTimeGetCurrent,
  CGPoint,
  DispatchQueue,
  SCNAction,
  SCNAnimationEvent,
  SCNAudioSource,
  SCNCapsule,
  SCNHitTestOption,
  SCNMatrix4MakeTranslation,
  SCNNode,
  SCNPhysicsShape,
  SCNPhysicsWorld,
  SCNScene,
  SCNTransaction,
  SCNVector3,
  SCNVector3Make
} from 'jscenekit'

const _GroundType = {
  grass: 0,
  rock: 1,
  water: 2,
  inTheAir: 3,
  count: 4
}

// Collision bit masks
export const Bitmask = {
  character: 1 << 0, // the main character
  collision: 1 << 1, // the ground and walls
  enemy: 1 << 2, // the enemies
  trigger: 1 << 3, // the box that triggers camera changes and other actions
  collectable: 1 << 4 // the collectables (gems and key)
}

export default class Character extends NSObject {
  static get GroundType() {
    return _GroundType
  }

  static get speedFactor() {
    return 2.0
  }
  static get stepsCount() {
    return 10
  }

  static get initialPosition() {
    return new SCNVector3(0.1, -0.2, 0)
  }

  // some constants
  static get gravity() {
    return 0.004
  }
  static get jumpImpulse() {
    return 0.1
  }
  static get minAltitude() {
    return -10
  }
  static get enableFootStepSound() {
    return true
  }
  static get collisionMargin() {
    return 0.04
  }
  static get modelOffset() {
    return new SCNVector3(0, -Character.collisionMargin, 0)
  }
  static get collisionMeshBitMask() {
    return 8
  }

  // MARK: - Initialization
  constructor(scene) {
    super()

    // Character handle
    this.characterNode = null // top level node
    this.characterOrientation = null // the node to rotate to orient the character
    this.model = null // the model loaded from the character file

    // Physics
    this.characterCollisionShape = null
    this.collisionShapeOffsetFromModel = new SCNVector3(0, 0, 0)
    this.downwardAcceleration = 0

    // Jump
    this.controllerJump = false
    this.jumpState = 0
    this.groundNode = null
    this.groundNodeLastPosition = new SCNVector3(0, 0, 0)
    this.baseAltitude = 0
    this.targetAltitude = 0

    // void playing the step sound too often
    this.lastStepFrame = 0
    this.frameCounter = 0

    // Direction
    this.previousUpdateTime = 0
    this.controllerDirection = new CGPoint(0, 0)

    // states
    this.attackCount = 0
    this.lastHitTime = 0

    this.shouldResetCharacterPosition = false

    // Particle systems
    this.jumpDustParticle = null
    this.fireEmitter = null
    this.smokeEmitter = null
    this.whiteSmokeEmitter = null
    this.spinParticle = null
    this.spinCircleParticle = null

    this.spinParticleAttach = null

    this.fireEmitterBirthRate = 0.0
    this.smokeEmitterBirthRate = 0.0
    this.whiteSmokeEmitterBirthRate = 0.0

    // Sound effects
    this.aahSound = null
    this.ouchSound = null
    this.hitSound = null
    this.hitEmnemySound = null
    this.explodeEnemySound = null
    this.catchFireSound = null
    this.jumpSound = null
    this.attackSound = null
    this.steps = []
    for(let i=0; i<Character.stepsCount; i++){
      this.steps.push(new SCNAudioSource())
    }

    this.offsetedMark = null

    // actions
    this.isJump = false
    this.direction = new CGPoint(0, 0)
    this.physicsWorld = null

    this._isBurning = false
    this._directionAngle = 0.0
    this._isWalking = false
    this._walkSpeed = 1.0

    this.loadCharacter()
    this.loadParticles()
    this.loadSounds()
    this.loadAnimations()

    this._loadedPromise = Promise.all([
      this._characterDidLoad,
      this._particlesDidLoad,
      this._soundsDidLoad,
      this._animationsDidLoad
    ])
  }

  loadCharacter() {
    /// Load character from external file
    const scene = SCNScene.sceneNamed('Art.scnassets/character/max.scn')
    this._characterDidLoad = scene.didLoad.then(() => {
      this.model = scene.rootNode.childNodeWithNameRecursively('Max_rootNode', true)
      this.model.position = Character.modelOffset

      /* setup character hierarchy
       character
       |_orientationNode
       |_model
       */
      this.characterNode = new SCNNode()
      this.characterNode.name = 'character'
      this.characterNode.position = Character.initialPosition

      this.characterOrientation = new SCNNode()
      this.characterNode.addChildNode(this.characterOrientation)
      this.characterOrientation.addChildNode(this.model)

      const collider = this.model.childNodeWithNameRecursively('collider', true)
      collider.physicsBody.collisionBitMask = Bitmask.enemy | Bitmask.trigger | Bitmask.collectable

      // Setup collision shape
      const {min, max} = this.model.boundingBox
      const collisionCapsuleRadius = (max.x - min.x) * 0.4
      const collisionCapsuleHeight = (max.y - min.y)

      const collisionGeometry = new SCNCapsule(collisionCapsuleRadius, collisionCapsuleHeight)
      const options = {}
      options[SCNPhysicsShape.Option.collisionMargin] = Character.collisionMargin
      this.characterCollisionShape = new SCNPhysicsShape(collisionGeometry, options)
      this.collisionShapeOffsetFromModel = new SCNVector3(0, collisionCapsuleHeight * 0.51, 0.0)

      this.spinParticleAttach = this.model.childNodeWithNameRecursively('particles_spin_circle', true)
    })
  }

  loadParticles() {
    const promises = []
    const jumpDustParticleScene = SCNScene.sceneNamed('Art.scnassets/character/jump_dust.scn')
    promises.push(jumpDustParticleScene.didLoad.then(() => {
      const particleNode = jumpDustParticleScene.rootNode.childNodeWithNameRecursively('particle', true)
      this.jumpDustParticle = particleNode.particleSystems[0]
    }))

    const burnParticleScene = SCNScene.sceneNamed('Art.scnassets/particles/burn.scn')
    promises.push(burnParticleScene.didLoad.then(() => {
      const burnParticleNode = burnParticleScene.rootNode.childNodeWithNameRecursively('particles', true)

      const particleEmitter = new SCNNode()
      this.characterOrientation.addChildNode(particleEmitter)

      this.fireEmitter = burnParticleNode.childNodeWithNameRecursively('fire', true).particleSystems[0]
      this.fireEmitterBirthRate = this.fireEmitter.birthRate
      this.fireEmitter.birthRate = 0

      this.smokeEmitter = burnParticleNode.childNodeWithNameRecursively('smoke', true).particleSystems[0]
      this.smokeEmitterBirthRate = this.smokeEmitter.birthRate
      this.smokeEmitter.birthRate = 0

      this.whiteSmokeEmitter = burnParticleNode.childNodeWithNameRecursively('whiteSmoke', true).particleSystems[0]
      this.whiteSmokeEmitterBirthRate = this.whiteSmokeEmitter.birthRate
      this.whiteSmokeEmitter.birthRate = 0

      particleEmitter.position = SCNVector3Make(0, 0.05, 0)
      particleEmitter.addParticleSystem(this.fireEmitter)
      particleEmitter.addParticleSystem(this.smokeEmitter)
      particleEmitter.addParticleSystem(this.whiteSmokeEmitter)
    }))

    const spinParticleScene = SCNScene.sceneNamed('Art.scnassets/particles/particles_spin.scn')
    promises.push(spinParticleScene.didLoad.then(() => {
      this.spinParticle = spinParticleScene.rootNode.childNodeWithNameRecursively('particles_spin', true).particleSystems[0]
      this.spinCircleParticle = spinParticleScene.rootNode.childNodeWithNameRecursively('particles_spin_circle', true).particleSystems[0]
    }))
    this._particlesDidLoad = Promise.all(promises)
  }

  loadSounds() {
    this.aahSound = SCNAudioSource.sourceNamed('audio/aah_extinction.mp3')
    this.aahSound.volume = 1.0
    this.aahSound.isPositional = false
    this.aahSound.load()

    this.catchFireSound = SCNAudioSource.sourceNamed('audio/panda_catch_fire.mp3')
    this.catchFireSound.volume = 5.0
    this.catchFireSound.isPositional = false
    this.catchFireSound.load()

    this.ouchSound = SCNAudioSource.sourceNamed('audio/ouch_firehit.mp3')
    this.ouchSound.volume = 2.0
    this.ouchSound.isPositional = false
    this.ouchSound.load()

    this.hitSound = SCNAudioSource.sourceNamed('audio/hit.mp3')
    this.hitSound.volue = 2.0
    this.hitSound.isPositional = false
    this.hitSound.load()

    this.hitEnemySound = SCNAudioSource.sourceNamed('audio/Explosion1.m4a')
    this.hitEnemySound.volume = 2.0
    this.hitEnemySound.isPositional = false
    this.hitEnemySound.load()

    this.explodeEnemySound = SCNAudioSource.sourceNamed('audio/Explosion2.m4a')
    this.explodeEnemySound.volume = 2.0
    this.explodeEnemySound.isPositional = false
    this.explodeEnemySound.load()

    this.jumpSound = SCNAudioSource.sourceNamed('audio/jump.m4a')
    this.jumpSound.volume = 0.2
    this.jumpSound.isPositional = false
    this.jumpSound.load()

    this.attackSound = SCNAudioSource.sourceNamed('audio/attack.mp3')
    this.attackSound.volume = 1.0
    this.attackSound.isPositional = false
    this.attackSound.load()

    for(let i=0; i<Character.stepsCount; i++){
      this.steps[i] = SCNAudioSource.sourceNamed(`audio/Step_rock_0${i}.mp3`)
      this.steps[i].volume = 0.5
      this.steps[i].isPositional = false
      this.steps[i].load()
    }

    const promises = []
    promises.push(
      this.aahSound.didLoad,
      this.catchFireSound.didLoad,
      this.ouchSound.didLoad,
      this.hitSound.didLoad,
      this.hitEnemySound.didLoad,
      this.explodeEnemySound.didLoad,
      this.jumpSound.didLoad,
      this.attackSound.didLoad
    )
    for(const sound of this.steps){
      promises.push(sound)
    }
    this._soundsDidLoad = Promise.all(promises)
  }

  loadAnimations() {
    const idleAnimationPromise = Character.loadAnimationFromSceneNamed('Art.scnassets/character/max_idle.scn')
    const walkAnimationPromise = Character.loadAnimationFromSceneNamed('Art.scnassets/character/max_walk.scn')
    const jumpAnimationPromise = Character.loadAnimationFromSceneNamed('Art.scnassets/character/max_jump.scn')
    const spinAnimationPromise = Character.loadAnimationFromSceneNamed('Art.scnassets/character/max_spin.scn')

    this._animationsDidLoad = Promise.all([
      idleAnimationPromise, 
      walkAnimationPromise, 
      jumpAnimationPromise, 
      spinAnimationPromise, 
      this._characterDidLoad
    ]).then((arr) => {
      const idleAnimation = arr[0]
      const walkAnimation = arr[1]
      const jumpAnimation = arr[2]
      const spinAnimation = arr[3]

      this.model.addAnimationPlayerForKey(idleAnimation, 'idle')
      idleAnimation.play()

      walkAnimation.speed = Character.speedFactor
      walkAnimation.stop()

      if(Character.enableFootStepSound){
        walkAnimation.animation.animationEvents = [
          new SCNAnimationEvent(0.1, () => { this.playFootStep() }),
          new SCNAnimationEvent(0.6, () => { this.playFootStep() })
        ]
      }
      this.model.addAnimationPlayerForKey(walkAnimation, 'walk')

      jumpAnimation.animationisRemovedOnCompletion = false
      jumpAnimation.stop()
      jumpAnimation.animation.animationEvents = [new SCNAnimationEvent(0, () => { this.playJumpSound() })]
      this.model.addAnimationPlayerForKey(jumpAnimation, 'jump')

      spinAnimation.animation.isRemovedOnCompletion = false
      spinAnimation.speed = 1.5
      spinAnimation.stop()
      spinAnimation.animation.animationEvents = [new SCNAnimationEvent(0, () => { this.playAttackSound() })]
      this.model.addAnimationPlayerForKey(spinAnimation, 'spin')
    })
  }

  get node() {
    return this.characterNode
  }

  queueResetCharacterPosition() {
    this.shouldResetCharacterPosition = true
  }

  // MARK: Audio

  playFootStep() {
    if(this.groundNode !== null && this.isWalking){ // We are in the air, no sound to play
      // Play a random step sound.
      const randSnd = Math.floor(Math.random() * Character.stepsCount)
      const stepSoundIndex = Math.min(Character.stepsCount - 1, randSnd)
      this.characterNode.runAction(SCNAction.playAudioWaitForCompletion( this.steps[stepSoundIndex], false))
    }
  }

  playJumpSound() {
    this.characterNode.runAction(SCNAction.playAudioWaitForCompletion(this.jumpSound, false))
  }

  playAttackSound() {
    this.characterNode.runAction(SCNAction.playAudioWaitForCompletion(this.attackSound, false))
  }

  get isBurning() {
    return this._isBurning
  }
  set isBurning(newValue) {
    const oldValue = this._isBurning
    this._isBurning = newValue

    if(this._isBurning === oldValue){
      return
    }
    //walk faster when burning
    const oldSpeed = this.walkSpeed
    this.walkSpeed = oldSpeed

    if(this._isBurning){
      this.model.runAction(SCNAction.sequence([
        SCNAction.playAudioWaitForCompletion(this.catchFireSound, false),
        SCNAction.playAudioWaitForCompletion(this.ouchSound, false),
        SCNAction.repeatForever(SCNAction.sequence([
          SCNAction.fadeOpacityToDuration(0.01, 0.1),
          SCNAction.fadeOpacityToDuration(1.0, 0.1)
          ]))
        ]))
      this.whiteSmokeEmitter.birthRate = 0
      this.fireEmitter.birthRate = this.fireEmitterBirthRate
      this.smokeEmitter.birthRate = this.smokeEmitterBirthRate
    }else{
      this.model.removeAllAudioPlayers()
      this.model.removeAllActions()
      this.model.opacity = 1.0
      this.model.runAction(SCNAction.playAudioWaitForCompletion(this.aahSound, false))

      SCNTransaction.begin()
      SCNTransaction.animationDuration = 5.0
      this.whiteSmokeEmitter.birthRate = 0
      SCNTransaction.commit()
    }
  }

  // MARK: - Controlling the character

  get directionAngle() {
    return this._directionAngle
  }
  set directionAngle(newValue) {
    this._directionAngle = newValue

    this.characterOrientation.runAction(
      SCNAction.rotateToXYZDurationUsesShortestUnitArc(0.0, this._directionAngle, 0.0, 0.1, true))
  }

  updateAtTimeWith(time, renderer) {
    this.frameCounter += 1

    if(this.shouldResetCharacterPosition){
      this.shouldResetCharacterPosition = false
      this.resetCharacterPosition()
      return
    }

    let characterVelocity = new SCNVector3(0, 0, 0)

    // setup
    let groundMove = new SCNVector3(0, 0, 0)

    // did the ground moved?
    if(this.groundNode !== null){
      const groundPosition = this.groundNode.worldPosition
      groundMove = groundPosition - this.groundNodeLastPosition
    }

    characterVelocity = new SCNVector3(groundMove.x, 0, groundMove.z)

    const direction = this.characterDirectionWithPointOfView(renderer.pointOfView)

    if(this.previousUpdateTime === 0.0){
      this.previousUpdateTime = time
    }

    const deltaTime = time - this.previousUpdateTime
    const characterSpeed = deltaTime * Character.speedFactor * this.walkSpeed
    const virtualFrameCount = Math.floor(deltaTime / (1 / 60.0))
    this.previousUpdateTime = time

    // move
    if(direction.length() !== 0){
      characterVelocity = direction.mul(characterSpeed)
      let runModifier = 1.0
      // TODO: implement NSEvent.modifierFlags
      //if(NSEvent.modifierFlags.contains(.shift)){
      //  runModifier = 2.0
      //}
      this.walkSpeed = runModifier * direction.length()

      // move character
      this.directionAngle = Math.atan2(direction.x, direction.z)

      this.isWalking = true
    }else{
      this.isWalking = false
    }

    // put the character on the ground
    const up = new SCNVector3(0, 1, 0)
    let wPosition = this.characterNode.worldPosition
    // gravity
    this.downwardAcceleration -= Character.gravity
    wPosition.y += this.downwardAcceleration
    const HIT_RANGE = 0.2
    let p0 = wPosition._copy()
    let p1 = wPosition._copy()
    p0.y = wPosition.y + up.y * HIT_RANGE
    p1.y = wPosition.y - up.y * HIT_RANGE

    const options = {}
    options[SCNHitTestOption.backFaceCulling] = false
    options[SCNHitTestOption.categoryBitMask] = Character.collisionMeshBitMask
    options[SCNHitTestOption.ignoreHiddenNodes] = false

    const hitFrom = p0
    const hitTo = p1
    const hitResult = renderer.scene.rootNode.hitTestWithSegmentFromTo(hitFrom, hitTo, options)[0]

    const wasTouchingTheGroup = this.groupNode !== null
    this.groundNode = null
    let touchesTheGround = false
    const wasBurning = this.isBurning

    if(hitResult){
      const ground = hitResult.worldCoordinates
      if(wPosition.y <= ground.y + Character.collisionMargin){
        wPosition.y = ground.y + Character.collisionMargin
        if(this.downwardAcceleration < 0){
          this.downwardAcceleration = 0
        }
        this.groundNode = hitResult.node
        touchesTheGround = true

        //touching lava?
        this.isBurning = this.groundNode.name === 'COLL_lava'
      }
    }else{
      if(wPosition.y < Character.minAltitude){
        wPosition.y = Character.minAltitude
        //reset
        this.queueResetCharacterPosition()
      }
    }

    this.groundNodeLastPosition = (this.groundNode !== null) ? this.groundNode.worldPosition: new SCNVector3(0, 0, 0)

    //jump -------------------------------------------------------------
    if(this.jumpState === 0){
      if(this.isJump && touchesTheGround){
        this.downwardAcceleration += Character.jumpImpulse
        this.jumpState = 1

        this.model.animationPlayerForKey('jump').play()
      }
    }else{
      if(this.jumpState === 1 && !this.isJump){
        this.jumpState = 2
      }

      if(this.downwardAcceleration > 0){
        for(let i=0; i<virtualFrameCount; i++){
          this.downwardAcceleration *= this.jumpState == 1 ? 0.99: 0.2
        }
      }

      if(touchesTheGround){
        if(!wasTouchingTheGroup){
          this.model.animationPlayerForKey('jump').stopWithBlendOutDuration(0.1)

          // trigger jump particles if not touching lava
          if(this.isBurning){
            this.model.childNodeWithNameRecursively('dustEmitter', true).addParticleSystem(this.jumpDustParticle)
          }else{
            // jump in lava again
            if(wasBurning){
              this.characterNode.runAction(SCNAction.sequence([
                SCNAction.playAudioWaitForCompletion(this.catchFireSound, false),
                SCNAction.playAudioWaitForCompletion(this.ouchSound, false)
                ]))
            }
          }
        }

        if(!this.isJump){
          this.jumpState = 0
        }
      }
    }

    if(touchesTheGround && !wasTouchingTheGroup && !this.isBurning && this.lastStepFrame < this.frameCounter - 10){
      // sound
      this.lastStepFrame = this.frameCounter
      this.characterNode.runAction(SCNAction.playAudioWaitForCompletion(this.steps[0], false))
    }

    if(wPosition.y < this.characterNode.position.y){
      wPosition.y = this.characterNode.position.y
    }
    //------------------------------------------------------------------

    // progressively update the elevation node when we touch the ground
    if(touchesTheGround){
      this.targetAltitude = wPosition.y
    }
    this.baseAltitude = 0.95
    this.baseAltitude += this.targetAltitude * 0.05

    characterVelocity.y += this.downwardAcceleration
    if(characterVelocity.length2() > 10e-04 * 10e-4){
      const startPosition = this.characterNode.presentation.worldPosition.add(this.collisionShapeOffsetFromModel)
      this.slideInWorldFromPositionVelocity(startPosition, characterVelocity)
    }
  }

  // MARK: - Animating the character

  get isAttacking() {
    return this.attackCount > 0
  }

  attack() {
    this.attackCount += 1
    this.model.animationPlayerForKey('spin').play()
    DispatchQueue.main.asyncAfterDeadline(Date.now() + 500, () => {
      this.attackCount -= 1
    })
    this.spinParticleAttach.addParticleSystem(this.spinCircleParticle)
  }

  get isWalking() {
    return this._isWalking
  }
  set isWalking(newValue) {
    const oldValue = this._isWalking
    this._isWalking = newValue

    if(oldValue !== this._isWalking){
      // Update node animation.
      if(this._isWalking){
        this.model.animationPlayerForKey('walk').play()
      }else{
        this.model.animationPlayerForKey('walk').stopWithBlendOutDuration(0.2)
      }
    }
  }

  get walkSpeed() {
    return this._walkSpeed
  }
  set walkSpeed(newValue) {
    const burningFactor = this.isBurning ? 2: 1
    this.model.animationPlayerForKey('walk').speed = Character.speedFactor * this._walkSpeed * burningFactor
  }

  characterDirectionWithPointOfView(pointOfView) {
    const controllerDir = this.direction
    if(controllerDir.length() === 0){
      return new SCNVector3(0, 0, 0)
    }

    let directionWorld = new SCNVector3(0, 0, 0)
    if(pointOfView){
      const p1 = pointOfView.presentation.convertPositionTo(new SCNVector3(controllerDir.x, 0.0, controllerDir.y), null)
      const p0 = pointOfView.presentation.convertPositionTo(new SCNVector3(0, 0, 0), null)
      directionWorld = p1.sub(p0)
      directionWorld.y = 0
      if(directionWorld.equals(SCNVector3.zero)){
        const minControllerSpeedFactor = 0.2
        const maxControllerSpeedFactor = 1.0
        const speed = controllerDir.length() * (maxControllerSpeedFactor - minControllerSpeedFactor) + minControllerSpeedFactor
        directionWorld = directionWorld.normalize().mul(speed)
      }
    }
    return directionWorld
  }

  resetCharacterPosition() {
    this.characterNode.position = Character.initialPosition
    this.downwardAcceleration = 0
  }

  // MARK: enemy

  didHitEnemy() {
    this.model.runAction(SCNAction.group(
      [SCNAction.playAudioWaitForCompletion(this.hitEnemySound, false),
       SCNAction.sequence(
        [SCNAction.waitForDuration(0.5),
         SCNAction.playAudioWaitForCompletion(this.explodeEnemySound, false)
        ])
      ]))
  }

  wasTouchedByEnemey() {
    const time = Date.now() * 0.001 //CFAbsoluteTimeGetCurrent()
    if(time > this.lastHitTime + 1){
      this.lastHitTime = time
      this.model.runAction(SCNAction.sequence([
        SCNAction.playAudioWaitForCompletion(this.hitSound, false),
        SCNAction.repeatCount(SCNAction.sequence([
          SCNAction.fadeOpacityToDuration(0.01, 0.1),
          SCNAction.fadeOpacityToDuration(1.0, 0.1)
          ]), 4)
        ]))
    }
  }

  // MARK: utils

  static loadAnimationFromSceneNamed(sceneName) {
    const scene = SCNScene.sceneNamed(sceneName)
    return scene.didLoad.then(() => {
      // find top level animation
      let animationPlayer = null
      scene.rootNode.enumerateChildNodes((child) => {
        if(child.animationKeys.length !== 0){
          animationPlayer = child.animationPlayerForKey(child.animationKeys[0])
          return true
        }
        return false
      })
      return animationPlayer
    })
  }

  // MARK: - physics contact
  slideInWorldFromPositionVelocity(start, velocity) {
    const maxSlideIteration = 4
    let iteration = 0
    let stop = false

    let replacementPoint = start._copy()

    let _start = start._copy()
    let _velocity = velocity._copy()
    const options = {}
    options[SCNPhysicsWorld.TestOption.collisionBitMask] = Bitmask.collision
    options[SCNPhysicsWorld.TestOption.searchMode] = SCNPhysicsWorld.TestSearchMode.closest
    while(!stop){
      let from = SCNMatrix4MakeTranslation(0, 0, 0)
      from.position = _start

      let to = SCNMatrix4MakeTranslation(0, 0, 0)
      to.position = _start.add(_velocity)

      const contacts = this.physicsWorld.convexSweepTestWith(this.characterCollisionShape, from, to, options)
      if(contacts.length !== 0){
        const result = this.handleSlidingAtContact(contacts[0], _start, _velocity)
        _velocity = result[0]
        _start = result[1]
        iteration += 1

        if(_velocity.length2() <= (10e-3 * 10e-3) || iteration >= maxSlideIteration){
          replacementPoint = _start
          stop = true
        }
      }else{
        replacementPoint = _start.add(_velocity)
        stop = true
      }
    }
    this.characterNode.worldPosition = replacementPoint.sub(this.collisionShapeOffsetFromModel)
  }

  handleSlidingAtContact(closestContact, start, velocity) {
    const originalDistance = velocity.length()

    const colliderPositionAtContact = start.add(closestContact.sweepTestFraction.mul(velocity))

    // Compute the sliding plane.
    const slidePlaneNormal = closestContact.contactNormal
    const slidePlaneOrigin = closestContact.contactPoint
    const centerOffset = slidePlaneOrigin.sub(colliderPositionAtContact)

    // Compute destination relative to the point of contact.
    const destinationPoint = slidePlaneOrigin.add(velocity)

    // We now project the destination point onto the sliding plane.
    const distPlane = slidePlaneOrigin.dot(slidePlaneNormal)

    // Project on plane.
    let t = this.planeIntersect(slidePlaneNormal, distPlane, destinationPoint, slidePlaneNormal)

    const normalizedVelocity = velocity.mul(1.0 / originalDistance)
    const angle = slidePlaneNormal.dot(normalizedVelocity)

    let frictionCoeff = 0.3
    if(Math.abs(angle) < 0.9){
      t += 10e-3
      frictionCoeff = 1.0
    }
    const newDestinationPoint = destinationPoint.add(slidePlaneNormal.mul(t)).sub(centerOffset)

    // Advance start position to nearest point withtout collision.
    const computedVelocity = newDestinationPoint.sub(start).normalize().mul(frictionCoeff * (1.0 - closestContact.sweepTestFraction) * originalDistance)

    return [computedVelocity, colliderPositionAtContact]
  }

  get didLoad() {
    return this._loadedPromise
  }
}
