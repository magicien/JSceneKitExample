'use strict'

import {
  CGPoint,
  GKBehavior,
  GKGoal,
  GKPath,
  GKSCNNodeComponent
} from 'jscenekit'
import BaseComponent from './BaseComponent'

const ScaredState = {
  wander: 0,
  flee: 1,
  dead: 2
}

export default class ScaredComponent extends BaseComponent {
  constructor() {
    super()

    this.fleeDistance = 2.0
    this.fleeSpeed = 5.0
    this.wanderSpeed = 1.0
    this.mass = 0.326
    this.maxAcceleration = 2.534

    this._player = null

    this.state = 0
    this.fleeGoal = null
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
    this.fleeGoal = GKGoal.goalToFleeAgent(this._player.agent)
    this.wanderGoal = GKGoal.goalToWander(this.wanderSpeed)

    const centers = [
      new CGPoint(-1, 9),
      new CGPoint(1, 9),
      new CGPoint(1, 11),
      new CGPoint(-1, 11)
    ]

    const path = GKPath.pathWithPointsRadiusCyclical(centers, 0.5, true)
    this.centerGoal = GKGoal.goalToStayOn(path, 1)
    this.behavior = GKBehavior.behaviorWithGoals([this.fleeGoal, this.wanderGoal, this.centerGoal])
    this.agent.behavior = this.behavior
    this.startWandering()
  }

  startWandering() {
    if(!this.behavior){
      return
    }

    this.behavior.setWeightFor(1, this.wanderGoal)
    this.behavior.setWeightFor(0, this.fleeGoal)
    this.behavior.setWeightFor(0.3, this.centerGoal)
    this.state = ScaredState.wander
  }

  startFleeing() {
    if(!this.behavior){
      return
    }

    this.behavior.setWeightFor(0, this.wanderGoal)
    this.behavior.setWeightFor(1, this.fleeGoal)
    this.behavior.setWeightFor(0.4, this.centerGoal)
    this.state = ScaredState.flee
  }

  isDead() {
    return this.state === ScaredState.dead
  }

  updateDeltaTime(seconds) {
    if(this.state === ScaredState.dead){
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

    const playerNode = playerComponent.node
    const enemyNode = nodeComponent.node
    const distance = enemyNode.worldPosition.sub(playerNode.worldPosition).length()

    switch(this.state){
      case ScaredState.wander:
        if(distance < this.fleeDistance){
          this.startFleeing()
        }
        break
      case ScaredState.flee:
        if(distance > this.fleeDistance){
          this.startWandering()
        }
        break
      case ScaredState.dead:
        break
    }

    this.handleEnemyResponse(this.character, enemyNode)

    super.updateDeltaTime(seconds)
  }

  handleEnemyResponse(character, enemy) {
    const direction = enemy.worldPosition.sub(character.node.worldPosition)
    if(direction.length() < 0.5){
      if(character.isAttacking){
        this.state = ScaredState.dead

        character.didHitEnemy()

        this.performEnemyDieWithExplosion(enemy, direction)
      }else{
        character.wasTouchedByEnemy()
      }
    }
  }

}

