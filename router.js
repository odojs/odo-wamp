// https://wamp-proto.org/spec/

const session = require('./session')
const randomId = () => Math.floor(Math.random() * 9007199254740992)

module.exports = (server) => {
  const sessions = {}
  const pending = {}
  const rpcs = {}
  const topics = {}
  const result = {
    getrpc: (realm, uri) => rpcs[realm][uri],
    regrpc: (realm, uri, rpc) => {
      if (!rpcs[realm]) rpcs[realm] = {}
      rpcs[realm][uri] = rpc
    },
    unregrpc: (realm, uri) => delete rpcs[realm][uri],
    callrpc: (realm, uri, args, callback) => {
      const fn = result.getrpc(realm, uri)
      if (!fn) return false
      const id = randomId()
      pending[id] = callback
      fn(id, args)
      return true
    },
    resrpc: (id, err, ...args) => {
      if (!pending[id]) return
      pending[id](err, args)
      delete pending[id]
    },
    gettopic: (realm, uri) => topics[realm][uri],
    substopic: (realm, uri, id, callback) => {
      if (!topics[realm]) topics[realm] = {}
      if (!topics[realm][uri]) topics[realm][uri] = {}
      topics[realm][uri][id] = callback
    },
    unsubstopic: (realm, uri, id) => delete topics[realm][uri][id],
    publish: (realm, uri, id, args, kwargs) => {
      if (!topics[realm] || !topics[realm][uri]) return false
      for (let key in topics[realm][uri]) {
        if (typeof topics[realm][uri][key] === 'undefined') continue
        topics[realm][uri][key](id, args, kwargs)
      }
      return true
    }
  }
  server.on('connection', client => {
    const id = randomId()
    sessions[id] = session(result, client)
    client.on('close', () => {
      sessions[id].cleanup()
      delete sessions[id]
    })
  })
  return result
}
