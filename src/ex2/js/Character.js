'use strict'

import {
  CAAnimation,
  SCNAction,
  SCNAnimationEvent,
  SCNAudioSource,
  SCNCapsule,
  SCNNode,
  SCNScene,
  SCNPhysicsBody,
  SCNPhysicsBodyType,
  SCNPhysicsShape,
  SCNPhysicsWorld,
  SCNTransaction,
  SCNVector3
} from 'jscenekit'

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

export default class Character {

  // MARK: Initialization

  constructor() {

    // MARK: Retrieving nodes

    this.node = new SCNNode()

    // MARK: Controlling the character

    this.groundType = GroundType.inTheAir
    this.previousUpdateTime = 0.0
    this.accelerationY = 0.0
    this._directionAngle = 0.0

    // MARK: Animating the character

    this.walkAnimation = null
    this._isWalking = false
    this._walkSpeed = 1.0

    // MARK: Dealing with fire

    this.isBurning = false
    this.isInvincible = false

    this.fireEmitter = null
    this.smokeEmitter = null
    this.whiteSmokeEmitter = null

    // MARK: Dealing with sound

    this.reliefSound = null
    this.haltFireSound = null
    this.catchFireSound = null
    this.steps = []
    for(let i=0; i<Object.keys(GroundType).length; i++){
      this.steps.push([])
    }

    // MARK: Load character from external file

    // The character is loaded from a .scn file and stored in an intermediate
    // node that will be used as a handle to manipulate the whole group at once

    //const characterScene = SCNScene.sceneNamed('game.scnassets/panda.scn')
    const characterScene = new SCNScene('game.scnassets/panda.scn')
    characterScene.didLoad.then(() => {
      const characterTopLevelNode = characterScene.rootNode.childNodes[0]
      this.node.addChildNode(characterTopLevelNode)

      this.node._updateWorldTransform()

      // MARK: Configure collision capsule

      // Collisions are handled by the physics engine. The character is approximated by
      // a capsule that is configured to collide with collectables, enemies and walls

      const {min, max} = this.node.boundingBox
      const collisionCapsuleRadius = (max.x - min.x) * 0.4
      const collisionCapsuleHeight = max.y - min.y

      const characterCollisionNode = new SCNNode()
      characterCollisionNode.name = 'collider'
      characterCollisionNode.position = new SCNVector3(0.0, collisionCapsuleHeight * 0.51, 0.0) // a bit too high so that the capsule does not hit the floor
      characterCollisionNode.physicsBody = new SCNPhysicsBody(SCNPhysicsBodyType.kinematic, new SCNPhysicsShape(new SCNCapsule(collisionCapsuleRadius, collisionCapsuleHeight), null))
      characterCollisionNode.physicsBody.contactTestBitMask = BitmaskSuperCollectable | BitmaskCollectable | BitmaskCollision | BitmaskEnemy
      this.node.addChildNode(characterCollisionNode)


      // MARK: Load particle systems

      // Particle systems were configured in the SceneKit Scene Editor
      // They are retrieved from the scene and their birth rate are stored for later use

      const particleEmitterWithName = (name) => {
        const emitter = {}
        emitter.node = characterTopLevelNode.childNodeWithNameRecursively(name, true)
        emitter.particleSystem = emitter.node.particleSystems[0]
        emitter.birthRate = emitter.particleSystem.birthRate
        emitter.particleSystem.birthRate = 0
        emitter.node.isHidden = false
        return emitter
      }

      this.fireEmitter = particleEmitterWithName('fire')
      this.smokeEmitter = particleEmitterWithName('smoke')
      this.whiteSmokeEmitter = particleEmitterWithName('whiteSmoke')


      // MARK: Load sound effects

      this.reliefSound = new SCNAudioSource('game.scnassets/sounds/aah_extinction.mp3', 2.0)
      this.haltFireSound = new SCNAudioSource('game.scnassets/sounds/fire_extinction.mp3', 2.0)
      this.catchFireSound = new SCNAudioSource('game.scnassets/sounds/ouch_firehit.mp3', 2.0)

      for(let i=0; i<10; i++){
        const grassSound = new SCNAudioSource(`game.scnassets/sounds/Step_grass_0${i}.mp3`)
        if(grassSound){
          grassSound.volume = 0.5
          grassSound.load()
          this.steps[GroundType.grass].push(grassSound)
        }

        const rockSound = new SCNAudioSource(`game.scnassets/sounds/Step_rock_0${i}.mp3`)
        if(rockSound){
          rockSound.load()
          this.steps[GroundType.rock].push(rockSound)
        }
      }

      for(let i=0; i<4; i++){
        const waterSound = new SCNAudioSource(`game.scnassets/sounds/Step_splash_0${i}.mp3`)
        if(waterSound){
          waterSound.load()
          this.steps[GroundType.water].push(waterSound)
        }
      }


      // MARK: Configure animations

      // Some animations are already there and can be retrieved from the scene
      // The "walk" animation is loaded from a file, it is configured to play foot steps at specific times during the animation

      characterTopLevelNode.enumerateChildNodes((child) => {
        for(const key of child.animationKeys){         // for every animation key
          const animation = child.animationForKey(key) // get the animation
          animation.usesSceneTimeBase = false          // make it system time based
          animation.repeatCount = Infinity             // make it repeat forever
          child.addAnimationForKey(animation, key)     // animations are copied upon addition, so we have to replace the previous animation
        }
      })

      //this.walkAnimation = CAAnimation.animationWithSceneNamed('game.scnassets/walk.scn')
      CAAnimation.animationWithSceneNamed('game.scnassets/walk.scn')
      .then((animation) => {
        this.walkAnimation = animation
        this.walkAnimation.usesSceneTimeBase = false
        this.walkAnimation.fadeInDuration = 0.3
        this.walkAnimation.fadeOutDuration = 0.3
        this.walkAnimation.repeatCount = Infinity
        this.walkAnimation.speed = Character.speedFactor
        this.walkAnimation.animationEvents = [
          new SCNAnimationEvent(0.1, () => { this.playFootStep() }),
          new SCNAnimationEvent(0.6, () => { this.playFootStep() })
        ]
      })
    })
  }
  
  // MARK: Controlling the character

  static get speedFactor() {
    return 1.538
  }

  get directionAngle() {
    return this._directionAngle
  }
  set directionAngle(newValue) {
    const oldValue = this._directionAngle
    this._directionAngle = newValue
    if(this._directionAngle !== oldValue){
      this.node.runAction(SCNAction.rotateToXYZUsesShortestUnitArc(0.0, this._directionAngle, 0.0, 0.1, true))
    }
  }

  walkInDirection(direction, time, scene, groundTypeFromMaterial) {
    // delta time since last update
    if(this.previousUpdateTime === 0.0){
      this.previousUpdateTime = time
    }

    const deltaTime = Math.min(time - this.previousUpdateTime, 1.0 / 60.0)
    const characterSpeed = deltaTime * Character.speedFactor * 0.84
    this.previousUpdateTime = time

    const initialPosition = this.node.position._copy()

    // move
    if(direction.x !== 0.0 && direction.z !== 0.0){
      // move character
      const position = this.node.position
      this.node.position = position.add(direction.mul(characterSpeed))

      // update orientation
      this.directionAngle = Math.atan2(direction.x, direction.z)

      this.isWalking = true
    }
    else{
      this.isWalking = false
    }

    // Update the altitude of the character

    let position = this.node.position._copy()
    let p0 = position._copy()
    let p1 = position._copy()

    const maxRise = 0.08
    const maxJump = 10.0
    p0.y -= maxJump
    p1.y += maxRise

    // Do a vertical ray intersection
    let groundNode = null
    const results = scene.physicsWorld.rayTestWithSegmentFromTo(p1, p0, [
      [SCNPhysicsWorld.TestOption.collisionBitMask, BitmaskCollision | BitmaskWater],
      [SCNPhysicsWorld.TestOption.searchMode, SCNPhysicsWorld.TestSearchMode.closest]])

    const result = results[0]
    if(result){
      let groundAltitude = result.worldCoordinates.y
      groundNode = result.node

      const groundMaterial = result.node.childNodes[0].geometry.firstMaterial
      this.groundType = groundTypeFromMaterial(groundMaterial)

      if(this.groundType === GroundType.water){
        if(this.isBurning){
          this.haltFire()
        }

        // do a new ray test without the water to get the altitude of the ground (under the water).
        const _results = scene.physicsWorld.rayTestWithSegmentFromTo(p1, p0, [
          [SCNPhysicsWorld.TestOption.collisionBitMask, BitmaskCollision], 
          [SCNPhysicsWorld.TestOption.searchMode, SCNPhysicsWorld.TestSearchMode.closest]])

        const _result = results[0]
        groundAltitude = _result.worldCoordinates.y
      }

      const threshold = 1e-5
      const gravityAcceleration = 0.18

      if(groundAltitude < position.y - threshold){
        this.accelerationY += deltaTime * gravityAcceleration // approximation of acceleration for a delta time
        if(groundAltitude < position.y - 0.2){
          this.groundType = GroundType.inTheAir
        }
      }
      else{
        this.accelerationY = 0
      }

      position.y -= this.accelerationY

      // reset acceleration if we touch the ground
      if(groundAltitude > position.y){
        this.accelerationY = 0
        position.y = groundAltitude
      }

      // Finally, update the position of the character.
      this.node.position = position
    }
    else{
      // no result, we are probably out the bounds of the level -> revert the position of the character.
      this.node.position = initialPosition
    }

    return groundNode
  }

  // MARK: Animating the character

  get isWalking() {
    return this._isWalking
  }
  set isWalking(newValue) {
    const oldValue = this._isWalking
    this._isWalking = newValue
    if(oldValue !== this._isWalking){
      // Update node animation.
      if(this._isWalking){
        this.node.addAnimationForKey(this.walkAnimation, 'walk')
      }else{
        this.node.removeAnimationForKeyFadeOutDuration('walk', 0.2)
      }
    }
  }

  get walkSpeed() {
    return this._walkSpeed
  }
  set walkSpeed(newValue) {
    const oldValue = this._walkSpeed
    this._walkSpeed = newValue
    
    // remove current walk animation if any.
    const wasWalking = this._isWalking
    if(wasWalking){
      this._isWalking = false
    }

    this.walkAnimation.speed = Character.speedFactor * this.walkSpeed

    // restore walk animation if needed.
    this._isWalking = wasWalking
  }

  // MARK: Dealing with fire

  catchFire() {
    if(this.isInvincible === false){
      this.isInvincible = true
      this.node.runAction(SCNAction.sequence([
        SCNAction.playAudioWaitForCompletion(this.catchFireSound, false),
        SCNAction.repeat(SCNAction.sequence([
          SCNAction.fadeOpacityToDuration(0.01, 0.1),
          SCNAction.fadeOpacityToDuration(1.0, 0.1)
          ]), 7),
        SCNAction.run(() => { this.isInvincible = false })]))
    }

    this.isBurning = true

    // start fire + smoke
    this.fireEmitter.particleSystem.birthRate = this.fireEmitter.birthRate
    this.smokeEmitter.particleSystem.birthRate = this.smokeEmitter.birthRate

    // walk faster
    this.walkSpeed = 2.3
  }

  haltFire() {
    if(this.isBurning){
      this.isBurning = false

      this.node.runAction(SCNAction.sequence([
        SCNAction.playAudioWaitForCompletion(this.haltFireSound, true),
        SCNAction.playAudioWaitForCompletion(this.reliefSound, false)])
      )

      // stop fire and smoke
      this.fireEmitter.particleSystem.birthRate = 0
      SCNTransaction.animateWithDurationTimingFunctionCompletionBlockAnimations(1.0, null, null, () => {
        this.smokeEmitter.particleSystem.birthRate = 0
      })

      // start white smoke
      this.whiteSmokeEmitter.particleSystem.birthRate = this.whiteSmokeEmitter.birthRate

      // progressively stop white smoke
      SCNTransaction.animateWithDurationTimingFunctionCompletionBlockAnimations(5.0, null, null, () => {
        this.whiteSmokeEmitter.particleSystem.birthRate = 0
      })

      // walk normally
      this.walkSpeed = 1.0
    }
  }

  // MARK: Dealing with sound

  playFootStep() {
    if(this.groundType !== GroundType.inTheAir){ // we are in the air, no sound to play.
      // Play a random step sound.
      const soundsCount = this.steps[this.groundType].length
      const stepSoundIndex = Math.floor(Math.random() * soundsCount)
      this.node.runAction(SCNAction.playAudioWaitForCompletion(this.steps[this.groundType][stepSoundIndex], false))
    }
  }

}

