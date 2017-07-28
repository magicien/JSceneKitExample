'use strict'

import {
  CAMediaTimingFunction,
  CFAbsoluteTimeGetCurrent,
  CGPoint,
  GKAgent2D,
  GKComponent,
  GKSCNNodeComponent,
  SCNMatrix4,
  SCNScene,
  SCNTransaction,
  SCNVector3Make,
  SCNVector4,

  kCAMediaTimingFunctionEaseOut
} from 'jscenekit'

const _EnemyAltitude = -0.46

export default class BaseComponent extends GKComponent {
  constructor() {
    super()

    this.agent = new GKAgent2D()
    this.isAutoMoveNode = true
  }

  static get EnemyAltitude() {
    return _EnemyAltitude
  }

  isDead() {
    return false
  }

  positionAgentFromNode() {
    const nodeComponent = this.entity.componentOfType(GKSCNNodeComponent)
    const node = nodeComponent.node
    node.transform = this.agent.transform
  }

  constrainPosition() {
    let position = this.agent.position
    if(position.x > 2){
      position.x = 2
    }
    if(position.x < -2){
      position.x = -2
    }
    if(position.y > 12.5){
      position.y = 12.5
    }
    if(position.y < 8.5){
      position.y = 8.5
    }
    this.agent.position = position
  }

  updateDeltaTime(seconds) {
    if(this.isDead()){
      return
    }

    this.agent.updateDeltaTime(seconds)
    this.constrainPosition()
    if(this.isAutoMoveNode){
      this.positionNodeFromAgent()
    }
    super.updateDeltaTime(seconds)
  }

  performEnemyDieWithExplosionDirection(enemy, direction) {
    const explositionScene = SCNSccene.sceneNamed('Art.scnassets/enemy/enemy_explosion.scn')
    if(!explositionScene){
      console.log('Missing enemy_explosion.scn')
      return
    }

    SCNTransaction.begin()
    SCNTransaction.animationDuration = 0.4
    SCNTransaction.animationTimingFunction = CAMediaTimingFunction.functionWithName(kCAMediaTimingFunctionEaseOut)

    SCNTransaction.completionBlock = () => {
      explositionScene.rootNode.enumerateHierarchy((node) => {
        const particles = node.particleSystems
        if(!particles){
          return
        }
        for(const particle of particles){
          enemy.addParticleSystem(particle)
        }
      })

      // Hide
      enemy.childNodes[0].opacity = 0.0
    }

    let _direction = direction
    _direction.y = 0
    enemy.removeAllAnimations()
    enemy.eulerAngles = SCNVector3Make(enemy.eulerAngles.x, enemy.eulerAngles.x + Math.PI * 4.0, enemy.eulerAngles.z)
    enemy.worldPosition += direction.normalize().mul(1.5)
    this.positionAgentFromNode()

    SCNTransaction.commit()
  }
}

Object.defineProperty(GKAgent2D.prototype, 'transform', {
  get: function get() {
    const quat = (new SCNVector4(0, 1, 0, -(this.rotation - Math.PI / 2))).rotationToQuat()
    let transform = SCNMatrix4.matrixWithOrientation(quat)
    transform.m41 = this.position.x
    transform.m42 = BaseComponent.EnemyAltitude
    transform.m43 = this.position.y
    transform.m44 = 1
    return transform
  },
  set: function set(newValue) {
    const quatf = newValue.quaternion()
    this.rotation = -(quatf.angle + Math.PI / 2)
    this.position = new CGPoint(newValue.m41, newValue.m43)
  }
})

