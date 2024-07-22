import { LFEventID, Message } from "./course-info-scripts/common";




chrome.runtime.sendMessage({ type: 'status'}).then((response) => {
  if (!response) {
    console.log("Not logged in. Ignoring...")
    return;
  }

  chrome.runtime.sendMessage({ type: 'inject', data: 'contentScript.bundle.js' }).then(() => {
    console.log("Injected content script")
  })

  // add event listener for messages from injected script
  console.debug("Adding message listener for tab id: ", LFEventID)
  window.addEventListener('message', (event: MessageEvent<Message>) => {

    if (event.data.eventID == LFEventID && event.data.type !== 'response') {
      console.log('Received window message: ', event.data)
      if (event.data.type == 'search') {
        chrome.runtime.sendMessage({
          type: 'search',
          data: event.data.data
        }).then((response) => {
          console.log('Sending response: ', response)
          window.postMessage({ type: 'response', data: response, eventID: LFEventID }, '*')
        })
      }
      else if (event.data.type == 'status') {
        chrome.runtime.sendMessage({
          type: 'status'
        }).then((response) => {
          console.log('Sending response: ', response)
          window.postMessage({ type: 'response', data: response, eventID: LFEventID }, '*')
        })
      }
    }
  })

})

// chrome.runtime.sendMessage({ type: 'status'}).then((response) => {
//   console.log("Received response: ", response)
// })