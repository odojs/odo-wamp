// https://wamp-proto.org/spec/

const session = require('./session')
const EventEmitter = require('events')
const randomId = () => Math.floor(Math.random() * 9007199254740992)

module.exports = (server) => {
  const result = new EventEmitter()
  const _sessions = {}
  const _rpcs = {}
  const _pending = {}
  const _topics = {}
  server.on('connection', client => {
    const id = randomId()
    _sessions[id] = session(result, client)
    client.on('close', () => {
      _sessions[id].cleanup()
      delete _sessions[id]
    })
  })

  result.getrpc = uri => _rpcs[uri]
  result.regrpc = (uri, rpc) => {
    _rpcs[uri] = rpc
    result.emit('RPCRegistered', [uri])
  }
  result.unregrpc = uri => {
    delete _rpcs[uri]
    result.emit('RPCUnregistered', [uri])
  }
  result.callrpc = (uri, args, callback) => {
    if (typeof result.getrpc(uri) === 'undefined') return false
    const id = randomId()
    _pending[id] = callback
    result.getrpc(uri)(id, args)
    return true
  }
  result.resrpc = (invId, err, args) => {
    if (typeof _pending[invId] === 'undefined') return
    _pending[invId](err, args)
    delete _pending[invId]
  }
  result.gettopic = topicUri => _topics[topicUri]
  result.substopic = (topicUri, subscriptionId, callback) => {
    if (typeof _topics[topicUri] === 'undefined') _topics[topicUri] = {}
    _topics[topicUri][subscriptionId] = callback
    result.emit('Subscribe', topicUri)
  }
  result.unsubstopic = (topicUri, subscriptionId) => {
    delete _topics[topicUri][subscriptionId]
    result.emit('Unsubscribe', topicUri)
  }
  result.publish = (topicUri, publicationId, args, kwargs) => {
    result.emit('Publish', topicUri, args, kwargs)
    if (typeof _topics[topicUri] === 'undefined') return false
    for (let key in _topics[topicUri]) {
      if (typeof _topics[topicUri][key] === 'undefined') continue
      _topics[topicUri][key](publicationId, args, kwargs)
    }
    return true
  }
  return result
}
