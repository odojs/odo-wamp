const protocol = require('./protocol')
const randomId = () => Math.floor(Math.random() * 9007199254740992)

module.exports = (router, client) => {
  const registeredUris = {}
  const subscribedUris = {}
  const result = {
    register: uri => {
      const id = randomId()
      registeredUris[id] = uri
      return id
    },
    unregister: id => {
      const uri = registeredUris[id]
      if (uri) delete registeredUris[id]
      return uri
    },
    subscribe: uri => {
      const id = randomId()
      subscribedUris[id] = uri
      return id
    },
    unsubscribe: id => {
      const uri = subscribedUris[id]
      if (uri) delete subscribedUris[id]
      return uri
    },
    send: (msg, callback) => {
      client.send(JSON.stringify(msg),
        (typeof callback === 'function') ? callback
        : error => { if (error) result.terminate(1011, 'Unexpected error') })
    },
    close: () =>
      result.send([protocol.event.GOODBYE, {}, 'wamp.error.close_realm'],
        error => session.terminate(1000, 'Server closed WAMP session')),
    terminate: (code, reason) => client.close(code, reason),
    cleanup: () => {
      for (let id in registeredUris) {
        router.unregrpc(result.realm, registeredUris[id])
        delete registeredUris[id]
      }
      for (let id in subscribedUris) {
        router.unsubstopic(result.realm, subscribedUris[id], id)
        delete subscribedUris[id]
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
