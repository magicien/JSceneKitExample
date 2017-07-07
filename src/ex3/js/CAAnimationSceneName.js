'use strict'

import {
  CAAnimation,
  SCNScene
} from 'jscenekit'

// MARK: Core Animation

CAAnimation.animationWithSceneName = function(name) {
  const promise = new Promise((resolve, reject) => {
    const scene = new SCNScene(name)
    scene._getLoadedPromise().then(() => {
      let animation = null
      scene.rootNode.enumerateChildNodes((child) => {
        const firstKey = child.animationKeys[0]
        if(!firstKey){
          return false
        }
        animation = child.animationForKey(firstKey)
        return true
      })

      if(!animation){
        reject(`Failed to find animation named ${name}`)
      }

      animation.fadeInDuration = 0.3
      animation.fadeOutDuration = 0.3
      animation.repeatCount = 1

      resolve(animation)
    }).catch((error) => {
      reject(`Failed to find scene with name ${name}`)
    })
  })
  return promise
}

