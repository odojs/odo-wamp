const randomId = () => Math.floor(Math.random() * 9007199254740992)

const protocol = {
  event: {
    HELLO: 1,
    WELCOME: 2,
    ABORT: 3,
    CHALLENGE: 4,
    AUTHENTICATE: 5,
    GOODBYE: 6,
    HEARTBEAT: 7,
    ERROR: 8,
    PUBLISH: 16,
    PUBLISHED: 17,
    SUBSCRIBE: 32,
    SUBSCRIBED: 33,
    UNSUBSCRIBE: 34,
    UNSUBSCRIBED: 35,
    EVENT: 36,
    CALL: 48,
    CANCEL: 49,
    RESULT: 50,
    REGISTER: 64,
    REGISTERED: 65,
    UNREGISTER: 66,
    UNREGISTERED: 67,
    INVOCATION: 68,
    INTERRUPT: 69,
    YIELD: 70
  }
}

protocol[protocol.event.HELLO] = (router, session, args) => {
  const realm = args.shift()
  const details = args.shift()
  if (typeof session.id !== 'undefined')
    return session.terminate(1002, 'protocol violation')
  session.id = randomId()
  session.send([protocol.event.WELCOME, session.id, { 'roles': { 'dealer': {}}}])
}

protocol[protocol.event.GOODBYE] = (router, session, args) => {
  session.send([ protocol.event.GOODBYE, {}, 'protocol.event.error.goodbye_and_out'],
    (error) => session.terminate(1000, 'Client closed WAMP session'))}

protocol[protocol.event.REGISTER] = (router, session, args) => {
  const request = args.shift()
  const options = args.shift()
  const procUri = args.shift()
  if (typeof router.getrpc(procUri) !== 'undefined')
    return session.send([protocol.event.ERROR, protocol.event.REGISTER, request, {},
      'protocol.event.error.procedure_already_exists'])
  const regId = session.register(procUri)
  router.regrpc(procUri, (invId, args) =>
    session.send([protocol.event.INVOCATION, invId, regId, {}, ...args]))
  session.send([protocol.event.REGISTERED, request, regId])
}

protocol[protocol.event.CALL] = (router, session, args) => {
  const callId = args.shift()
  const options = args.shift()
  const procUri = args.shift()
  const cb = (err, args) => {
    if (err) return session.send([protocol.event.ERROR, protocol.event.CALL, callId, {},
      'protocol.event.error.callee_failure'])
    session.send([protocol.event.RESULT, callId, {}, ...args])
  }
  if (!router.callrpc(procUri, args || [], cb))
    session.send([protocol.event.ERROR, protocol.event.CALL, callId, {},
      'protocol.event.error.no_such_procedure'])
}

protocol[protocol.event.UNREGISTER] = (router, session, args) => {
  const requestId = args.shift()
  const registrationId = args.shift()
  if (typeof session.unregister(registrationId) === 'undefined')
    return session.send([protocol.event.ERROR, protocol.event.UNREGISTER, requestId, {},
      'protocol.event.error.no_such_registration'])
  router.unregrpc(uri)
  session.send([protocol.event.UNREGISTERED, requestId])
}

protocol[protocol.event.YIELD] = (router, session, args) => {
  const invId = args.shift()
  const options = args.shift()
  router.resrpc(invId, null, args || [])
}

protocol[protocol.event.SUBSCRIBE] = (router, session, args) => {
  const requestId = args.shift()
  const options = args.shift()
  const topicUri = args.shift()
  const subsId = session.subscribe(topicUri)
  router.substopic(topicUri, subsId, (publicationId, args, kwargs) => {
    const msg = [protocol.event.EVENT, subsId, publicationId, {}]
    // Manage optional parameters args + kwargs
    if (args !== undefined) msg.push(args)
    if (kwargs !== undefined) msg.push(kwargs)
    session.send(msg)
  })
  session.send([protocol.event.SUBSCRIBED, requestId, subsId])
}

protocol[protocol.event.UNSUBSCRIBE] = (router, session, args) => {
  const requestId = args.shift()
  const subsid = args.shift()
  const topicUri = session.unsubscribe(subsid)
  if (typeof router.gettopic(topicUri) === 'undefined')
    return session.send([protocol.event.ERROR, protocol.event.UNSUBSCRIBE, requestId, {},
      'protocol.event.error.no_such_subscription'])
  router.unsubstopic(topicUri, subsid)
  session.send([protocol.event.UNSUBSCRIBED, requestId])
}

protocol[protocol.event.PUBLISH] = function(session, msg) {
  const requestId = msg.shift()
  const options = msg.shift()
  const topicUri = msg.shift()
  const ack = options && options.acknowledge
  const publicationId = randomId()
  const args = msg.shift() || []
  const kwargs = msg.shift() || {}
  if (ack) session.send([protocol.event.PUBLISHED, requestId, publicationId])
  router.publish(topicUri, publicationId, args, kwargs)
}

protocol[protocol.event.EVENT] = (router, session, args) => {
  // const subscriptionId = args.shift()
  // const publicationId = args.shift()
}

protocol[protocol.event.ERROR] = (session, msg) => {
  const requestType = msg.shift()
  const requestId = msg.shift()
  const details = msg.shift()
  const errorUri = msg.shift()
  const args = msg.shift() || []
  if (requestType === protocol.event.INVOCATION)
    router.resrpc(requestId, new Error(details), args)
}

module.exports = protocol
