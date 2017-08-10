'use strict'

import {
  CGPoint,
  GKBehavior,
  GKGoal,
  GKPath,
  GKSCNNodeComponent
} from 'jscenekit'
import BaseComponent from './BaseComponent'

const ChaserState = {
  wander: 0,
  chase: 1,
  dead: 2
}

export default class Chaseromponent extends BaseComponent {

  constructor() {
    super()

    this.hitDistance = 0.5
    this.chaseDistance = 3.0
    this.chaseSpeed = 9.0
    this.wanderSpeed = 1.0
    this.mass = 0.3
    this.maxAcceleration = 8.0

    this._player = null

    this.state = 0
    this.speed = 9.0

    this.chaseGoal = null
    this.wanderGoal = null
    this.centerGoal = null

    this.behavior = null
  }

  get player() {
    return this._player
  }
  set player(newValue) {
    this._player = newValue

    this.agent.mass = this.mass
    this.agent.maxAcceleration = this.maxAcceleration

    this.chaseGoal = GKGoal.goalToSeekAgent(this.player.agent)
    this.wanderGoal = GKGoal.goalToWander(this.wanderSpeed)

    let center = []
    center.push(new CGPoint(-1, 9))
    center.push(new CGPoint(1, 9))
    center.push(new CGPoint(1, 11))
    center.push(new CGPoint(-1, 11))

    const p = GKPath.pathWithPointsRadiusCyclical(center, 0.5, true)
    this.centerGoal = GKGoal.goalToStayOn(p, 1)
    this.behavior = GKBehavior.behaviorWithGoals([this.chaseGoal, this.wanderGoal, this.centerGoal])
    this.agent.behavior = this.behavior
    this.startWandering()
  }

  isDead() {
    return this.state === ChaserState.dead
  }

  startWandering() {
    if(!this.behavior){
      return
    }

    this.agent.maxSpeed = this.wanderSpeed
    this.behavior.setWeightFor(1, this.wanderGoal)
    this.behavior.setWeightFor(0, this.chaseGoal)
    this.behavior.setWeightFor(0.6, this.centerGoal)
    this.state = ChaserState.wander
  }

  startChasing() {
    if(!this.behavior){
      return
    }

    this.agent.maxSpeed = this.speed
    this.behavior.setWeightFor(0, this.wanderGoal)
    this.behavior.setWeightFor(1, this.chaseGoal)
    this.behavior.setWeightFor(0.1, this.centerGoal)
    this.state = ChaserState.chase
  }

  updateDeltaTime(seconds) {
    if(this.state === ChaserState.dead){
      return
    }

    const character = this.player.character
    if(!character){
      return
    }
    const playerComponent = this.player.entity.componentOfType(GKSCNNodeComponent)
    if(!playerComponent){
      return
    }
    const nodeComponent = this.entity.componentOfType(GKSCNNodeComponent)
    if(!nodeComponent){
      return
    }

    const enemyNode = nodeComponent.node
    const playerNode = playerComponent.node
    const distance = enemyNode.worldPosition.sub(playerNode.worldPosition).length()

    // Chase if below chaseDistance from enemy, wander otherwise.
    switch(this.state){
      case ChaserState.wander:
        if(distance < this.chaseDistance){
          this.startChasing()
        }
        break
      case ChaserState.chase:
        if(distance > this.chaseDistance){
          this.startWandering()
        }
        break
      case ChaserState.dead:
        break
    }

    this.speed = Math.min(this.chaseSpeed, distance)

    this.handleEnemyResponse(character, enemyNode)

    super.updateDeltaTime(seconds)
  }

  handleEnemyResponse(character, enemy) {
    const direction = enemy.worldPosition.sub(character.node.worldPosition)
    if(direction.length() < this.hitDistance){
      if(character.isAttacking){
        this.state = ChaserState.dead

        character.didHitEnemy()

        this.performEnemyDieWithExplosion(enemy, direction)
      }else{
        character.wasTouchedByEnemy()
      }
    }
  }
}

