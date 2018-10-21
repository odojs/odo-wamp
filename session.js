const protocol = require('./protocol')
const randomId = () => Math.floor(Math.random() * 9007199254740992)

module.exports = (router, client) => {
  const _registeredUris = {}
  const _subscribedUris = {}
  const result = {
    register: uri => {
      const id = randomId()
      _registeredUris[id] = uri
      return id
    },
    unregister: id => {
      const uri = _registeredUris[id]
      if (typeof uri !== 'undefined') delete _registeredUris[id]
      return uri
    },
    subscribe: uri => {
      const id = randomId()
      _subscribedUris[id] = uri
      return id
    },
    unsubscribe: id => {
      const uri = _subscribedUris[id]
      if (typeof uri !== 'undefined') delete _subscribedUris[id]
      return uri
    },
    send: (msg, callback) => {
      client.send(JSON.stringify(msg),
        (typeof callback === 'function')
        ? callback
        : error => {
          if (error) result.terminate(1011, 'Unexpected error')
        })
    },
    close: () =>
      result.send([protocol.event.GOODBYE, {}, 'wamp.error.close_realm'],
        error => session.terminate(1000, 'Server closed WAMP session')),
    terminate: (code, reason) => client.close(code, reason),
    cleanup: () => {
      for (let id in _registeredUris) {
        router.unregrpc(_registeredUris[id])
        delete _registeredUris[id]
      }
      for (let id in _subscribedUris) {
        router.unsubstopic(_subscribedUris[id], id)
        delete _subscribedUris[id]
      }
    }
  }
  client.on('message', data => {
    let msg
    try { msg = JSON.parse(data) }
    catch (e) { return result.terminate(1003, 'protocol violation') }
    if (!Array.isArray(msg)) return result.terminate(1003, 'protocol violation')
    const type = msg.shift()
    if (!protocol[type]) return result.terminate(1003, 'protocol violation')
    protocol[type](router, result, msg)
  })

  return result
}
