import EventEmitter from "events";

export default function wsBus() {
  const emitter = new EventEmitter();

  async function initBus() {
    // No external connection required for a local in-process bus stub
    console.log("wsBus: init (in-process stub)");
    return true;
  }

  async function publish(rec) {
    // Rec should include topic_id
    setTimeout(() => emitter.emit("event", rec), 0);
    return { success: true };
  }

  function subscribe(_topicId, handler) {
    const listener = (payload) => {
      // optional filtering
      if (payload && payload.topic_id && payload.topic_id === _topicId) {
        handler(payload);
      }
    };
    emitter.on("event", listener);

    return () => emitter.off("event", listener);
  }

  function fetchSince(_topicId, _ts) {
    // Not implemented for this stub; implement if necessary for tests
    return [];
  }

  function fetchLatest(_topicId) {
    return [];
  }

  function close() {
    // cleanup
    emitter.removeAllListeners();
  }

  return {
    initBus,
    publish,
    subscribe,
    fetchSince,
    fetchLatest,
    close,
  };
}
