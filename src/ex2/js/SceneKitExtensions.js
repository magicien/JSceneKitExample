'use strict'

import {
  SCNTransaction,
  SCNPhysicsContact,
  SCNAudioSource,
  SCNScene,
  SKSpriteNode,
  CAAnimation
} from 'jscenekit'

// MARK: SceneKit

SCNTransaction.animateWithDurationTimingFunctionCompletionBlockAnimations = function(duration = 0.25, timingFunction = null, completionBlock = null, animations = () => {}) {
  this.begin()
  this.animationDuration = duration
  this.completionBlock = completionBlock
  this.animationTimingFunction = timingFunction
  animations()
  this.commit()
}

SCNPhysicsContact.prototype.match = function(category, block) {
  if(this.nodeA.physicsBody.categoryBitMask === category){
    block(this.nodeA, this.nodeB)
  }

  if(this.nodeB.physicsBody.categoryBitMask === category){
    block(this.nodeB, this.nodeA)
  }
}

SCNAudioSource.sourceWithNameVolumePositionalLoopsShouldStreamShouldLoad = function(name, volume = 1.0, positional = true, loops = false, shouldStream = false, shouldLoad = true) {
  const source = new SCNAudioSource(`game.scnassets/sounds/${name}`)
  source.volume = volume
  source.isPositional = positional
  source.loops = loops
  source.shouldStream = shouldStream
  if(shouldLoad){
    source.load()
  }
  return source
}

// MARK: SpriteKit

SKSpriteNode.nodeWithImageNamedPositionScale = function(name, position, scale = 1.0) {
  const node = new SKSpriteNode(name)
  node.position = position
  node.xScale = scale
  node.yScale = scale
  return node
}

// MARK: CoreAnimation

CAAnimation.animationWithSceneNamed = function(name) {
  const promise = new Promise((resolve, reject) => {
    const scene = new SCNScene(name, null, (_scene) => {
      let animation = null
      _scene.rootNode.enumerateChildNodes((child) => {
        if(child.animationKeys.length > 0){
          animation = child.animationForKey(child.animationKeys[0])
          return true
        }
      })
      if(animation){
        resolve(animation)
      }else{
        reject()
      }
    })
  })
  return promise
}

